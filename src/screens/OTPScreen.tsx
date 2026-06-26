import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Platform,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import BackgroundDecoration from '../components/BackgroundDecoration';
import firestore from '@react-native-firebase/firestore';
import AppLoader from '../components/AppLoader';
import Ionicons from 'react-native-vector-icons/Ionicons';

const OTP_LENGTH = 6;
const RESEND_TIMEOUT = 60; // seconds

interface OTPScreenProps {
  navigation: any;
  route: {
    params: {
      phoneNumber: string;
      displayPhone: string;
    };
  };
}

const OTPScreen: React.FC<OTPScreenProps> = ({ navigation, route }) => {
  const { phoneNumber, displayPhone } = route.params;
  const { colors, isDark } = useTheme();
  const { confirmOTP, sendOTP } = useAuth();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_TIMEOUT);

  // Refs for each OTP input box
  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));

  // ── Animations ──────────────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(verticalScale(30))).current;
  const boxScale = useRef(new Animated.Value(0.8)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(boxScale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Auto-focus first box
      inputRefs.current[0]?.focus();
    });
  }, [fadeAnim, slideAnim, boxScale]);

  // ── Resend countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (resendTimer <= 0) {
      return;
    }
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 12,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -12,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ── Handle OTP input per box ────────────────────────────────────────────────
  const handleChange = (text: string, index: number) => {
    const char = text.replace(/[^0-9]/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);

    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits filled
    if (char && index === OTP_LENGTH - 1) {
      const fullOtp = [...newOtp.slice(0, OTP_LENGTH - 1), char].join('');
      if (fullOtp.length === OTP_LENGTH) {
        handleVerify(fullOtp);
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── Verify OTP ──────────────────────────────────────────────────────────────
  const handleVerify = useCallback(
    async (code?: string) => {
      const otpCode = code ?? otp.join('');
      if (otpCode.length < OTP_LENGTH) {
        triggerShake();
        Alert.alert('Incomplete', 'Please enter all 6 digits of your OTP.');
        return;
      }

      setLoading(true);
      try {
        const result = await confirmOTP(otpCode, phoneNumber);
        setLoading(false);

        const firebaseUser = result.user;

        // Check if user profile document exists in Firestore
        let profileExists = false;
        try {
          const userDoc = await firestore()
            .collection('users')
            .doc(firebaseUser.uid)
            .get();
          profileExists = userDoc.exists;
        } catch (dbErr) {
          console.warn('[OTP] Failed to query Firestore users:', dbErr);
          profileExists = !!firebaseUser.displayName;
        }

        if (profileExists) {
          navigation.reset({index: 0, routes: [{name: 'Home'}]});
        } else {
          navigation.reset({index: 0, routes: [{name: 'SignUp', params: {isNewUser: true}}]});
        }
      } catch (error: any) {
        setLoading(false);
        triggerShake();
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        let message = 'Invalid OTP. Please check and try again.';
        if (error.code === 'functions/unauthenticated') {
          message = 'Incorrect OTP. Please try again.';
        } else if (error.code === 'functions/deadline-exceeded') {
          message = 'OTP has expired. Please request a new one.';
        } else if (error.code === 'functions/resource-exhausted') {
          message = 'Too many failed attempts. Please request a new OTP.';
        } else if (error.code === 'functions/not-found') {
          message = 'No OTP found for this number. Please request a new one.';
        } else if (error.message) {
          message = error.message;
        }
        Alert.alert('Verification Failed', message);
      }
    },
    [otp, confirmOTP, phoneNumber, navigation],
  );

  // ── Resend OTP ──────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendTimer > 0) {
      return;
    }
    setLoading(true);
    try {
      await sendOTP(phoneNumber);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      setResendTimer(RESEND_TIMEOUT);
      setLoading(false);
      Alert.alert('OTP Sent', 'A new verification code has been sent.');
    } catch {
      setLoading(false);
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    }
  };

  const filledCount = otp.filter(d => d !== '').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgDark }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <BackgroundDecoration />
      <AppLoader visible={loading} message="Verifying..." />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop:
              Platform.OS === 'ios'
                ? verticalScale(60)
                : (StatusBar.currentHeight ?? 24) + verticalScale(16),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={[
            styles.backBtn,
            { backgroundColor: colors.bgCard, borderColor: colors.divider },
          ]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name="arrow-back"
            size={moderateScale(20)}
            color={colors.textPrimary}
          />
        </TouchableOpacity>

        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View
            style={[
              styles.iconBox,
              { backgroundColor: colors.accent, shadowColor: colors.accent },
            ]}
          >
            <Text style={styles.iconEmoji}>🔐</Text>
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Verify your number
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            We sent a 6-digit code to
          </Text>
          <Text style={[styles.phoneDisplay, { color: colors.accent }]}>
            {displayPhone}
          </Text>
        </Animated.View>

        {/* OTP Boxes */}
        <Animated.View
          style={[
            styles.otpRow,
            { transform: [{ translateX: shakeAnim }, { scale: boxScale }] },
          ]}
        >
          {otp.map((digit, index) => (
            <View
              key={index}
              style={[
                styles.otpBox,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: digit
                    ? colors.accent
                    : index === filledCount
                    ? colors.accent
                    : colors.divider,
                  borderWidth: digit || index === filledCount ? 2 : 1.5,
                  shadowColor: digit ? colors.accent : 'transparent',
                },
              ]}
            >
              <TextInput
                ref={(ref: TextInput | null) => {
                  inputRefs.current[index] = ref;
                }}
                style={[styles.otpInput, { color: colors.textPrimary }]}
                value={digit}
                onChangeText={text => handleChange(text, index)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, index)
                }
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                selectTextOnFocus
              />
            </View>
          ))}
        </Animated.View>

        {/* Progress bar */}
        <View
          style={[styles.progressTrack, { backgroundColor: colors.divider }]}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.accent,
                width: `${(filledCount / OTP_LENGTH) * 100}%`,
              },
            ]}
          />
        </View>

        {/* Verify button */}
        <TouchableOpacity
          style={[
            styles.verifyBtn,
            {
              backgroundColor:
                filledCount === OTP_LENGTH ? colors.accent : colors.bgCard,
              borderColor:
                filledCount === OTP_LENGTH ? colors.accent : colors.divider,
              shadowColor:
                filledCount === OTP_LENGTH ? colors.accent : 'transparent',
            },
          ]}
          onPress={() => handleVerify()}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.verifyBtnText,
              { color: filledCount === OTP_LENGTH ? '#fff' : colors.textMuted },
            ]}
          >
            Verify OTP
          </Text>
          <Ionicons
            name="checkmark-circle"
            size={moderateScale(20)}
            color={filledCount === OTP_LENGTH ? '#fff' : colors.textMuted}
            style={styles.verifyIcon}
          />
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={[styles.resendLabel, { color: colors.textSecondary }]}>
            Didn't receive it?{'  '}
          </Text>
          {resendTimer > 0 ? (
            <Text style={[styles.timerText, { color: colors.textMuted }]}>
              Resend in {resendTimer}s
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={[styles.resendLink, { color: colors.accent }]}>
                Resend OTP
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: scale(24),
    paddingBottom: verticalScale(40),
  },
  backBtn: {
    width: scale(44),
    height: scale(44),
    borderRadius: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: verticalScale(24),
  },
  header: { alignItems: 'center', marginBottom: verticalScale(40) },
  iconBox: {
    width: scale(80),
    height: scale(80),
    borderRadius: moderateScale(24),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(20),
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  iconEmoji: { fontSize: moderateScale(38) },
  title: {
    fontSize: moderateScale(26),
    fontWeight: '800',
    marginBottom: verticalScale(8),
    letterSpacing: -0.3,
  },
  subtitle: { fontSize: moderateScale(14), marginBottom: verticalScale(4) },
  phoneDisplay: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(20),
  },
  otpBox: {
    width: scale(46),
    height: scale(56),
    borderRadius: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  otpInput: {
    width: '100%',
    height: '100%',
    fontSize: moderateScale(22),
    fontWeight: '800',
    textAlign: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginBottom: verticalScale(28),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(16),
    paddingVertical: verticalScale(16),
    borderWidth: 1.5,
    marginBottom: verticalScale(20),
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  verifyBtnText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  verifyIcon: { marginLeft: scale(8) },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendLabel: { fontSize: moderateScale(13) },
  resendLink: { fontSize: moderateScale(13), fontWeight: '700' },
  timerText: { fontSize: moderateScale(13), fontWeight: '600' },
});

export default OTPScreen;
