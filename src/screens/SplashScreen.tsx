import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface SplashScreenProps {
  navigation: any;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user, authLoading } = useAuth();

  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(verticalScale(30))).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;
  const ring2Scale = useRef(new Animated.Value(0)).current;
  const ring2Opacity = useRef(new Animated.Value(0.6)).current;
  const bottomTextOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ringAnimation = Animated.loop(
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 3,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    const ring2Animation = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(ring2Scale, {
            toValue: 3,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(ring2Opacity, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
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

    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(titleTranslateY, {
          toValue: 0,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(bottomTextOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    ringAnimation.start();
    ring2Animation.start();
    pulseAnimation.start();

    // Wait for auth to resolve, then route accordingly
    const timer = setTimeout(() => {
      console.log('SplashScreen: authLoading:', authLoading, );
      // authLoading is false once Firebase resolves the persisted session
      if (!authLoading) {
        navigation.replace(user ? 'Home' : 'Login');
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
      ringAnimation.stop();
      ring2Animation.stop();
      pulseAnimation.stop();
    };
  }, [navigation, user, authLoading]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgDark }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgDark} />

      {/* Decorative circles */}
      <View style={[styles.bgCircle1, { backgroundColor: colors.primary }]} />
      <View style={[styles.bgCircle2, { backgroundColor: colors.accent }]} />
      <View
        style={[styles.bgCircle3, { backgroundColor: colors.primaryLight }]}
      />

      <View style={styles.content}>
        {/* Rings */}
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: colors.accent,
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: colors.accent,
              transform: [{ scale: ring2Scale }],
              opacity: ring2Opacity,
            },
          ]}
        />

        {/* Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              backgroundColor: colors.accent,
              shadowColor: colors.accent,
              transform: [{ scale: Animated.multiply(logoScale, pulseAnim) }],
              opacity: logoOpacity,
            },
          ]}
        >
          <View style={styles.logoInner}>
            <Text style={styles.logoIcon}>💬</Text>
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
          }}
        >
          <Text style={[styles.appName, { color: colors.textPrimary }]}>
            ChatApp
          </Text>
        </Animated.View>

        <Animated.View style={{ opacity: subtitleOpacity }}>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Simple. Secure. Reliable messaging.
          </Text>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.bottomSection, { opacity: bottomTextOpacity }]}
      >
        <Text style={[styles.fromText, { color: colors.textMuted }]}>from</Text>
        <Text style={[styles.companyName, { color: colors.accent }]}>
          ChatApp Inc.
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute',
    width: scale(480),
    height: scale(480),
    borderRadius: scale(240),
    opacity: 0.05,
    top: -scale(160),
    left: -scale(80),
  },
  bgCircle2: {
    position: 'absolute',
    width: scale(320),
    height: scale(320),
    borderRadius: scale(160),
    opacity: 0.03,
    bottom: -scale(96),
    right: -scale(64),
  },
  bgCircle3: {
    position: 'absolute',
    width: scale(256),
    height: scale(256),
    borderRadius: scale(128),
    opacity: 0.04,
    bottom: '30%',
    left: -scale(128),
  },
  content: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    borderWidth: 2,
  },
  logoContainer: {
    width: scale(120),
    height: scale(120),
    borderRadius: moderateScale(35),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(24),
    shadowOffset: { width: 0, height: scale(8) },
    shadowOpacity: 0.4,
    shadowRadius: scale(20),
    elevation: 15,
  },
  logoInner: {
    width: scale(100),
    height: scale(100),
    borderRadius: moderateScale(28),
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: { fontSize: moderateScale(55) },
  appName: {
    fontSize: moderateScale(38),
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: verticalScale(8),
    textAlign: 'center',
  },
  tagline: {
    fontSize: moderateScale(14),
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  bottomSection: {
    position: 'absolute',
    bottom: verticalScale(50),
    alignItems: 'center',
  },
  fromText: { fontSize: moderateScale(12), marginBottom: verticalScale(4) },
  companyName: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default SplashScreen;
