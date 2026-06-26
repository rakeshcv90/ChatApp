import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  authLoading: boolean;
  sendOTP: (phoneNumber: string) => Promise<void>;
  confirmOTP: (code: string, phoneNumber: string) => Promise<FirebaseAuthTypes.UserCredential>;
  updateUserProfile: (displayName: string, photoURL?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  authLoading: true,
  sendOTP: async () => {},
  confirmOTP: async () => ({} as FirebaseAuthTypes.UserCredential),
  updateUserProfile: async () => {},
  signOut: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(firebaseUser => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Calls the Cloud Function which generates an OTP and sends it via 2factor.in.
  const sendOTP = useCallback(async (phoneNumber: string): Promise<void> => {
    const sendOTPFn = functions().httpsCallable('sendOTP');
    await sendOTPFn({phoneNumber});
  }, []);

  // Calls the Cloud Function to verify the OTP and returns a Firebase custom token.
  const confirmOTP = useCallback(
    async (code: string, phoneNumber: string): Promise<FirebaseAuthTypes.UserCredential> => {
      const verifyOTPFn = functions().httpsCallable('verifyOTP');
      const result = await verifyOTPFn({phoneNumber, otp: code});
      const {customToken} = result.data as {customToken: string};
      return auth().signInWithCustomToken(customToken);
    },
    [],
  );

  const updateUserProfile = useCallback(
    async (displayName: string, photoURL?: string) => {
      const currentUser = auth().currentUser;
      if (currentUser) {
        await currentUser.updateProfile({displayName, photoURL: photoURL ?? null});
        await currentUser.reload();
        setUser(auth().currentUser);
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await auth().signOut();
    } catch (e: any) {
      if (e.code === 'auth/no-current-user') {
        // Firebase has no session but React state still shows a user —
        // clear it manually so navigation resets to Login.
        setUser(null);
        return;
      }
      throw e;
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({user, authLoading, sendOTP, confirmOTP, updateUserProfile, signOut}),
    [user, authLoading, sendOTP, confirmOTP, updateUserProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => useContext(AuthContext);
