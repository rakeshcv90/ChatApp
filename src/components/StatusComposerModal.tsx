import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useTheme} from '../context/ThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface StatusComposerModalProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  onPublish: (caption: string) => Promise<void>;
}

const StatusComposerModal: React.FC<StatusComposerModalProps> = ({
  visible,
  imageUri,
  onClose,
  onPublish,
}) => {
  const {colors} = useTheme();
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePublish = async () => {
    setLoading(true);
    try {
      await onPublish(caption);
      setCaption('');
    } catch (err) {
      console.warn('[StatusComposer] Publish failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safeArea}>
          
          {/* Header Action Row */}
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.closeBtn, {backgroundColor: 'rgba(0,0,0,0.4)'}]}
              onPress={onClose}
              disabled={loading}>
              <Ionicons name="close" size={moderateScale(24)} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Status Preview</Text>
            <View style={{width: scale(44)}} />
          </View>

          {/* Image Preview Container */}
          <View style={styles.previewContainer}>
            {imageUri ? (
              <Image
                source={{uri: imageUri}}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}
          </View>

          {/* Caption Input & Publish button */}
          <View style={[styles.footer, {backgroundColor: 'rgba(15, 23, 42, 0.95)'}]}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Add a caption..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={200}
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.sendBtn, {backgroundColor: colors.accent}]}
                onPress={handlePublish}
                disabled={loading}
                activeOpacity={0.8}>
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="send" size={moderateScale(20)} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingTop: Platform.OS === 'ios' ? 0 : verticalScale(16),
    zIndex: 10,
  },
  closeBtn: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: verticalScale(16),
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(16),
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: moderateScale(25),
    paddingLeft: scale(16),
    paddingRight: scale(6),
    paddingVertical: verticalScale(6),
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: moderateScale(15),
    maxHeight: verticalScale(100),
    paddingVertical: verticalScale(8),
  },
  sendBtn: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: scale(8),
  },
});

export default StatusComposerModal;
