import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {useColorScheme} from 'react-native';
import {DARK_COLORS, LIGHT_COLORS, SIZES, ThemeColors} from '../constants/theme';

interface UserProfile {
  name: string;
  about: string;
  phone: string;
  avatar: string;
}

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
  sizes: typeof SIZES;
  userProfile: UserProfile;
  updateProfile: (profile: Partial<UserProfile>) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
  colors: DARK_COLORS,
  sizes: SIZES,
  userProfile: {
    name: 'Yogesh Rana',
    about: 'At the gym 🏋️‍♂️ | Busy coding',
    phone: '9876543210',
    avatar: 'https://i.pravatar.cc/150?img=33',
  },
  updateProfile: () => {},
});

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(systemScheme !== 'light');
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Yogesh Rana',
    about: 'At the gym 🏋️‍♂️ | Busy coding',
    phone: '9876543210',
    avatar: 'https://i.pravatar.cc/150?img=33',
  });

  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  const updateProfile = useCallback((newProfile: Partial<UserProfile>) => {
    setUserProfile(prev => ({
      ...prev,
      ...newProfile,
    }));
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      isDark,
      toggleTheme,
      colors: isDark ? DARK_COLORS : LIGHT_COLORS,
      sizes: SIZES,
      userProfile,
      updateProfile,
    }),
    [isDark, toggleTheme, userProfile, updateProfile],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
