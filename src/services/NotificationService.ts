import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import {Platform} from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
  AndroidStyle,
} from '@notifee/react-native';

// ─── Channel IDs ──────────────────────────────────────────────────────────────
const CALL_CHANNEL_ID = 'incoming-calls';
const MESSAGE_CHANNEL_ID = 'chat-messages';

// ─── Create channels once at startup ─────────────────────────────────────────
// Must be idempotent — safe to call multiple times.
export async function createNotificationChannels(): Promise<void> {
  // High-priority channel for incoming calls (shows full-screen on lock screen)
  await notifee.createChannel({
    id: CALL_CHANNEL_ID,
    name: 'Incoming Calls',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500],
  });

  // Normal-priority channel for chat messages
  await notifee.createChannel({
    id: MESSAGE_CHANNEL_ID,
    name: 'Chat Messages',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  // Also request Notifee permissions (handles Android 13+ POST_NOTIFICATIONS)
  await notifee.requestPermission();

  if (enabled) {
    console.log('[FCM] Notification permission granted:', authStatus);
  } else {
    console.log('[FCM] Notification permission denied');
  }
  return enabled;
}

// ─── Token ────────────────────────────────────────────────────────────────────

export async function getFCMToken(): Promise<string | null> {
  try {
    // Register device for remote messages if not already registered (required on iOS)
    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      console.log('[FCM] Registering device for remote messages...');
      await messaging().registerDeviceForRemoteMessages();
    }

    // On iOS, APNS token must be available first
    if (Platform.OS === 'ios') {
      const apnsToken = await messaging().getAPNSToken();
      if (!apnsToken) {
        console.log('[FCM] APNS token not yet available');
        return null;
      }
    }
    const token = await messaging().getToken();
    console.log('[FCM] Device token:', token);
    return token;
  } catch (error) {
    console.error('[FCM] Failed to get token:', error);
    return null;
  }
}

// ─── Show Call Notification ───────────────────────────────────────────────────
// Shared helper used in both foreground and background handlers.

export async function displayIncomingCallNotification(
  callId: string,
  callerName: string,
  callType: string,
): Promise<void> {
  await notifee.displayNotification({
    id: callId || 'incoming-call',
    title: '📞 Incoming Call',
    body: `${callerName} is calling you...`,
    android: {
      channelId: CALL_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      category: AndroidCategory.CALL,
      visibility: AndroidVisibility.PUBLIC,
      ongoing: true,        // Cannot be swiped away
      autoCancel: false,
      sound: 'default',
      vibrationPattern: [300, 500],
      smallIcon: 'ic_notification', // ✅ Custom white chat bubble icon
      // ✅ KEY FIX: fullScreenAction makes it appear over lock screen / when app is killed
      fullScreenAction: {
        id: 'default',
        launchActivity: 'default',
      },
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
      actions: [
        {
          title: '✅ Accept',
          pressAction: {id: 'accept', launchActivity: 'default'},
        },
        {
          title: '❌ Decline',
          pressAction: {id: 'decline'},
        },
      ],
    },
    data: {
      callId: callId || '',
      callerName: callerName || '',
      callType: callType || 'audio',
    },
  });
}

// ─── Show Message Notification ────────────────────────────────────────────────

export async function displayMessageNotification(
  chatId: string,
  senderName: string,
  messageText: string,
  senderId: string,
): Promise<void> {
  await notifee.displayNotification({
    id: `msg-${chatId}`,
    title: senderName || 'New Message',
    body: messageText || '📷 Image',
    android: {
      channelId: MESSAGE_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      smallIcon: 'ic_notification', // ✅ Custom white chat bubble icon
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
      style: {
        type: AndroidStyle.BIGTEXT,
        text: messageText || '📷 Image',
      },
    },
    data: {
      type: 'message',
      chatId: chatId || '',
      senderId: senderId || '',
    },
  });
}

// ─── Foreground Handler ───────────────────────────────────────────────────────

export function setupForegroundHandler(): () => void {
  const unsubscribe = messaging().onMessage(
    async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('[FCM] Foreground message:', remoteMessage);
      const data = remoteMessage.data;

      if (data?.type === 'call') {
        // App is in foreground — the Firestore listener in App.tsx already
        // navigates to IncomingCallScreen. Do NOT show a notification here
        // or you get double ringing (in-app UI + notification).
        return;
      } else if (data?.type === 'message') {
        // Show chat notification in foreground (instead of blocking Alert)
        await displayMessageNotification(
          data.chatId as string,
          (data.senderName as string) || 'New Message',
          (data.messageText as string) || '',
          data.senderId as string,
        );
      }
    },
  );
  return unsubscribe;
}

// ─── Background / Quit Handler ────────────────────────────────────────────────
// ✅ KEY: Must be registered early (outside React tree) — called from index.js
// This fires when the app is in BACKGROUND or KILLED state.

export function setupBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(
    async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('[FCM] Background/Killed message received:', remoteMessage);

      const data = remoteMessage.data;
      if (!data) return;

      if (data.type === 'call') {
        // ── Incoming call ──────────────────────────────────────────────────
        const callerName = (data.callerName as string) || 'Someone';
        const callId = (data.callId as string) || 'incoming-call';
        const callType = (data.callType as string) || 'audio';

        // Create channel here too — background handler runs in isolation
        await notifee.createChannel({
          id: CALL_CHANNEL_ID,
          name: 'Incoming Calls',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
          vibrationPattern: [300, 500],
        });

        await displayIncomingCallNotification(callId, callerName, callType);

      } else if (data.type === 'message') {
        // ── Chat message ───────────────────────────────────────────────────
        const senderName = (data.senderName as string) || 'New Message';
        const messageText = (data.messageText as string) || '';
        const chatId = (data.chatId as string) || '';
        const senderId = (data.senderId as string) || '';

        // Create channel in background handler too
        await notifee.createChannel({
          id: MESSAGE_CHANNEL_ID,
          name: 'Chat Messages',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
        });

        await displayMessageNotification(chatId, senderName, messageText, senderId);
      }
    },
  );
}

// ─── Notification Open Handler ────────────────────────────────────────────────

export function setupNotificationOpenedHandler(
  onOpen: (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => void,
): () => void {
  // App opened from background state by tapping notification
  const unsubscribe = messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('[FCM] Notification opened app:', remoteMessage);
    onOpen(remoteMessage);
  });

  // Check if app was opened from quit state by notification
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('[FCM] App opened from quit state:', remoteMessage);
        onOpen(remoteMessage);
      }
    });

  return unsubscribe;
}

// ─── Token Refresh Handler ────────────────────────────────────────────────────

export function setupTokenRefreshHandler(): () => void {
  return messaging().onTokenRefresh(token => {
    console.log('[FCM] Token refreshed:', token);
    // TODO: Send new token to your backend server here
  });
}

// ─── Bootstrap: initialise all handlers ──────────────────────────────────────

export async function initNotifications(
  onNotificationOpen?: (
    remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  ) => void,
): Promise<void> {
  await requestNotificationPermission();
  await createNotificationChannels(); // ✅ Create channels upfront
  await getFCMToken();
  setupForegroundHandler();
  setupTokenRefreshHandler();
  if (onNotificationOpen) {
    setupNotificationOpenedHandler(onNotificationOpen);
  }
}
