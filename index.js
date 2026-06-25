/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {setupBackgroundHandler} from './src/services/NotificationService';
import notifee, {EventType} from '@notifee/react-native';
import firestore from '@react-native-firebase/firestore';

// Handle background notification events (e.g., Decline call)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'decline') {
    console.log('[Notifee Background] Call declined');
    // Dismiss the notification
    if (detail.notification?.id) {
      await notifee.cancelNotification(detail.notification.id);
    }
    // Update firestore to reject the call
    const callId = detail.notification?.data?.callId;
    if (callId) {
      await firestore().collection('calls').doc(callId).update({
        status: 'rejected'
      });
    }
  }
});

// Must be registered outside the React tree (before component mount)
setupBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);

