import React from 'react';
import {Text, StyleSheet} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import {useTheme} from '../context/ThemeContext';

interface SectionHeaderProps {
  title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({title}) => {
  const {colors} = useTheme();

  return (
    <Text style={[styles.title, {color: colors.textMuted}]}>{title}</Text>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(8),
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});

export default SectionHeader;
