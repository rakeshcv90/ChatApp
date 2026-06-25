import {scale, verticalScale, moderateScale} from 'react-native-size-matters';

// ─── Dark palette (Obsidian Indigo / Royal Violet Theme) ──────────────────────
export const DARK_COLORS = {
  primary: '#4F46E5', // Royal Indigo
  primaryDark: '#3730A3',
  primaryLight: '#6366F1',
  accent: '#8B5CF6', // Royal Violet
  accentLight: '#A78BFA',

  bgDark: '#090D16', // Obsidian Black
  bgMedium: '#0F172A', // Slate Dark
  bgLight: '#1E293B', // Slate Medium
  bgCard: '#1E293B',
  bgInput: '#334155',

  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textLink: '#38BDF8',

  divider: '#1E293B',
  iconDefault: '#94A3B8',
  iconActive: '#8B5CF6',
  bubbleSent: '#4F46E5',
  bubbleReceived: '#1E293B',
  unreadBadge: '#EC4899', // Premium Pink Badge
  online: '#10B981',

  statusBlue: '#38BDF8',
  statusRed: '#EF4444',

  gradientStart: '#4F46E5',
  gradientEnd: '#8B5CF6',
  splashGradientStart: '#4F46E5',
  splashGradientMid: '#6366F1',
  splashGradientEnd: '#8B5CF6',

  overlay: 'rgba(0, 0, 0, 0.6)',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// ─── Light palette ────────────────────────────────────────────────────────────
export const LIGHT_COLORS = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primaryLight: '#6366F1',
  accent: '#4F46E5',
  accentLight: '#8B5CF6',

  bgDark: '#F8FAFC',
  bgMedium: '#F1F5F9',
  bgLight: '#E2E8F0',
  bgCard: '#FFFFFF',
  bgInput: '#F1F5F9',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textLink: '#0284C7',

  divider: '#E2E8F0',
  iconDefault: '#475569',
  iconActive: '#4F46E5',
  bubbleSent: '#E0E7FF', // Soft Indigo sent bubble
  bubbleReceived: '#FFFFFF',
  unreadBadge: '#EC4899',
  online: '#10B981',

  statusBlue: '#0284C7',
  statusRed: '#EF4444',

  gradientStart: '#4F46E5',
  gradientEnd: '#8B5CF6',
  splashGradientStart: '#4F46E5',
  splashGradientMid: '#6366F1',
  splashGradientEnd: '#8B5CF6',

  overlay: 'rgba(0, 0, 0, 0.4)',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// ─── Backward-compat default export (dark) ───────────────────────────────────
export const COLORS = DARK_COLORS;

// ─── Responsive sizes via react-native-size-matters ──────────────────────────
export const SIZES = {
  // Font sizes
  xs: moderateScale(10),
  sm: moderateScale(12),
  md: moderateScale(14),
  base: moderateScale(16),
  lg: moderateScale(18),
  xl: moderateScale(20),
  xxl: moderateScale(24),
  xxxl: moderateScale(30),
  title: moderateScale(36),
  splash: moderateScale(48),

  // Spacing
  padding: scale(16),
  paddingSm: scale(8),
  paddingLg: scale(24),
  margin: scale(16),
  marginSm: scale(8),
  marginLg: scale(24),

  // Border Radius
  radiusSm: moderateScale(8),
  radius: moderateScale(12),
  radiusLg: moderateScale(20),
  radiusXl: moderateScale(28),
  radiusFull: 999,

  // Avatar sizes
  avatarSm: scale(40),
  avatar: scale(50),
  avatarLg: scale(64),
  avatarXl: scale(120),

  // Icon sizes
  iconSm: scale(18),
  icon: scale(24),
  iconLg: scale(28),

  // Heights
  inputHeight: verticalScale(52),
  buttonHeight: verticalScale(54),
  headerIconSize: scale(40),
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  light: 'System',
};

export type ThemeColors = typeof DARK_COLORS;
