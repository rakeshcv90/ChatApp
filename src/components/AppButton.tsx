import React, {useRef} from 'react';
import {
  TouchableOpacity,
  Text,
  Animated,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '../context/ThemeContext';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'outline';
  style?: ViewStyle;
  rightIcon?: string;
}

const AppButton: React.FC<AppButtonProps> = ({
  label,
  onPress,
  loading = false,
  variant = 'primary',
  style,
  rightIcon,
}) => {
  const {colors} = useTheme();
  const scale_ = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale_, {toValue: 0.96, useNativeDriver: true}).start();

  const onPressOut = () =>
    Animated.spring(scale_, {
      toValue: 1,
      friction: 3,
      tension: 150,
      useNativeDriver: true,
    }).start();

  const isPrimary = variant === 'primary';

  return (
    <Animated.View style={[{transform: [{scale: scale_}]}, style]}>
      <TouchableOpacity
        style={[
          styles.btn,
          {
            backgroundColor: isPrimary ? colors.accent : 'transparent',
            borderColor: colors.accent,
            borderWidth: isPrimary ? 0 : 1.5,
            shadowColor: isPrimary ? colors.accent : 'transparent',
          },
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.9}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={isPrimary ? colors.bgDark : colors.accent} />
        ) : (
          <>
            <Text
              style={[
                styles.label,
                {color: isPrimary ? colors.bgDark : colors.accent},
              ]}>
              {label}
            </Text>
            {rightIcon ? (
              <Text
                style={[
                  styles.rightIcon,
                  {color: isPrimary ? colors.bgDark : colors.accent},
                ]}>
                {rightIcon}
              </Text>
            ) : null}
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  btn: {
    height: verticalScale(52),
    borderRadius: moderateScale(14),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {width: 0, height: scale(6)},
    shadowOpacity: 0.35,
    shadowRadius: scale(12),
    elevation: 8,
  },
  label: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  rightIcon: {
    fontSize: moderateScale(18),
    marginLeft: scale(8),
    fontWeight: '700',
  },
});

export default AppButton;
