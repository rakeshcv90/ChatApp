/**
 * CallService.ts
 *
 * Encapsulates all WebRTC peer-connection lifecycle management and uses
 * Firebase Firestore as the signaling server for 1-to-1 audio/video calls.
 *
 * Firestore document schema  ─  /calls/{callId}
 * ┌────────────────────────────────────────────────────────────┐
 * │ callerId, calleeId, callerName, callerAvatar, callType,   │
 * │ offer (SDP), answer (SDP), status, createdAt, endedAt     │
 * └────────────────────────────────────────────────────────────┘
 * Sub-collections: offerCandidates, answerCandidates
 */

import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import {PermissionsAndroid, Platform} from 'react-native';
import InCallManager from 'react-native-incall-manager';

// ─── WebRTC ICE server configuration ──────────────────────────────────────────
const ICE_SERVERS = [
  {urls: 'stun:stun.l.google.com:19302'},
  {urls: 'stun:stun1.l.google.com:19302'},
  // TURN servers — required for calls across different networks / behind NAT
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

// Keep references alive for the active call
let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let unsubscribers: (() => void)[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Request camera + mic permissions on Android. iOS permissions handled via Info.plist. */
export async function requestMediaPermissions(
  isVideo: boolean = true,
): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const permissions = isVideo
      ? [
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]
      : [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];

    const granted = await PermissionsAndroid.requestMultiple(permissions);
    console.log('[CallService] Permission results:', JSON.stringify(granted));

    const audioOk =
      granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
      PermissionsAndroid.RESULTS.GRANTED;

    if (!isVideo) return audioOk;

    const cameraOk =
      granted[PermissionsAndroid.PERMISSIONS.CAMERA] ===
      PermissionsAndroid.RESULTS.GRANTED;

    return audioOk && cameraOk;
  } catch (err) {
    console.warn('[CallService] Permission request error:', err);
    // On some devices/ROMs, PermissionsAndroid throws but the
    // permissions are actually granted via AndroidManifest.
    // Return true and let getUserMedia handle the real check.
    return true;
  }
}

/** Acquire local media stream (audio only or audio+video). */
export async function getLocalStream(
  isVideo: boolean,
): Promise<MediaStream | null> {
  try {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: isVideo
        ? {facingMode: 'user', width: 640, height: 480, frameRate: 30}
        : false,
    });
    return stream as MediaStream;
  } catch (err) {
    console.error('[CallService] getUserMedia error:', err);
    return null;
  }
}

// ─── Create peer connection ──────────────────────────────────────────────────

function createPeerConnection(
  onRemoteStream: (stream: MediaStream) => void,
  onConnectionStateChange?: (state: string) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({iceServers: ICE_SERVERS} as any);

  // Pre-create remote stream so we have a stable URL regardless of whether
  // event.streams is populated (it is often empty on Android release/Hermes).
  remoteStream = new MediaStream();

  (pc as any).ontrack = (event: any) => {
    if (event.streams && event.streams[0]) {
      // Copy tracks into our own stream — avoids stale URL from Hermes optimization
      event.streams[0].getTracks().forEach((track: any) => {
        (remoteStream as any).addTrack(track);
      });
    } else if (event.track) {
      (remoteStream as any).addTrack(event.track);
    }
    onRemoteStream(remoteStream!);
  };

  // Monitor connection state
  (pc as any).onconnectionstatechange = () => {
    const state = (pc as any).connectionState;
    console.log('[CallService] Connection state:', state);
    onConnectionStateChange?.(state);
  };

  (pc as any).oniceconnectionstatechange = () => {
    console.log(
      '[CallService] ICE connection state:',
      (pc as any).iceConnectionState,
    );
  };

  return pc;
}

// ─── Start Call (Caller) ─────────────────────────────────────────────────────

export interface StartCallParams {
  callerId: string;
  calleeId: string;
  callerName: string;
  callerAvatar: string;
  calleeName: string;
  calleeAvatar: string;
  callType: 'audio' | 'video';
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: string) => void;
  onCallStatusChange?: (status: string) => void;
}

