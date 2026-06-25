import React, {useEffect, useRef} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainerRef} from '@react-navigation/native';
import {ThemeProvider} from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import {initNotifications, getFCMToken} from './src/services/NotificationService';
import {
  listenForIncomingCalls,
  IncomingCallData,
} from './src/services/CallService';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Global navigation ref for navigating outside of React components
export const navigationRef =
  React.createRef<NavigationContainerRef<any>>() as React.RefObject<NavigationContainerRef<any>>;

const App: React.FC = () => {
  const incomingCallListenerRef = useRef<(() => void) | null>(null);
  const appStateSubRef = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    initNotifications(remoteMessage => {
      const data = remoteMessage.data;
      if (data && data.type === 'message') {
        const senderId = data.senderId as string;
        if (senderId && navigationRef.current?.isReady()) {
          (navigationRef.current as any).navigate('ChatDetail', {uid: senderId});
        }
      }
    }).then(() => {
      console.log('[App] Notifications initialised');
    });
  }, []);

  // Presence tracking + incoming calls tied to auth state
  useEffect(() => {
    const unsubAuth = auth().onAuthStateChanged(user => {
      // Clean up previous listeners
      if (incomingCallListenerRef.current) {
        incomingCallListenerRef.current();
        incomingCallListenerRef.current = null;
      }
      if (appStateSubRef.current) {
        appStateSubRef.current.remove();
        appStateSubRef.current = null;
      }

      if (user) {
        const userRef = firestore().collection('users').doc(user.uid);

        // Mark user online immediately on sign-in / app open
        userRef.set({isOnline: true}, {merge: true}).catch(() => {});

        // Toggle online/offline as app moves between foreground and background
        appStateSubRef.current = AppState.addEventListener(
          'change',
          (nextState: AppStateStatus) => {
            const prev = appStateRef.current;
            appStateRef.current = nextState;
            if (prev === 'active' && nextState.match(/inactive|background/)) {
              userRef
                .set(
                  {isOnline: false, lastSeen: firestore.FieldValue.serverTimestamp()},
                  {merge: true},
                )
                .catch(() => {});
            } else if (prev.match(/inactive|background/) && nextState === 'active') {
              userRef.set({isOnline: true}, {merge: true}).catch(() => {});
            }
          },
        );

        // Save FCM token for push notifications
        getFCMToken().then(token => {
          if (token) {
            userRef
              .set({fcmToken: token}, {merge: true})
              .catch(err => console.error('Failed to save FCM token:', err));
          }
        });

        incomingCallListenerRef.current = listenForIncomingCalls(
          user.uid,
          (call: IncomingCallData) => {
            console.log('[App] Incoming call from:', call.callerName);
            if (navigationRef.current?.isReady()) {
              (navigationRef.current as any).navigate('IncomingCall', {
                callId: call.callId,
                callerName: call.callerName,
                callerAvatar: call.callerAvatar,
                callType: call.callType,
              });
            }
          },
        );
      }
    });

    return () => {
      unsubAuth();
      if (appStateSubRef.current) {
        appStateSubRef.current.remove();
      }
      if (incomingCallListenerRef.current) {
        incomingCallListenerRef.current();
      }
      const currentUser = auth().currentUser;
      if (currentUser) {
        firestore()
          .collection('users')
          .doc(currentUser.uid)
          .set(
            {isOnline: false, lastSeen: firestore.FieldValue.serverTimestamp()},
            {merge: true},
          )
          .catch(() => {});
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppNavigator navigationRef={navigationRef} />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
