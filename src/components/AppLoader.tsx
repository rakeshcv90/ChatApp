import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  Easing,
  useWindowDimensions,
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '../context/ThemeContext';

interface AppLoaderProps {
  visible: boolean;
  message?: string;
}

const AppLoader: React.FC<AppLoaderProps> = ({visible, message = 'Loading...'}) => {
  const {colors, isDark} = useTheme();
  const {width} = useWindowDimensions();

  // Animation values
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.7)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Fade in overlay
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();

      // Infinite rotation for loader ring
      const spin = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        })
      );
      spin.start();

      // Infinite pulse for center dot
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => {
        spin.stop();
        pulse.stop();
        rotateAnim.setValue(0);
        pulseAnim.setValue(0.7);
      };
    } else {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, rotateAnim, pulseAnim, fadeAnim]);

  if (!visible) return null;

  const spinInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View
        style={[
          styles.overlay,
          {
            backgroundColor: isDark ? 'rgba(11, 20, 26, 0.75)' : 'rgba(255, 255, 255, 0.75)',
            opacity: fadeAnim,
          },
        ]}>
        <View
          style={[
            styles.loaderCard,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.divider,
              shadowColor: colors.black,
            },
          ]}>
          <View style={styles.animContainer}>
            {/* Outer Spinning Dash Ring */}
            <Animated.View
              style={[
                styles.spinnerOuter,
                {
                  borderColor: colors.accent,
                  borderTopColor: 'transparent',
                  borderBottomColor: 'transparent',
                  transform: [{rotate: spinInterpolate}],
                },
              ]}
            />
            {/* Middle Pulsing Ring */}
            <Animated.View
              style={[
                styles.spinnerInner,
                {
                  borderColor: colors.primaryLight,
                  transform: [{scale: pulseAnim}],
                  opacity: pulseAnim.interpolate({
                    inputRange: [0.7, 1.1],
                    outputRange: [0.8, 0.2],
                  }),
                },
              ]}
            />
            {/* Center Chat Symbol Icon */}
            <View style={[styles.centerIcon, {backgroundColor: colors.accent}]}>
              <Text style={styles.chatEmoji}>💬</Text>
            </View>
          </View>
          <Text style={[styles.messageText, {color: colors.textPrimary}]}>{message}</Text>
          <Text style={[styles.subText, {color: colors.textSecondary}]}>Connecting to secure servers...</Text>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderCard: {
    padding: scale(24),
    borderRadius: moderateScale(22),
    alignItems: 'center',
    justifyContent: 'center',
    width: scale(230),
    borderWidth: 1.5,
    shadowOffset: {width: 0, height: scale(6)},
    shadowOpacity: 0.15,
    shadowRadius: scale(16),
    elevation: 12,
  },
  animContainer: {
    width: scale(84),
    height: scale(84),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(18),
    position: 'relative',
  },
  spinnerOuter: {
    position: 'absolute',
    width: scale(74),
    height: scale(74),
    borderRadius: scale(37),
    borderWidth: 3,
    borderStyle: 'dashed',
  },
  spinnerInner: {
    position: 'absolute',
    width: scale(54),
    height: scale(54),
    borderRadius: scale(27),
    borderWidth: 2,
  },
  centerIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  chatEmoji: {
    fontSize: moderateScale(18),
  },
  messageText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: verticalScale(6),
    letterSpacing: 0.3,
  },
  subText: {
    fontSize: moderateScale(11),
    textAlign: 'center',
    opacity: 0.8,
  },
});

export default AppLoader;
