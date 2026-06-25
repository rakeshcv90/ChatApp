import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Image,
  Vibration,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import InCallManager from 'react-native-incall-manager';
import {rejectCall} from '../services/CallService';
import firestore from '@react-native-firebase/firestore';
import notifee from '@notifee/react-native';

interface IncomingCallScreenProps {
  navigation: any;
  route: any;
}

const IncomingCallScreen: React.FC<IncomingCallScreenProps> = ({
  navigation,
  route,
}) => {
  const {callId, callerName, callerAvatar, callType} = route.params;
  const insets = useSafeAreaInsets();

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulse2Anim = useRef(new Animated.Value(1)).current;
  const pulse3Anim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const buttonBounce = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Start ringtone
    InCallManager.startRingtone('_DEFAULT_');

    // Vibrate pattern: vibrate 500ms, pause 1000ms, repeat
    const vibrateInterval = setInterval(() => {
      Vibration.vibrate([0, 500, 500, 500]);
    }, 2000);

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(buttonBounce, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsing rings animation
    Animated.loop(
      Animated.stagger(400, [
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulse2Anim, {
            toValue: 1.6,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulse2Anim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulse3Anim, {
            toValue: 1.8,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulse3Anim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();

    // ✅ KEY FIX: Listen for call status changes in Firestore.
    // When the caller hangs up OR the user declines from the notification
    // (background handler sets status='rejected'), stop ringing immediately.
    const stopRinging = () => {
      clearInterval(vibrateInterval);
      Vibration.cancel();
      InCallManager.stopRingtone();
      // Also dismiss any Notifee notification with this callId
      notifee.cancelNotification(callId).catch(() => {});
    };

    const unsubCall = firestore()
      .collection('calls')
      .doc(callId)
      .onSnapshot(snapshot => {
        const data = snapshot.data();
        if (!data) return;
        if (data.status === 'rejected' || data.status === 'ended' || data.status === 'cancelled') {
          stopRinging();
          // Navigate back to the previous screen
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }
      });

    return () => {
      unsubCall();
      clearInterval(vibrateInterval);
      Vibration.cancel();
      InCallManager.stopRingtone();
    };
  }, [fadeAnim, slideAnim, buttonBounce, pulseAnim, pulse2Anim, pulse3Anim, callId, navigation]);

  const handleAccept = () => {
    Vibration.cancel();
    InCallManager.stopRingtone();
    navigation.replace('Call', {
      callId,
      name: callerName,
      avatar: callerAvatar,
      callType,
      isIncoming: true,
    });
  };

  const handleDecline = async () => {
    Vibration.cancel();
    InCallManager.stopRingtone();
    await rejectCall(callId);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent />

      {/* Background gradient effect */}
      <View style={styles.bgGlow} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{translateY: slideAnim}],
            paddingTop: insets.top + verticalScale(60),
          },
        ]}>
        {/* Call type label */}
        <View style={styles.callTypeChip}>
          <Ionicons
            name={callType === 'video' ? 'videocam' : 'call'}
            size={moderateScale(14)}
            color="#8B5CF6"
          />
          <Text style={styles.callTypeText}>
            {callType === 'video' ? 'Incoming Video Call' : 'Incoming Audio Call'}
          </Text>
        </View>

        {/* Caller avatar with pulse rings */}
        <View style={styles.avatarSection}>
          <Animated.View
            style={[
              styles.pulseRing,
              {transform: [{scale: pulseAnim}], opacity: 0.15},
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRing2,
              {transform: [{scale: pulse2Anim}], opacity: 0.1},
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRing3,
              {transform: [{scale: pulse3Anim}], opacity: 0.05},
            ]}
          />
          <View style={styles.avatarBorder}>
            <Image source={{uri: callerAvatar}} style={styles.avatar} />
          </View>
        </View>

        {/* Caller name */}
        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.callingText}>is calling you...</Text>
      </Animated.View>

      {/* Action buttons */}
      <Animated.View
        style={[
          styles.actionsContainer,
          {
            paddingBottom: insets.bottom + verticalScale(50),
            transform: [{scale: buttonBounce}],
          },
        ]}>
        {/* Decline */}
        <View style={styles.actionWrapper}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.declineBtn]}
            onPress={handleDecline}
            activeOpacity={0.7}>
            <Ionicons
              name="call"
              size={moderateScale(28)}
              color="#FFFFFF"
              style={styles.declineIcon}
            />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Decline</Text>
        </View>

        {/* Accept */}
        <View style={styles.actionWrapper}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={handleAccept}
            activeOpacity={0.7}>
            <Ionicons
              name={callType === 'video' ? 'videocam' : 'call'}
              size={moderateScale(28)}
              color="#FFFFFF"
            />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Accept</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  bgGlow: {
    position: 'absolute',
    top: -scale(100),
    left: '50%',
    marginLeft: -scale(200),
    width: scale(400),
    height: scale(400),
    borderRadius: scale(200),
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  callTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(20),
    gap: scale(6),
    marginBottom: verticalScale(40),
  },
  callTypeText: {
    color: '#A78BFA',
    fontSize: moderateScale(13),
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  avatarSection: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(30),
  },
  pulseRing: {
    position: 'absolute',
    width: scale(160),
    height: scale(160),
    borderRadius: scale(80),
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  pulseRing2: {
    width: scale(190),
    height: scale(190),
    borderRadius: scale(95),
  },
  pulseRing3: {
    width: scale(220),
    height: scale(220),
    borderRadius: scale(110),
  },
  avatarBorder: {
    width: scale(130),
    height: scale(130),
    borderRadius: scale(65),
    borderWidth: 3,
    borderColor: '#8B5CF6',
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  callerName: {
    color: '#F8FAFC',
    fontSize: moderateScale(28),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  callingText: {
    color: '#94A3B8',
    fontSize: moderateScale(15),
    fontWeight: '500',
    marginTop: verticalScale(6),
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: scale(50),
  },
  actionWrapper: {
    alignItems: 'center',
    gap: verticalScale(12),
  },
  actionBtn: {
    width: scale(68),
    height: scale(68),
    borderRadius: scale(34),
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  declineBtn: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  declineIcon: {
    transform: [{rotate: '135deg'}],
  },
  acceptBtn: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  actionLabel: {
    color: '#94A3B8',
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
});

export default IncomingCallScreen;
