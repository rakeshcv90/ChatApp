import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Switch,
  Alert,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import Avatar from '../components/Avatar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

interface SettingsScreenProps {
  navigation: any;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({navigation}) => {
  const {colors, isDark, toggleTheme} = useTheme();
  const insets = useSafeAreaInsets();
  const {signOut, user} = useAuth();

  const [profile, setProfile] = React.useState({
    name: 'Loading...',
    about: 'Hey there! I am using ChatApp.',
    phone: '',
    avatar: 'https://i.pravatar.cc/150?img=33',
  });

  React.useEffect(() => {
    const fetchProfile = async () => {
      const currentUser = auth().currentUser;
      if (currentUser) {
        setProfile(prev => ({
          ...prev,
          name: currentUser.displayName || 'No Name',
          phone: currentUser.phoneNumber || '',
          avatar: currentUser.photoURL || 'https://i.pravatar.cc/150?img=33',
        }));

        try {
          const doc = await firestore().collection('users').doc(currentUser.uid).get();
          if (doc.exists) {
            const data = doc.data();
            setProfile(prev => ({
              ...prev,
              name: data?.displayName || currentUser.displayName || 'No Name',
              avatar: data?.photoURL || currentUser.photoURL || 'https://i.pravatar.cc/150?img=33',
              about: data?.about || 'Hey there! I am using ChatApp.',
              phone: data?.phoneNumber || currentUser.phoneNumber || '',
            }));
          }
        } catch (err) {
          console.log('[SettingsScreen] Error fetching Firestore profile:', err);
        }
      }
    };
    
    fetchProfile();
    
    // Set up a real-time listener to keep info updated
    const currentUser = auth().currentUser;
    if (!currentUser) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot(doc => {
        if (doc.exists) {
          const data = doc.data();
          setProfile(prev => ({
            ...prev,
            name: data?.displayName || prev.name,
            avatar: data?.photoURL || prev.avatar,
            about: data?.about || prev.about,
            phone: data?.phoneNumber || prev.phone,
          }));
        }
      });
      
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (e) {
              console.error('Sign out error:', e);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.bgDark}]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.bgMedium, borderBottomColor: colors.divider, paddingTop: insets.top + verticalScale(10)}]}>
        <TouchableOpacity
          style={[styles.backBtn, {backgroundColor: colors.bgLight}]}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name="chevron-back" size={moderateScale(22)} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Profile Entry Row Card */}
        <TouchableOpacity
          style={[styles.profileCard, {backgroundColor: colors.bgCard, borderColor: colors.divider}]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Profile')}>
          <Avatar uri={profile.avatar} size="lg" style={styles.profileAvatar} />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, {color: colors.textPrimary}]} numberOfLines={1}>
              {profile.name}
            </Text>
            {profile.phone ? (
              <Text style={[styles.profilePhone, {color: colors.accent}]} numberOfLines={1}>
                {profile.phone}
              </Text>
            ) : null}
            <Text style={[styles.profileAbout, {color: colors.textSecondary}]} numberOfLines={1}>
              {profile.about}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={moderateScale(18)} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Settings Options Row */}
        <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>Settings & Preferences</Text>

        <View style={[styles.settingsGroup, {backgroundColor: colors.bgCard, borderColor: colors.divider}]}>
          {/* Theme switcher option */}
          <View style={[styles.settingsRow, {borderBottomColor: colors.divider}]}>
            <View style={styles.settingsRowLeft}>
              <View style={[styles.iconCircle, {backgroundColor: colors.bgInput}]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={moderateScale(18)} color={colors.accent} />
              </View>
              <View style={styles.rowTextContainer}>
                <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>Dark Mode</Text>
                <Text style={[styles.rowDesc, {color: colors.textSecondary}]}>
                  {isDark ? 'Switch to light layout' : 'Switch to dark layout'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{false: colors.divider, true: colors.accentLight}}
              thumbColor={isDark ? colors.accent : colors.textMuted}
            />
          </View>

          {/* Account */}
          <TouchableOpacity style={[styles.settingsRow, {borderBottomColor: colors.divider}]}>
            <View style={styles.settingsRowLeft}>
              <View style={[styles.iconCircle, {backgroundColor: colors.bgInput}]}>
                <Ionicons name="key" size={moderateScale(18)} color={colors.accent} />
              </View>
              <View style={styles.rowTextContainer}>
                <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>Account</Text>
                <Text style={[styles.rowDesc, {color: colors.textSecondary}]}>
                  Privacy, security, change number
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={moderateScale(16)} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Chats */}
          <TouchableOpacity style={[styles.settingsRow, {borderBottomColor: colors.divider}]}>
            <View style={styles.settingsRowLeft}>
              <View style={[styles.iconCircle, {backgroundColor: colors.bgInput}]}>
                <Ionicons name="chatbubble-ellipses" size={moderateScale(18)} color={colors.accent} />
              </View>
              <View style={styles.rowTextContainer}>
                <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>Chats</Text>
                <Text style={[styles.rowDesc, {color: colors.textSecondary}]}>
                  Theme, wallpapers, chat history
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={moderateScale(16)} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity style={[styles.settingsRow, {borderBottomColor: colors.divider}]}>
            <View style={styles.settingsRowLeft}>
              <View style={[styles.iconCircle, {backgroundColor: colors.bgInput}]}>
                <Ionicons name="notifications" size={moderateScale(18)} color={colors.accent} />
              </View>
              <View style={styles.rowTextContainer}>
                <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>Notifications</Text>
                <Text style={[styles.rowDesc, {color: colors.textSecondary}]}>
                  Message, group & call tones
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={moderateScale(16)} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Help */}
          <TouchableOpacity style={styles.settingsRow}>
            <View style={styles.settingsRowLeft}>
              <View style={[styles.iconCircle, {backgroundColor: colors.bgInput}]}>
                <Ionicons name="information-circle" size={moderateScale(18)} color={colors.accent} />
              </View>
              <View style={styles.rowTextContainer}>
                <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>Help</Text>
                <Text style={[styles.rowDesc, {color: colors.textSecondary}]}>
                  Help center, contact us, app info
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={moderateScale(16)} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, {backgroundColor: colors.bgCard, borderColor: '#FF4444'}]}
          onPress={handleLogout}
          activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={moderateScale(20)} color="#FF4444" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Account email label */}
        {user?.email ? (
          <Text style={[styles.accountLabel, {color: colors.textMuted}]}>
            Signed in as {user.email}
          </Text>
        ) : null}

        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: verticalScale(12),
    paddingHorizontal: scale(12),
    borderBottomWidth: 0,
    zIndex: 10,
  },
  backBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(40),
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: moderateScale(20),
    padding: scale(16),
    borderWidth: 1.5,
    marginBottom: verticalScale(24),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileAvatar: {
    marginRight: scale(14),
  },
  profileInfo: {
    flex: 1,
    marginRight: scale(8),
  },
  profileName: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginBottom: verticalScale(3),
  },
  profilePhone: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginBottom: verticalScale(2),
  },
  profileAbout: {
    fontSize: moderateScale(12),
  },
  sectionTitle: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: verticalScale(10),
    paddingLeft: scale(4),
  },
  settingsGroup: {
    borderRadius: moderateScale(20),
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(14),
    borderBottomWidth: 1.5,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(16),
  },
  iconCircle: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  rowTextContainer: {
    flex: 1,
  },
  rowTitle: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    marginBottom: verticalScale(2),
  },
  rowDesc: {
    fontSize: moderateScale(11),
  },
  footerSpacer: {
    height: verticalScale(40),
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(16),
    borderWidth: 1.5,
    paddingVertical: verticalScale(14),
    marginTop: verticalScale(24),
  },
  logoutIcon: {
    marginRight: scale(8),
  },
  logoutText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: '#FF4444',
  },
  accountLabel: {
    textAlign: 'center',
    fontSize: moderateScale(11),
    marginTop: verticalScale(12),
    letterSpacing: 0.3,
  },
});

export default SettingsScreen;
