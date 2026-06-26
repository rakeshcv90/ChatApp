import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Image,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {RTCView, MediaStream} from 'react-native-webrtc';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import {
  startCall,
  answerCall,
  endCall,
  toggleMute,
  toggleCamera,
  switchCamera,
  requestMediaPermissions,
  toggleSpeaker,
  startInCallManager,
  stopInCallManager,
} from '../services/CallService';

interface CallScreenProps {
  navigation?: any;
  route?: any;
}

const CallScreen: React.FC<CallScreenProps> = ({navigation, route}) => {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const {
    name,
    avatar,
    callType,
    callId: incomingCallId,
    isIncoming,
    uid: calleeUid,
  } = route.params;

  // Call state
  const [callState, setCallState] = useState<
    'ringing' | 'connecting' | 'connected' | 'ended'
  >(isIncoming ? 'connecting' : 'ringing');
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(callType === 'video');
  const [videoOff, setVideoOff] = useState(false);
  const [callId, setCallId] = useState<string>(incomingCallId || '');

  // Streams
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Refs to track if call is active
  const callActive = useRef(true);
  const hasEnded = useRef(false);

  // ── Initiate or answer call ──
  useEffect(() => {
    let mounted = true;

    const setupCall = async () => {
      // Request Bluetooth permission on Android 12+ so audio can route to headsets
      if (Platform.OS === 'android' && Platform.Version >= 31) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        );
      }

      // Start InCallManager — auto:true lets it route to Bluetooth automatically
      startInCallManager(callType);
      // Video calls default to speaker on; audio calls default to earpiece/bluetooth
      toggleSpeaker(callType === 'video');

      const permGranted = await requestMediaPermissions(callType === 'video');
      if (!permGranted) {
        console.warn('[CallScreen] Permissions denied, requesting getUserMedia anyway...');
        // Don't block — getUserMedia will fail with a proper error if really denied
      }

      if (isIncoming && incomingCallId) {
        // ── Answering an incoming call ──
        const stream = await answerCall({
          callId: incomingCallId,
          callType,
          onRemoteStream: (remote: MediaStream) => {
            if (mounted) {
              setRemoteStreamUrl((remote as any).toURL());
              setCallState('connected');
            }
          },
          onConnectionStateChange: (state: string) => {
            console.log('[CallScreen] Connection:', state);
            if (state === 'connected' && mounted) {
              setCallState('connected');
            }
            if (
              (state === 'disconnected' || state === 'failed') &&
              mounted
            ) {
              handleEndCall();
            }
          },
          onCallStatusChange: (status: string) => {
            if (status === 'ended' && mounted) {
              handleEndCall();
            }
          },
        });

        if (stream && mounted) {
          localStreamRef.current = stream;
          setLocalStreamUrl((stream as any).toURL());
          setCallState('connected');
        }
      } else if (calleeUid) {
        // ── Initiating an outgoing call ──
        const myUid = auth().currentUser?.uid;
        const myName =
          auth().currentUser?.displayName || 'Unknown';
        const myAvatar =
          auth().currentUser?.photoURL ||
          'https://i.pravatar.cc/150?img=33';

        if (!myUid) return;

        setCallState('ringing');

        const result = await startCall({
          callerId: myUid,
          calleeId: calleeUid,
          callerName: myName,
          callerAvatar: myAvatar,
          calleeName: name,
          calleeAvatar: avatar,
          callType,
          onRemoteStream: (remote: MediaStream) => {
            if (mounted) {
              setRemoteStreamUrl((remote as any).toURL());
              setCallState('connected');
            }
          },
          onConnectionStateChange: (state: string) => {
            console.log('[CallScreen] Connection:', state);
            if (state === 'connected' && mounted) {
              setCallState('connected');
            }
            if (
              (state === 'disconnected' || state === 'failed') &&
              mounted
            ) {
              handleEndCall();
            }
          },
          onCallStatusChange: (status: string) => {
            if ((status === 'rejected' || status === 'ended') && mounted) {
              setCallState('ended');
              setTimeout(() => {
                if (mounted) handleEndCall();
              }, 1500);
            }
            if (status === 'connected' && mounted) {
              setCallState('connecting');
            }
          },
        });

        if (result && mounted) {
          setCallId(result.callId);
          localStreamRef.current = result.localStream;
          setLocalStreamUrl((result.localStream as any).toURL());
        }
      }
    };

    setupCall();

    return () => {
      mounted = false;
      callActive.current = false;
      stopInCallManager();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer counter when connected
  useEffect(() => {
    if (callState !== 'connected') return;
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callState]);

  // Breathing pulse animation for ringing/connecting
  useEffect(() => {
    if (callState === 'connected' || callState === 'ended') {
      pulseAnim.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [callState, pulseAnim]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs
      .toString()
      .padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (callState === 'ended') return 'Call Ended';
    if (callState === 'ringing') return 'Ringing...';
    if (callState === 'connecting') return 'Connecting...';
    return formatTime(seconds);
  };

  const handleEndCall = useCallback(async () => {
    if (hasEnded.current) return;
    hasEnded.current = true;
    await endCall(callId);
    navigation.goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, navigation]);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    toggleMute(next);
  };

  const handleToggleCamera = () => {
    const next = !videoOff;
    setVideoOff(next);
    toggleCamera(next);
  };

  const handleSwitchCamera = () => {
    switchCamera();
  };

  return (
    <View style={[styles.container, {backgroundColor: '#0F172A'}]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent />

      {/* ── Remote Video (fullscreen) ── */}
      {callType === 'video' && remoteStreamUrl ? (
        <RTCView
          streamURL={remoteStreamUrl}
          style={styles.remoteVideo}
          objectFit="cover"
          mirror={false}
          zOrder={0}
        />
      ) : callType === 'video' && !videoOff ? (
        // Show avatar as blurred background while connecting
        <View style={styles.videoBackground}>
          <Image
            source={{uri: avatar}}
            style={styles.fullscreenVideo}
            blurRadius={8}
          />
          <View style={styles.videoOverlay} />
        </View>
      ) : null}

      {/* ── Local Video PIP ── */}
      {callType === 'video' &&
        localStreamUrl &&
        !videoOff && (
          <TouchableOpacity
            style={[styles.pipContainer, {top: insets.top + verticalScale(16)}]}
            onPress={handleSwitchCamera}
            activeOpacity={0.9}>
            <RTCView
              streamURL={localStreamUrl}
              style={styles.pipVideo}
              objectFit="cover"
              mirror={true}
              zOrder={1}
            />
          </TouchableOpacity>
        )}

      {/* ── Main Info Section ── */}
      <View style={[styles.safeArea, {paddingTop: insets.top}]}>
        <View style={styles.infoContainer}>
          <Text style={styles.callTypeLabel}>
            {callType === 'video' ? 'VIDEO CALL' : 'AUDIO CALL'}
          </Text>
          <Text style={styles.callerName}>{name}</Text>
          <Text
            style={[
              styles.callStatus,
              {
                color:
                  callState === 'connected'
                    ? '#10B981'
                    : callState === 'ended'
                    ? '#EF4444'
                    : '#94A3B8',
              },
            ]}>
            {getStatusText()}
          </Text>

          {/* User Avatar (shown for audio calls, or video when not connected) */}
          {(callType === 'audio' ||
            videoOff ||
            callState !== 'connected') && (
            <View style={styles.avatarWrapper}>
              <Animated.View
                style={[
                  styles.avatarBorder,
                  {
                    borderColor: colors.accent,
                    transform: [{scale: pulseAnim}],
                    opacity: callState !== 'connected' ? 0.4 : 0.1,
                  },
                ]}
              />
              <Image source={{uri: avatar}} style={styles.avatar} />
            </View>
          )}
        </View>

        {/* ── Action Controls Bar ── */}
        <View
          style={[
            styles.controlsBar,
            {paddingBottom: insets.bottom + verticalScale(30)},
          ]}>
          {/* Mute button */}
          <TouchableOpacity
            style={[
              styles.controlBtn,
              {
                backgroundColor: muted
                  ? 'white'
                  : 'rgba(255,255,255,0.15)',
              },
            ]}
            onPress={handleToggleMute}>
            <Ionicons
              name={muted ? 'mic-off' : 'mic'}
              size={moderateScale(24)}
              color={muted ? '#0F172A' : 'white'}
            />
          </TouchableOpacity>

          {/* Video Toggle button (only in Video call) */}
          {callType === 'video' && (
            <TouchableOpacity
              style={[
                styles.controlBtn,
                {
                  backgroundColor: videoOff
                    ? 'white'
                    : 'rgba(255,255,255,0.15)',
                },
              ]}
              onPress={handleToggleCamera}>
              <Ionicons
                name={videoOff ? 'videocam-off' : 'videocam'}
                size={moderateScale(24)}
                color={videoOff ? '#0F172A' : 'white'}
              />
            </TouchableOpacity>
          )}

          {/* Switch camera (only in Video call when connected) */}
          {callType === 'video' && callState === 'connected' && (
            <TouchableOpacity
              style={[
                styles.controlBtn,
                {backgroundColor: 'rgba(255,255,255,0.15)'},
              ]}
              onPress={handleSwitchCamera}>
              <Ionicons
                name="camera-reverse"
                size={moderateScale(24)}
                color="white"
              />
            </TouchableOpacity>
          )}

          {/* Speaker button */}
          <TouchableOpacity
            style={[
              styles.controlBtn,
              {
                backgroundColor: speaker
                  ? 'white'
                  : 'rgba(255,255,255,0.15)',
              },
            ]}
            onPress={() => {
              const next = !speaker;
              setSpeaker(next);
              toggleSpeaker(next);
            }}>
            <Ionicons
              name={speaker ? 'volume-high' : 'volume-medium'}
              size={moderateScale(24)}
              color={speaker ? '#0F172A' : 'white'}
            />
          </TouchableOpacity>

          {/* End Call button (Large Red) */}
          <TouchableOpacity
            style={[styles.controlBtn, styles.endCallBtn]}
            onPress={handleEndCall}>
            <Ionicons name="call" size={moderateScale(26)} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Remote video (fullscreen) ──
  remoteVideo: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  videoBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
    opacity: 0.5,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  // ── Local video PIP ──
  pipContainer: {
    position: 'absolute',
    right: scale(16),
    zIndex: 10,
    width: scale(100),
    height: scale(140),
    borderRadius: moderateScale(14),
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  pipVideo: {
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  infoContainer: {
    alignItems: 'center',
    paddingTop: verticalScale(50),
    flex: 1,
  },
  callTypeLabel: {
    color: '#94A3B8',
    fontSize: moderateScale(12),
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: verticalScale(12),
  },
  callerName: {
    color: 'white',
    fontSize: moderateScale(28),
    fontWeight: '800',
    marginBottom: verticalScale(6),
  },
  callStatus: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  avatarWrapper: {
    marginTop: verticalScale(50),
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBorder: {
    position: 'absolute',
    width: scale(170),
    height: scale(170),
    borderRadius: scale(85),
    borderWidth: 2,
  },
  avatar: {
    width: scale(140),
    height: scale(140),
    borderRadius: scale(70),
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: scale(20),
  },
  controlBtn: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  endCallBtn: {
    backgroundColor: '#EF4444',
    width: scale(60),
    height: scale(60),
    borderRadius: scale(30),
    transform: [{rotate: '135deg'}],
    shadowColor: '#EF4444',
  },
});

export default CallScreen;
