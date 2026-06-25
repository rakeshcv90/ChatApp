import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import AppButton from '../components/AppButton';
import BackgroundDecoration from '../components/BackgroundDecoration';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AppLoader from '../components/AppLoader';

interface Country {
  name: string;
  code: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  {name: 'India', code: '+91', flag: '🇮🇳'},
  {name: 'United States', code: '+1', flag: '🇺🇸'},
  {name: 'United Kingdom', code: '+44', flag: '🇬🇧'},
  {name: 'Canada', code: '+1', flag: '🇨🇦'},
  {name: 'Australia', code: '+61', flag: '🇦🇺'},
  {name: 'Germany', code: '+49', flag: '🇩🇪'},
  {name: 'Japan', code: '+81', flag: '🇯🇵'},
  {name: 'Singapore', code: '+65', flag: '🇸🇬'},
  {name: 'France', code: '+33', flag: '🇫🇷'},
  {name: 'Brazil', code: '+55', flag: '🇧🇷'},
  {name: 'UAE', code: '+971', flag: '🇦🇪'},
  {name: 'Saudi Arabia', code: '+966', flag: '🇸🇦'},
];

interface LoginScreenProps {
  navigation: any;
}

const LoginScreen: React.FC<LoginScreenProps> = ({navigation}) => {
  const {colors, isDark} = useTheme();
  const {sendOTP} = useAuth();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [flag, setFlag] = useState('🇮🇳');
  const [isFocused, setIsFocused] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Animations ──────────────────────────────────────────────────────────────
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(verticalScale(30))).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(verticalScale(50))).current;
  const termsOpacity = useRef(new Animated.Value(0)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.stagger(150, [
        Animated.parallel([
          Animated.spring(logoScale, {toValue: 1, friction: 6, tension: 80, useNativeDriver: true}),
          Animated.timing(logoOpacity, {toValue: 1, duration: 600, useNativeDriver: true}),
        ]),
        Animated.parallel([
          Animated.timing(titleOpacity, {toValue: 1, duration: 500, useNativeDriver: true}),
          Animated.spring(titleTranslateY, {toValue: 0, friction: 6, useNativeDriver: true}),
        ]),
        Animated.parallel([
          Animated.timing(cardOpacity, {toValue: 1, duration: 600, useNativeDriver: true}),
          Animated.spring(cardTranslateY, {toValue: 0, friction: 7, tension: 40, useNativeDriver: true}),
        ]),
      ]),
      Animated.timing(termsOpacity, {toValue: 1, duration: 400, useNativeDriver: true}),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoPulse, {toValue: 1.05, duration: 2000, useNativeDriver: true}),
          Animated.timing(logoPulse, {toValue: 1, duration: 2000, useNativeDriver: true}),
        ]),
      ).start();
    });
  }, [logoScale, logoOpacity, titleOpacity, titleTranslateY, cardOpacity, cardTranslateY, termsOpacity, logoPulse]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {toValue: 10, duration: 50, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: -10, duration: 50, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: 8, duration: 50, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: -8, duration: 50, useNativeDriver: true}),
      Animated.timing(shakeAnim, {toValue: 0, duration: 50, useNativeDriver: true}),
    ]).start();
  };

  const handleSendOTP = async () => {
    if (phoneNumber.length < 10) {
      triggerShake();
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.');
      return;
    }

    const fullPhone = `${countryCode}${phoneNumber}`;
    setLoading(true);
    try {
      await sendOTP(fullPhone);
      setLoading(false);
      // Navigate to OTP screen passing the phone details for display
      navigation.navigate('OTP', {
        phoneNumber: fullPhone,
        displayPhone: `${flag} ${countryCode} ${phoneNumber}`,
      });
    } catch (error: any) {
      setLoading(false);
      triggerShake();
      console.error('[Auth] Failed to send OTP:', error);
      
      let message = 'Failed to send OTP. Please try again.';
      if (error.code === 'functions/invalid-argument') {
        message = 'Invalid phone number. Please check the number and try again.';
      } else if (error.code === 'functions/resource-exhausted') {
        message = 'Too many requests. Please wait a few minutes and try again.';
      } else if (error.code === 'functions/internal') {
        message = 'Server error. Please try again later.';
      } else if (error.message) {
        message = error.message;
      }

      Alert.alert('Error', message);
    }
  };

  const selectCountry = (country: Country) => {
    setCountryCode(country.code);
    setFlag(country.flag);
    setCountryPickerVisible(false);
  };

  const renderCountryItem = ({item}: {item: Country}) => (
    <TouchableOpacity
      style={[styles.countryItem, {borderBottomColor: colors.divider}]}
      onPress={() => selectCountry(item)}>
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <Text style={[styles.countryName, {color: colors.textPrimary}]}>{item.name}</Text>
      <Text style={[styles.countryCodeVal, {color: colors.accent}]}>{item.code}</Text>
    </TouchableOpacity>
  );

  const statusBarTop = Platform.OS === 'ios' ? 0 : (StatusBar.currentHeight ?? 24);

  return (
    <KeyboardAvoidingView
      style={[styles.container, {backgroundColor: colors.bgDark}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <BackgroundDecoration />
      <AppLoader visible={loading} message="Sending OTP..." />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, {paddingTop: statusBarTop}]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Logo + Heading */}
        <Animated.View style={[styles.topSection, {opacity: titleOpacity}]}>
          <Animated.View
            style={[
              styles.logoBox,
              {
                backgroundColor: colors.accent,
                shadowColor: colors.accent,
                transform: [{scale: Animated.multiply(logoScale, logoPulse)}],
                opacity: logoOpacity,
              },
            ]}>
            <Text style={styles.logoEmoji}>💬</Text>
          </Animated.View>
          <Animated.Text
            style={[styles.title, {color: colors.textPrimary, transform: [{translateY: titleTranslateY}]}]}>
            Welcome to ChatApp
          </Animated.Text>
          <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
            Enter your phone number — we'll send{'\n'}a verification code via SMS
          </Text>
        </Animated.View>

        {/* Form Card */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.bgCard,
              borderColor: isFocused ? colors.accent : colors.divider,
              borderWidth: isDark ? 1.5 : 0,
              opacity: cardOpacity,
              transform: [{translateY: cardTranslateY}],
            },
          ]}>
          <Text style={[styles.label, {color: colors.textSecondary}]}>Phone Number</Text>

          <Animated.View
            style={[
              styles.phoneRow,
              {
                backgroundColor: colors.bgInput,
                borderColor: isFocused ? colors.accent : colors.divider,
                transform: [{translateX: shakeAnim}],
              },
            ]}>
            {/* Country Code Picker */}
            <TouchableOpacity
              style={styles.countryCodeBtn}
              onPress={() => setCountryPickerVisible(true)}>
              <Text style={styles.flag}>{flag}</Text>
              <Text style={[styles.countryCodeText, {color: colors.textPrimary}]}>{countryCode}</Text>
              <Ionicons name="chevron-down" size={moderateScale(12)} color={colors.textMuted} style={styles.dropdownIcon} />
            </TouchableOpacity>
            <View style={[styles.dividerVertical, {backgroundColor: colors.divider}]} />
            <TextInput
              style={[styles.phoneInput, {color: colors.textPrimary}]}
              placeholder="Enter phone number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              maxLength={12}
            />
          </Animated.View>

          <AppButton label="SEND OTP" rightIcon="➔" onPress={handleSendOTP} style={styles.btn} />
        </Animated.View>

        {/* Terms */}
        <Animated.View style={[styles.termsSection, {opacity: termsOpacity}]}>
          <Text style={[styles.termsText, {color: colors.textMuted}]}>
            By continuing, you agree to our{' '}
            <Text style={[styles.termsLink, {color: colors.textLink}]}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={[styles.termsLink, {color: colors.textLink}]}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Country Picker Modal */}
      <Modal
        visible={countryPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCountryPickerVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCountryPickerVisible(false)}>
          <View style={[styles.modalContainer, {backgroundColor: colors.bgMedium, borderTopColor: colors.divider}]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>Select Country</Text>
              <TouchableOpacity
                onPress={() => setCountryPickerVisible(false)}
                style={[styles.closeModalBtn, {backgroundColor: colors.bgCard}]}>
                <Ionicons name="close" size={moderateScale(18)} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              renderItem={renderCountryItem}
              keyExtractor={item => item.name}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  scrollContent: {flexGrow: 1, paddingHorizontal: scale(20), paddingBottom: verticalScale(32)},
  topSection: {alignItems: 'center', paddingTop: verticalScale(48), paddingBottom: verticalScale(28)},
  logoBox: {
    width: scale(84),
    height: scale(84),
    borderRadius: moderateScale(26),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(22),
    shadowOffset: {width: 0, height: scale(6)},
    shadowOpacity: 0.35,
    shadowRadius: scale(16),
    elevation: 12,
  },
  logoEmoji: {fontSize: moderateScale(42)},
  title: {fontSize: moderateScale(28), fontWeight: '800', marginBottom: verticalScale(8), letterSpacing: -0.5, textAlign: 'center'},
  subtitle: {fontSize: moderateScale(13), textAlign: 'center', paddingHorizontal: scale(20), lineHeight: moderateScale(20)},
  card: {
    borderRadius: moderateScale(20),
    padding: scale(22),
    shadowOffset: {width: 0, height: scale(4)},
    shadowOpacity: 0.08,
    shadowRadius: scale(12),
    elevation: 4,
  },
  label: {fontSize: moderateScale(11), fontWeight: '700', marginBottom: verticalScale(10), letterSpacing: 0.8, textTransform: 'uppercase'},
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: moderateScale(14),
    height: verticalScale(54),
    borderWidth: 1.5,
    marginBottom: verticalScale(18),
    overflow: 'hidden',
  },
  countryCodeBtn: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(12), height: '100%'},
  flag: {fontSize: moderateScale(20), marginRight: scale(5)},
  countryCodeText: {fontSize: moderateScale(15), fontWeight: '600'},
  dropdownIcon: {marginLeft: scale(4)},
  dividerVertical: {width: 1, height: verticalScale(30)},
  phoneInput: {flex: 1, fontSize: moderateScale(15), paddingHorizontal: scale(14), fontWeight: '500'},
  btn: {marginBottom: verticalScale(16)},
  termsSection: {paddingHorizontal: scale(20), paddingTop: verticalScale(24), alignItems: 'center'},
  termsText: {fontSize: moderateScale(11), textAlign: 'center', lineHeight: moderateScale(18)},
  termsLink: {fontWeight: '600'},
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
  listContainer: {paddingHorizontal: scale(16)},
  countryItem: {flexDirection: 'row', alignItems: 'center', paddingVertical: verticalScale(14), borderBottomWidth: 1},
  countryFlag: {fontSize: moderateScale(22), marginRight: scale(14)},
  countryName: {flex: 1, fontSize: moderateScale(15), fontWeight: '600'},
  countryCodeVal: {fontSize: moderateScale(15), fontWeight: '700'},
});

export default LoginScreen;
