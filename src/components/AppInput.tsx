import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '../context/ThemeContext';

interface AppInputProps extends TextInputProps {
  label?: string;
  icon?: string;
  isFocused?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  containerStyle?: ViewStyle;
  rightElement?: React.ReactNode;
}

const AppInput: React.FC<AppInputProps> = ({
  label,
  icon,
  isFocused = false,
  containerStyle,
  rightElement,
  ...rest
}) => {
  const {colors} = useTheme();

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <Text style={[styles.label, {color: colors.textSecondary}]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.bgInput,
            borderColor: isFocused ? colors.accent : colors.divider,
          },
        ]}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <TextInput
          style={[styles.input, {color: colors.textPrimary}]}
          placeholderTextColor={colors.textMuted}
          {...rest}
        />
        {rightElement ?? null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: verticalScale(16),
  },
  label: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: verticalScale(8),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: moderateScale(14),
    height: verticalScale(52),
    paddingHorizontal: scale(14),
    borderWidth: 1.5,
  },
  icon: {
    fontSize: moderateScale(18),
    marginRight: scale(10),
  },
  input: {
    flex: 1,
    fontSize: moderateScale(15),
    fontWeight: '500',
    paddingVertical: 0,
  },
});

export default AppInput;
