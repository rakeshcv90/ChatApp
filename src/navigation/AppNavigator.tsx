import React from 'react';
import {NavigationContainer, NavigationContainerRef} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useTheme} from '../context/ThemeContext';
import {AuthProvider, useAuth} from '../context/AuthContext';

import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import OTPScreen from '../screens/OTPScreen';
import HomeScreen from '../screens/HomeScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SelectContactScreen from '../screens/SelectContactScreen';
import CallScreen from '../screens/CallScreen';
import IncomingCallScreen from '../screens/IncomingCallScreen';

const Stack = createNativeStackNavigator();

interface AppStackProps {
  navRef?: React.RefObject<NavigationContainerRef<any>>;
}

const AppStack: React.FC<AppStackProps> = ({navRef}) => {
  const {colors} = useTheme();
  const {user, authLoading} = useAuth();

  // While Firebase resolves the persisted auth session, show Splash
  if (authLoading) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="Splash" component={SplashScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator
        // If user is already logged in skip auth screens, go straight to Home
        initialRouteName={user ? 'Home' : 'Splash'}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {backgroundColor: colors.bgDark},
        }}>
        {/* Auth screens */}
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen
          name="OTP"
          component={OTPScreen as any}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
          options={{animation: 'slide_from_bottom'}}
        />

        {/* App screens */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
          name="SelectContact"
          component={SelectContactScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="Call"
          component={CallScreen}
          options={{animation: 'fade', gestureEnabled: false}}
        />
        <Stack.Screen
          name="IncomingCall"
          component={IncomingCallScreen}
          options={{animation: 'fade', gestureEnabled: false}}
        />
        <Stack.Screen
          name="ChatDetail"
          component={ChatDetailScreen}
          options={{animation: 'slide_from_right'}}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{animation: 'slide_from_bottom'}}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{animation: 'slide_from_bottom'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

interface AppNavigatorProps {
  navigationRef?: React.RefObject<NavigationContainerRef<any>>;
}

const AppNavigator: React.FC<AppNavigatorProps> = ({navigationRef}) => {
  return (
    <AuthProvider>
      <AppStack navRef={navigationRef} />
    </AuthProvider>
  );
};

export default AppNavigator;
