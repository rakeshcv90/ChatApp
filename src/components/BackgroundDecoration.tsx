import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, useWindowDimensions, View} from 'react-native';
import {useTheme} from '../context/ThemeContext';

const BackgroundDecoration: React.FC = () => {
  const {colors} = useTheme();
  const {width} = useWindowDimensions();

  // Animation values for slow floating circles
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateCircle = (val: Animated.Value, duration: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateCircle(floatAnim1, 15000);
    animateCircle(floatAnim2, 18000);
  }, [floatAnim1, floatAnim2]);

  const transX1 = floatAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-scale(20), scale(20)],
  });

  const transY1 = floatAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-scale(15), scale(15)],
  });

  const transX2 = floatAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [scale(15), -scale(15)],
  });

  const transY2 = floatAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [-scale(20), scale(20)],
  });

  // Helper scale for responsive offsets
  function scale(n: number) {
    return (width / 375) * n;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          styles.circle1,
          {
            width: width * 1.2,
            height: width * 1.2,
            borderRadius: width * 0.6,
            backgroundColor: colors.primary,
            top: -width * 0.6,
            right: -width * 0.3,
            transform: [{translateX: transX1}, {translateY: transY1}],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.circle2,
          {
            width: width * 0.75,
            height: width * 0.75,
            borderRadius: width * 0.375,
            backgroundColor: colors.accent,
            bottom: -width * 0.2,
            left: -width * 0.3,
            transform: [{translateX: transX2}, {translateY: transY2}],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  circle1: {
    position: 'absolute',
    opacity: 0.05,
  },
  circle2: {
    position: 'absolute',
    opacity: 0.04,
  },
});

export default BackgroundDecoration;
