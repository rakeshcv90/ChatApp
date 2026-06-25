import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { scale } from 'react-native-size-matters';
import { useTheme } from '../context/ThemeContext';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  uri: string;
  size?: AvatarSize;
  isOnline?: boolean;
  /** Render a coloured ring around the avatar (for Status) */
  ring?: boolean;
  /** Ring is the unseen accent colour when true, muted when false */
  ringUnseen?: boolean;
  style?: ViewStyle;
}

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: scale(36),
  md: scale(48),
  lg: scale(56),
  xl: scale(100),
};

const Avatar: React.FC<AvatarProps> = ({
  uri,
  size = 'md',
  isOnline = false,
  ring = false,
  ringUnseen = false,
  style,
}) => {
  const { colors } = useTheme();
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [uri]);

  const dim = SIZE_MAP[size];
  const borderRadius = dim / 3.2; // Modern Squircle shape
  const onlineDotSize = scale(13);

  // Default avatar image URL
  const DEFAULT_AVATAR = 'https://i.pravatar.cc/150?img=33';

  // Use default if uri is empty, null, or has triggered an error
  const sourceUri = !uri || hasError ? DEFAULT_AVATAR : uri;

  if (ring) {
    return (
      <View
        style={[
          styles.ringWrapper,
          {
            width: dim + scale(8),
            height: dim + scale(8),
            borderRadius: (dim + scale(8)) / 3.2,
            borderColor: ringUnseen ? colors.accent : colors.textMuted,
          },
          style,
        ]}
      >
        <Image
          source={{ uri: sourceUri }}
          style={{ width: dim, height: dim, borderRadius }}
          onError={() => setHasError(true)}
        />
      </View>
    );
  }

  return (
    <View style={[{ position: 'relative' }, style]}>
      <Image
        source={{ uri: sourceUri }}
        style={{ width: dim, height: dim, borderRadius }}
        onError={() => setHasError(true)}
      />
      {isOnline && (
        <View
          style={[
            styles.onlineDot,
            {
              width: onlineDotSize,
              height: onlineDotSize,
              borderRadius: onlineDotSize / 2,
              backgroundColor: colors.online,
              borderColor: colors.bgDark,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  ringWrapper: {
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    borderWidth: 2.5,
  },
});

export default Avatar;
