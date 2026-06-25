import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Animated,
  Modal,
  FlatList,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import BackgroundDecoration from '../components/BackgroundDecoration';
import Avatar from '../components/Avatar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AppLoader from '../components/AppLoader';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {uploadProfileImage} from '../services/StorageService';


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

interface SignUpScreenProps {
  navigation: any;
  route?: {params?: {isNewUser?: boolean}};
}

const SignUpScreen: React.FC<SignUpScreenProps> = ({navigation, route}) => {
  const {colors, isDark} = useTheme();
  const {updateUserProfile} = useAuth();
  const isNewUser = route?.params?.isNewUser ?? false;

  const [name, setName] = useState('');
  const [about, setAbout] = useState('Hey there! I am using ChatApp.');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);

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
          if (uri) setSelectedAvatar(uri);
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
          if (uri) setSelectedAvatar(uri);
        }
      }
    );
  };

  // Animations
  const avatarScale = useRef(new Animated.Value(0.3)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(verticalScale(20))).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(verticalScale(40))).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.stagger(150, [
        Animated.parallel([
          Animated.spring(avatarScale, {toValue: 1, friction: 6, tension: 80, useNativeDriver: true}),
          Animated.timing(avatarOpacity, {toValue: 1, duration: 600, useNativeDriver: true}),
        ]),
        Animated.parallel([
          Animated.timing(titleOpacity, {toValue: 1, duration: 500, useNativeDriver: true}),
          Animated.spring(titleTranslateY, {toValue: 0, friction: 6, useNativeDriver: true}),
        ]),
        Animated.parallel([
          Animated.timing(formOpacity, {toValue: 1, duration: 600, useNativeDriver: true}),
          Animated.spring(formTranslateY, {toValue: 0, friction: 7, tension: 40, useNativeDriver: true}),
        ]),
      ]),
      Animated.timing(bottomOpacity, {toValue: 1, duration: 500, useNativeDriver: true}),
    ]).start();
  }, [avatarScale, avatarOpacity, titleOpacity, titleTranslateY, formOpacity, formTranslateY, bottomOpacity]);

  const handleComplete = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your display name.');
      return;
    }
    setLoading(true);
    console.log('[SignUp] Starting profile completion...');
    try {
      let avatarUrl = selectedAvatar || '';
      
      // If user selected a local file (e.g. from camera/gallery), upload it to Firebase Storage first!
      if (selectedAvatar && !selectedAvatar.startsWith('http')) {
        console.log('[SignUp] Uploading selected image to storage...');
        try {
          avatarUrl = await uploadProfileImage(selectedAvatar);
          console.log('[SignUp] Image upload completed successfully. URL:', avatarUrl);
        } catch (uploadErr) {
          console.warn('[SignUp] Image upload failed:', uploadErr);
          Alert.alert(
            'Upload Failed',
            'Failed to upload profile picture to Firebase Storage. Please make sure you have enabled Storage in the Firebase Console.'
          );
          setLoading(false);
          return;
        }
      }

      console.log('[SignUp] Updating user profile on auth...');
      await updateUserProfile(name.trim(), avatarUrl || undefined);
      console.log('[SignUp] Auth profile updated successfully.');
      
      const currentUser = auth().currentUser;
      if (currentUser) {
        console.log('[SignUp] Writing user profile to Firestore for UID:', currentUser.uid);
        
        // Define firestore write promise
        const firestorePromise = firestore()
          .collection('users')
          .doc(currentUser.uid)
          .set({
            uid: currentUser.uid,
            displayName: name.trim(),
            phoneNumber: currentUser.phoneNumber || '',
            photoURL: avatarUrl,
            about: about.trim(),
            createdAt: firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

        // Run with a timeout of 3 seconds so we don't hang if Firestore is offline/unprovisioned
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore write timeout')), 3000)
        );

        try {
          await Promise.race([firestorePromise, timeoutPromise]);
          console.log('[SignUp] Firestore write completed successfully.');
        } catch (raceError: any) {
          console.warn('[SignUp] Firestore write timed out or failed (offline sync will handle it):', raceError.message);
        }
      } else {
        console.warn('[SignUp] No current user found during registration!');
      }
      
      console.log('[SignUp] Navigating to Home.');
      navigation.replace('Home');
    } catch (error) {
      console.error('[SignUp] Save user profile error:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to save your profile. Please try again.');
    }
  };

  const selectAvatar = (url: string) => {
    setSelectedAvatar(url);
    setPickerVisible(false);
  };

  const renderAvatarOption = ({item}: {item: string}) => (
    <TouchableOpacity
      style={[
        styles.modalAvatarWrapper,
        {borderColor: selectedAvatar === item ? colors.accent : colors.divider},
      ]}
      onPress={() => selectAvatar(item)}>
      <Avatar uri={item} size="md" />
      {selectedAvatar === item && (
        <View style={[styles.avatarOptionActiveBadge, {backgroundColor: colors.accent}]}>
          <Text style={styles.activeCheck}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, {backgroundColor: colors.bgDark}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <AppLoader visible={loading} message="Setting up profile..." />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <BackgroundDecoration />

        {/* Header */}
        <View style={styles.header}>
          {!isNewUser && (
            <TouchableOpacity
              style={[styles.backButton, {backgroundColor: colors.bgCard, borderColor: colors.divider}]}
              onPress={() => navigation.goBack()}
              hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
              <Ionicons name="arrow-back" size={moderateScale(22)} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
            {isNewUser ? 'Complete Profile' : 'Create Account'}
          </Text>
        </View>

        {/* Avatar + Title */}
        <Animated.View style={[styles.topSection, {opacity: titleOpacity}]}>
          <Animated.View style={[styles.avatarAnimWrapper, {opacity: avatarOpacity, transform: [{scale: avatarScale}]}]}>
            <TouchableOpacity style={styles.avatarContainer} onPress={() => setPickerVisible(true)} activeOpacity={0.9}>
              {selectedAvatar ? (
                <Avatar uri={selectedAvatar} size="xl" />
              ) : (
                <View style={[styles.avatarPlaceholder, {backgroundColor: colors.bgCard, borderColor: colors.divider}]}>
                  <Ionicons name="camera-outline" size={moderateScale(32)} color={colors.textSecondary} />
                </View>
              )}
              <View style={[styles.addPhotoBtn, {backgroundColor: colors.accent, borderColor: colors.bgDark}]}>
                <Text style={styles.addPhotoIcon}>{selectedAvatar ? '✓' : '+'}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.Text style={[styles.title, {color: colors.textPrimary, transform: [{translateY: titleTranslateY}]}]}>
            {isNewUser ? 'Welcome! 👋' : 'Set Up Profile'}
          </Animated.Text>
          <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
            {isNewUser
              ? 'Add your name and photo to get started'
              : 'Choose a name and photo for your profile'}
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View style={[styles.formSection, {opacity: formOpacity, transform: [{translateY: formTranslateY}]}]}>
          <AppInput
            label="Display Name *"
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
            placeholder="Tell us about yourself..."
            value={about}
            onChangeText={setAbout}
            isFocused={focusedField === 'about'}
            onFocus={() => setFocusedField('about')}
            onBlur={() => setFocusedField(null)}
          />
          <AppButton
            label={isNewUser ? 'GET STARTED' : 'SAVE PROFILE'}
            onPress={handleComplete}
            style={styles.btn}
          />
        </Animated.View>

        {/* Already have account? link (only shown when not post-OTP) */}
        {!isNewUser && (
          <Animated.View style={{opacity: bottomOpacity}}>
            <View style={styles.bottomSection}>
              <Text style={[styles.accountText, {color: colors.textSecondary}]}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={[styles.loginLink, {color: colors.accent}]}>Login</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Avatar Picker Modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={[styles.modalContainer, {backgroundColor: colors.bgMedium, borderTopColor: colors.divider}]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>Choose Profile Picture</Text>
              <TouchableOpacity
                onPress={() => setPickerVisible(false)}
                style={[styles.closeModalBtn, {backgroundColor: colors.bgCard}]}>
                <Ionicons name="close" size={moderateScale(18)} color={colors.textPrimary} />
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
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {flex: 1},
  scrollContent: {flexGrow: 1},
  header: {
    paddingTop: Platform.OS === 'ios' ? verticalScale(56) : (StatusBar.currentHeight ?? 24) + verticalScale(10),
    paddingBottom: verticalScale(8),
    paddingHorizontal: scale(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: scale(16),
    bottom: verticalScale(8),
    width: scale(44),
    height: scale(44),
    borderRadius: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  headerTitle: {textAlign: 'center', fontSize: moderateScale(17), fontWeight: '700'},
  topSection: {alignItems: 'center', paddingTop: verticalScale(16), paddingBottom: verticalScale(24)},
  avatarAnimWrapper: {marginBottom: verticalScale(16)},
  avatarContainer: {position: 'relative'},
  avatarPlaceholder: {
    width: scale(100),
    height: scale(100),
    borderRadius: moderateScale(35),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  addPhotoBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  addPhotoIcon: {fontSize: moderateScale(16), fontWeight: '700', color: '#FFF'},
  title: {fontSize: moderateScale(26), fontWeight: '800', marginBottom: verticalScale(6)},
  subtitle: {fontSize: moderateScale(14), textAlign: 'center', paddingHorizontal: scale(20)},
  formSection: {paddingHorizontal: scale(24)},
  btn: {marginTop: verticalScale(4)},
  bottomSection: {flexDirection: 'row', justifyContent: 'center', paddingVertical: verticalScale(16)},
  accountText: {fontSize: moderateScale(14)},
  loginLink: {fontSize: moderateScale(14), fontWeight: '700'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  modalContainer: {
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    borderTopWidth: 1.5,
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(32),
    maxHeight: '60%',
  },
  modalHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(20), marginBottom: verticalScale(16)},
  modalTitle: {fontSize: moderateScale(16), fontWeight: '700'},
  closeModalBtn: {width: scale(32), height: scale(32), borderRadius: scale(16), justifyContent: 'center', alignItems: 'center'},
  avatarGrid: {paddingHorizontal: scale(16), paddingBottom: verticalScale(16)},
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
  modalAvatarWrapper: {
    flex: 1,
    aspectRatio: 1,
    margin: scale(8),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.05)',
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
  activeCheck: {color: '#FFF', fontSize: moderateScale(10), fontWeight: 'bold'},
});

export default SignUpScreen;
