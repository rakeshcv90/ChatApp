import RNCallKeep from 'react-native-callkeep';
import {Platform} from 'react-native';
import {rejectCall} from './CallService';
// Import navigation ref to redirect after answering from background
import {navigationRef} from '../../App';

export const callKeepOptions = {
  ios: {
    appName: 'ChatApp',
  },
  android: {
    alertTitle: 'Permissions required',
    alertDescription: 'This application needs to access your phone accounts',
    cancelButton: 'Cancel',
    okButton: 'ok',
    imageName: 'phone_account_icon',
    additionalPermissions: [],
    foregroundService: {
      channelId: 'com.chatapp.calls',
      channelName: 'Foreground service for calls',
      notificationTitle: 'ChatApp is running on background',
      notificationIcon: 'Path to the resource icon of the notification',
    },
  },
};

let isSetup = false;

export function setupCallKeep() {
  if (isSetup) return;
  RNCallKeep.setup(callKeepOptions)
    .then(accepted => {
      console.log('[CallKeep] Setup accepted:', accepted);
      isSetup = true;
    })
    .catch(err => console.error('[CallKeep] Setup error:', err));
}

// ─── Listeners ───────────────────────────────────────────────────────────────

RNCallKeep.addEventListener('answerCall', ({callUUID}) => {
  console.log('[CallKeep] Answered call:', callUUID);
  // Tell CallKeep we answered
  // We need to wait for React to be ready if app was killed, but CallKeep caches actions.
  if (navigationRef.current?.isReady()) {
    // Navigate to CallScreen
    // Ideally we pass caller info here. For simplicity, we can fetch from Firestore or pass it via CallKeep handles
  }
});

RNCallKeep.addEventListener('endCall', async ({callUUID}) => {
  console.log('[CallKeep] Rejected/Ended call:', callUUID);
  RNCallKeep.endCall(callUUID);
  // Mark in Firestore as rejected
  try {
    await rejectCall(callUUID);
  } catch (e) {
    console.warn(e);
  }
});
