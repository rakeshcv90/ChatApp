import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Switch,
  Modal,
  FlatList,
  Alert,
  Animated,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import Avatar from '../components/Avatar';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AppLoader from '../components/AppLoader';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {uploadProfileImage} from '../services/StorageService';


// Dummy avatars matching WhatsApp profile options
const AVATAR_OPTIONS = [
  'https://i.pravatar.cc/150?img=33',
  'https://i.pravatar.cc/150?img=12',
  'https://i.pravatar.cc/150?img=47',
  'https://i.pravatar.cc/150?img=60',
  'https://i.pravatar.cc/150?img=65',
  'https://i.pravatar.cc/150?img=68',
  'https://i.pravatar.cc/150?img=53',
  'https://i.pravatar.cc/150?img=54',
  'https://i.pravatar.cc/150?img=11',
  'https://i.pravatar.cc/150?img=20',
  'https://i.pravatar.cc/150?img=5',
  'https://i.pravatar.cc/150?img=9',
];

interface ProfileScreenProps {
  navigation: any;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({navigation}) => {
  const {colors, isDark, toggleTheme} = useTheme();
  const insets = useSafeAreaInsets();
  const {user, updateUserProfile} = useAuth();

  // User details state
  const [name, setName] = useState(user?.displayName || '');
  const [about, setAbout] = useState('Hey there! I am using ChatApp.');
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [avatar, setAvatar] = useState(user?.photoURL || AVATAR_OPTIONS[0]);

  // Loading state
  const [loading, setLoading] = useState(false);

  // Fetch real details on mount
  React.useEffect(() => {
    const fetchProfile = async () => {
      const currentUser = auth().currentUser;
      if (currentUser) {
        setName(currentUser.displayName || '');
        setPhone(currentUser.phoneNumber || '');
        setAvatar(currentUser.photoURL || AVATAR_OPTIONS[0]);

        try {
          const doc = await firestore().collection('users').doc(currentUser.uid).get();
          if (doc.exists) {
            const data = doc.data();
            if (data?.about) {
              setAbout(data.about);
            }
          }
        } catch (err) {
          console.log('[ProfileScreen] Error fetching extra details:', err);
        }
      }
    };
    fetchProfile();
  }, []);

  // Focus states for input highlight
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Avatar selector modal state
  const [pickerVisible, setPickerVisible] = useState(false);

  const handleLaunchCamera = () => {
    setPickerVisible(false);
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
        saveToPhotos: false,
      },
      response => {
        if (response.didCancel) {
          console.log('User cancelled camera capture');
        } else if (response.errorMessage) {
          console.error('ImagePicker Camera Error: ', response.errorMessage);
          Alert.alert('Camera Error', response.errorMessage);
        } else if (response.assets && response.assets.length > 0) {
          const uri = response.assets[0].uri;
          if (uri) setAvatar(uri);
        }
      }
    );
  };

  const handleLaunchImageLibrary = () => {
    setPickerVisible(false);
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
      },
      response => {
        if (response.didCancel) {
          console.log('User cancelled image selection');
        } else if (response.errorMessage) {
          console.error('ImagePicker Gallery Error: ', response.errorMessage);
          Alert.alert('Gallery Error', response.errorMessage);
        } else if (response.assets && response.assets.length > 0) {
          const uri = response.assets[0].uri;
          if (uri) setAvatar(uri);
        }
      }
    );
  };

  // Success toast notification animation
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;

  const showSuccessToast = () => {
    Animated.parallel([
      Animated.timing(toastOpacity, {toValue: 1, duration: 300, useNativeDriver: true}),
      Animated.timing(toastTranslateY, {toValue: 0, duration: 300, useNativeDriver: true}),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, {toValue: 0, duration: 300, useNativeDriver: true}),
          Animated.timing(toastTranslateY, {toValue: -20, duration: 300, useNativeDriver: true}),
        ]).start();
      }, 2500);
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Name cannot be empty.');
      return;
    }
    setLoading(true);
    try {
      let avatarUrl = avatar || '';
      
      // Upload edited profile image if it is local
      if (avatar && !avatar.startsWith('http')) {
        console.log('[ProfileScreen] Uploading modified avatar to storage...');
        try {
          avatarUrl = await uploadProfileImage(avatar);
          setAvatar(avatarUrl);
        } catch (uploadErr) {
          console.warn('[ProfileScreen] Avatar upload failed:', uploadErr);
          Alert.alert(
            'Upload Failed',
            'Failed to upload profile picture to Firebase Storage. Please make sure you have enabled Storage in the Firebase Console.'
          );
          setLoading(false);
          return;
        }
      }

      await updateUserProfile(name.trim(), avatarUrl);
      
      const currentUser = auth().currentUser;
      if (currentUser) {
        await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .set({
            uid: currentUser.uid,
            displayName: name.trim(),
            photoURL: avatarUrl,
            phoneNumber: currentUser.phoneNumber || '',
            about: about.trim(),
          }, { merge: true });
      }
      
      showSuccessToast();
    } catch (err) {
      console.error('[ProfileScreen] Save error:', err);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectAvatar = (url: string) => {
    setAvatar(url);
    setPickerVisible(false);
  };

  const renderAvatarOption = ({item}: {item: string}) => (
    <TouchableOpacity
      style={[
        styles.avatarOptionWrapper,
        {borderColor: avatar === item ? colors.accent : colors.divider},
      ]}
      onPress={() => selectAvatar(item)}>
      <Avatar uri={item} size="md" />
      {avatar === item && (
        <View style={[styles.avatarOptionActiveBadge, {backgroundColor: colors.accent}]}>
          <Text style={styles.activeCheck}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.bgDark}]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <AppLoader visible={loading} message="Saving settings..." />

      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.bgMedium, borderBottomColor: colors.divider, paddingTop: insets.top + verticalScale(10)}]}>
        <TouchableOpacity
          style={[styles.backBtn, {backgroundColor: colors.bgLight}]}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name="chevron-back" size={moderateScale(22)} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>Profile</Text>
      </View>

      {/* Success Notification Banner */}
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: colors.accent,
            opacity: toastOpacity,
            transform: [{translateY: toastTranslateY}],
          },
        ]}>
        <Text style={styles.toastText}>✓ Profile Settings Saved Successfully!</Text>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Profile Card Section */}
        <View style={[styles.profileCard, {backgroundColor: colors.bgCard, borderColor: colors.divider}]}>
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.9}>
              <Avatar uri={avatar} size="xl" />
              <View style={[styles.editBadge, {backgroundColor: colors.accent, borderColor: colors.bgCard}]}>
                <Ionicons name="camera" size={moderateScale(15)} color={colors.white} />
              </View>
            </TouchableOpacity>
            <Text style={[styles.tapToChangeText, {color: colors.accent}]}>
              Tap avatar to change profile picture
            </Text>
          </View>

          {/* Form Fields */}
          <AppInput
            label="Name *"
            icon="👤"
            placeholder="Enter your name"
            value={name}
            onChangeText={setName}
            isFocused={focusedField === 'name'}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
          />

          <AppInput
            label="About"
            icon="📝"
            placeholder="About you"
            value={about}
            onChangeText={setAbout}
            isFocused={focusedField === 'about'}
            onFocus={() => setFocusedField('about')}
            onBlur={() => setFocusedField(null)}
          />

          <AppInput
            label="Phone Number *"
            icon="📱"
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={15}
            isFocused={focusedField === 'phone'}
            onFocus={() => setFocusedField('phone')}
            onBlur={() => setFocusedField(null)}
          />

          <AppButton
            label="SAVE CHANGES"
            onPress={handleSave}
            style={styles.saveBtn}
          />
        </View>

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

        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Avatar Picker Modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}>
          <View
            style={[
              styles.modalContainer,
              {backgroundColor: colors.bgMedium, borderTopColor: colors.divider},
            ]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>Choose Profile Picture</Text>
              <TouchableOpacity
                onPress={() => setPickerVisible(false)}
                style={[styles.closeModalBtn, {backgroundColor: colors.bgCard}]}>
                <Text style={[styles.closeModalText, {color: colors.textPrimary}]}>✕</Text>
              </TouchableOpacity>
            </View>
            {/* Camera / Gallery Selection */}
            <View style={styles.pickerActionRow}>
              <TouchableOpacity
                style={[styles.pickerActionBtn, {backgroundColor: colors.bgCard, borderColor: colors.divider}]}
                onPress={handleLaunchCamera}>
                <Ionicons name="camera" size={moderateScale(22)} color={colors.accent} />
                <Text style={[styles.pickerActionText, {color: colors.textPrimary}]}>Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.pickerActionBtn, {backgroundColor: colors.bgCard, borderColor: colors.divider}]}
                onPress={handleLaunchImageLibrary}>
                <Ionicons name="images" size={moderateScale(22)} color={colors.accent} />
                <Text style={[styles.pickerActionText, {color: colors.textPrimary}]}>Gallery</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.modalDivider, {backgroundColor: colors.divider}]} />
            
            <Text style={[styles.modalSectionTitle, {color: colors.textSecondary}]}>Or Choose Avatar</Text>

            <FlatList
              data={AVATAR_OPTIONS}
              renderItem={renderAvatarOption}
              keyExtractor={item => item}
              numColumns={3}
              contentContainerStyle={styles.avatarGrid}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
  toast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? verticalScale(100) : (StatusBar.currentHeight ?? 24) + verticalScale(60),
    left: scale(20),
    right: scale(20),
    padding: scale(12),
    borderRadius: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  toastText: {
    color: '#FFF',
    fontSize: moderateScale(13),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(40),
  },
  profileCard: {
    borderRadius: moderateScale(20),
    padding: scale(20),
    borderWidth: 1.5,
    marginBottom: verticalScale(24),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: verticalScale(24),
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: verticalScale(10),
  },
  editBadge: {
    position: 'absolute',
    bottom: scale(2),
    right: scale(2),
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  tapToChangeText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  saveBtn: {
    marginTop: verticalScale(8),
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
  rowIcon: {
    fontSize: moderateScale(16),
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
  arrowIcon: {
    fontSize: moderateScale(12),
  },
  footerSpacer: {
    height: verticalScale(40),
  },
  // Modal Style
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    borderTopWidth: 1.5,
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(32),
    maxHeight: '65%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(20),
    marginBottom: verticalScale(16),
  },
  modalTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  closeModalBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  avatarGrid: {
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(16),
  },
  pickerActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: scale(12),
    marginBottom: verticalScale(4),
  },
  pickerActionBtn: {
    flex: 1,
    marginHorizontal: scale(8),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(14),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: scale(8),
  },
  pickerActionText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  modalDivider: {
    height: 1.5,
    marginHorizontal: scale(20),
    marginVertical: verticalScale(16),
  },
  modalSectionTitle: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: scale(20),
    marginBottom: verticalScale(12),
  },
  avatarOptionWrapper: {
    flex: 1,
    aspectRatio: 1,
    margin: scale(8),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  avatarOptionActiveBadge: {
    position: 'absolute',
    bottom: -scale(4),
    right: -scale(4),
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeCheck: {
    color: '#FFF',
    fontSize: moderateScale(10),
    fontWeight: 'bold',
  },
});

export default ProfileScreen;