export async function startCall(
  params: StartCallParams,
): Promise<{callId: string; localStream: MediaStream} | null> {
  const {
    callerId,
    calleeId,
    callerName,
    callerAvatar,
    calleeName,
    calleeAvatar,
    callType,
    onRemoteStream,
    onConnectionStateChange,
    onCallStatusChange,
  } = params;

  // 1. Get local media
  const stream = await getLocalStream(callType === 'video');
  if (!stream) return null;
  localStream = stream;

  // 2. Create peer connection
  peerConnection = createPeerConnection(
    onRemoteStream,
    onConnectionStateChange,
  );

  // 3. Add local tracks to peer connection
  localStream.getTracks().forEach(track => {
    peerConnection!.addTrack(track, localStream!);
  });

  // 4. Create Firestore call document
  const callRef = firestore().collection('calls').doc();
  const callId = callRef.id;

  // 5. Collect ICE candidates into offerCandidates sub-collection
  (peerConnection as any).onicecandidate = (event: any) => {
    if (event.candidate) {
      callRef
        .collection('offerCandidates')
        .add(event.candidate.toJSON())
        .catch(err =>
          console.error('[CallService] Error adding offer candidate:', err),
        );
    }
  };

  // 6. Create offer
  const offerDescription = await peerConnection.createOffer({} as any);
  await peerConnection.setLocalDescription(offerDescription);

  // 7. Write call doc with offer
  await callRef.set({
    callerId,
    calleeId,
    callerName,
    callerAvatar,
    calleeName,
    calleeAvatar,
    callType,
    offer: {
      type: offerDescription.type,
      sdp: offerDescription.sdp,
    },
    status: 'ringing',
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  // 8. Listen for answer from callee
  const unsubAnswer = callRef.onSnapshot(snapshot => {
    const data = snapshot.data();
    if (!data) return;

    // Callee wrote an answer
    if (data.answer && peerConnection && !(peerConnection as any).remoteDescription) {
      const answerDesc = new RTCSessionDescription(data.answer);
      peerConnection.setRemoteDescription(answerDesc).catch(err =>
        console.error('[CallService] setRemoteDescription error:', err),
      );
    }

    // Status changes (rejected / ended)
    if (data.status && data.status !== 'ringing') {
      onCallStatusChange?.(data.status);
    }
  });
  unsubscribers.push(unsubAnswer);

  // 9. Listen for answer ICE candidates
  const unsubAnswerCandidates = callRef
    .collection('answerCandidates')
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' && peerConnection) {
          const candidate = new RTCIceCandidate(change.doc.data() as any);
          peerConnection.addIceCandidate(candidate).catch(err =>
            console.error('[CallService] addIceCandidate error:', err),
          );
        }
      });
    });
  unsubscribers.push(unsubAnswerCandidates);

  return {callId, localStream};
}

// ─── Answer Call (Callee) ────────────────────────────────────────────────────

export interface AnswerCallParams {
  callId: string;
  callType: 'audio' | 'video';
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: string) => void;
  onCallStatusChange?: (status: string) => void;
}

export async function answerCall(
  params: AnswerCallParams,
): Promise<MediaStream | null> {
  const {
    callId,
    callType,
    onRemoteStream,
    onConnectionStateChange,
    onCallStatusChange,
  } = params;

  // 1. Get local media
  const stream = await getLocalStream(callType === 'video');
  if (!stream) return null;
  localStream = stream;

  // 2. Create peer connection
  peerConnection = createPeerConnection(
    onRemoteStream,
    onConnectionStateChange,
  );

  // 3. Add local tracks
  localStream.getTracks().forEach(track => {
    peerConnection!.addTrack(track, localStream!);
  });

  const callRef = firestore().collection('calls').doc(callId);

  // 4. Collect ICE candidates into answerCandidates sub-collection
  (peerConnection as any).onicecandidate = (event: any) => {
    if (event.candidate) {
      callRef
        .collection('answerCandidates')
        .add(event.candidate.toJSON())
        .catch(err =>
          console.error('[CallService] Error adding answer candidate:', err),
        );
    }
  };

  // 5. Read offer from call document
  const callDoc = await callRef.get();
  const callData = callDoc.data();
  if (!callData?.offer) {
    console.error('[CallService] No offer found in call document');
    return null;
  }

  // 6. Set remote description (offer)
  const offerDesc = new RTCSessionDescription(callData.offer);
  await peerConnection.setRemoteDescription(offerDesc);

  // 7. Create answer
  const answerDescription = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answerDescription);

  // 8. Write answer to Firestore
  await callRef.update({
    answer: {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    },
    status: 'connected',
  });

  // 9. Listen for offer ICE candidates
  const unsubOfferCandidates = callRef
    .collection('offerCandidates')
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' && peerConnection) {
          const candidate = new RTCIceCandidate(change.doc.data() as any);
          peerConnection.addIceCandidate(candidate).catch(err =>
            console.error('[CallService] addIceCandidate error:', err),
          );
        }
      });
    });
  unsubscribers.push(unsubOfferCandidates);

  // 10. Listen for status changes (ended by caller)
  const unsubStatus = callRef.onSnapshot(snapshot => {
    const data = snapshot.data();
    if (data?.status && data.status !== 'connected') {
      onCallStatusChange?.(data.status);
    }
  });
  unsubscribers.push(unsubStatus);

  return localStream;
}

