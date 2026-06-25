import React from 'react';
import {TouchableOpacity, Text, StyleSheet, ViewStyle, StyleProp} from 'react-native';
import {moderateScale, scale} from 'react-native-size-matters';
import {useTheme} from '../context/ThemeContext';

interface FABProps {
  icon: string | React.ReactNode;
  onPress?: () => void;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

const FAB: React.FC<FABProps> = ({icon, onPress, size = 'md', style}) => {
  const {colors, isDark} = useTheme();
  const dim = size === 'md' ? scale(56) : scale(44);
  const radius = dim / 2;
  const iconSize = size === 'md' ? moderateScale(24) : moderateScale(18);

  const isSmall = size === 'sm';

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          width: dim,
          height: dim,
          borderRadius: radius,
          backgroundColor: isSmall ? colors.bgCard : colors.accent,
          borderColor: isSmall ? colors.divider : 'transparent',
          borderWidth: isSmall ? 1 : 0,
          shadowColor: isSmall ? 'transparent' : colors.accent,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.85}>
      {typeof icon === 'string' ? (
        <Text style={[styles.icon, {fontSize: iconSize, color: isSmall ? colors.textPrimary : (isDark ? colors.bgDark : colors.white)}]}>
          {icon}
        </Text>
      ) : (
        icon
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {width: 0, height: scale(6)},
    shadowOpacity: 0.4,
    shadowRadius: scale(12),
    elevation: 10,
  },
  icon: {},
});

export default FAB;