// ─── End Call ────────────────────────────────────────────────────────────────

export async function endCall(callId: string): Promise<void> {
  // Unsubscribe all Firestore listeners
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];

  // Close peer connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  // Stop local media tracks
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  remoteStream = null;

  // Update Firestore status
  if (callId) {
    try {
      await firestore().collection('calls').doc(callId).update({
        status: 'ended',
        endedAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error('[CallService] Error ending call in Firestore:', err);
    }
  }
}

// ─── Reject Call ─────────────────────────────────────────────────────────────

export async function rejectCall(callId: string): Promise<void> {
  try {
    await firestore().collection('calls').doc(callId).update({
      status: 'rejected',
      endedAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[CallService] Error rejecting call:', err);
  }
}

// ─── Listen for Incoming Calls ───────────────────────────────────────────────

export interface IncomingCallData {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  callType: 'audio' | 'video';
}

export function listenForIncomingCalls(
  userId: string,
  onIncomingCall: (call: IncomingCallData) => void,
): () => void {
  const unsubscribe = firestore()
    .collection('calls')
    .where('calleeId', '==', userId)
    .where('status', '==', 'ringing')
    .onSnapshot(
      snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            onIncomingCall({
              callId: change.doc.id,
              callerId: data.callerId,
              callerName: data.callerName,
              callerAvatar: data.callerAvatar,
              callType: data.callType,
            });
          }
        });
      },
      err => console.error('[CallService] Incoming call listener error:', err),
    );

  return unsubscribe;
}

// ─── Toggle Controls ─────────────────────────────────────────────────────────

export function toggleMute(muted: boolean): void {
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !muted;
    });
  }
}

export function toggleCamera(off: boolean): void {
  if (localStream) {
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !off;
    });
  }
}

export function switchCamera(): void {
  if (localStream) {
    localStream.getVideoTracks().forEach(track => {
      (track as any)._switchCamera?.();
    });
  }
}

export function toggleSpeaker(speakerOn: boolean): void {
  InCallManager.setForceSpeakerphoneOn(speakerOn);
}

export function startInCallManager(mediaType: 'audio' | 'video'): void {
  InCallManager.start({media: mediaType});
}

export function stopInCallManager(): void {
  InCallManager.stop();
}

// ─── Get Call History ────────────────────────────────────────────────────────

export interface CallHistoryItem {
  id: string;
  callerId: string;
  calleeId: string;
  callerName: string;
  callerAvatar: string;
  calleeName: string;
  calleeAvatar: string;
  callType: 'audio' | 'video';
  status: string;
  createdAt: FirebaseFirestoreTypes.Timestamp | null;
  endedAt: FirebaseFirestoreTypes.Timestamp | null;
}

export function listenForCallHistory(
  userId: string,
  onUpdate: (calls: CallHistoryItem[]) => void,
): () => void {
  // We query calls where user is caller OR callee
  // Firestore doesn't support OR queries on different fields natively,
  // so we use two separate listeners and merge results.
  const allCalls = new Map<string, CallHistoryItem>();

  const handleUpdate = () => {
    const sorted = Array.from(allCalls.values()).sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
    onUpdate(sorted);
  };

  const unsub1 = firestore()
    .collection('calls')
    .where('callerId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot(snapshot => {
      if (!snapshot) return;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        allCalls.set(doc.id, {
          id: doc.id,
          callerId: data.callerId,
          calleeId: data.calleeId,
          callerName: data.callerName,
          callerAvatar: data.callerAvatar,
          calleeName: data.calleeName || '',
          calleeAvatar: data.calleeAvatar || '',
          callType: data.callType,
          status: data.status,
          createdAt: data.createdAt,
          endedAt: data.endedAt || null,
        });
      });
      handleUpdate();
    });

  const unsub2 = firestore()
    .collection('calls')
    .where('calleeId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot(snapshot => {
      if (!snapshot) return;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        allCalls.set(doc.id, {
          id: doc.id,
          callerId: data.callerId,
          calleeId: data.calleeId,
          callerName: data.callerName,
          callerAvatar: data.callerAvatar,
          calleeName: data.calleeName || '',
          calleeAvatar: data.calleeAvatar || '',
          callType: data.callType,
          status: data.status,
          createdAt: data.createdAt,
          endedAt: data.endedAt || null,
        });
      });
      handleUpdate();
    });

  return () => {
    unsub1();
    unsub2();
  };
}
