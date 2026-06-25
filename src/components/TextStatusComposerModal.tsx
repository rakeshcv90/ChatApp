import React, {useState, useRef} from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface TextStatusComposerModalProps {
  visible: boolean;
  onClose: () => void;
  onPublish: (text: string, backgroundColor: string) => Promise<void>;
}

// Standard WhatsApp status background colors
const STATUS_COLORS = [
  '#9C27B0', // Purple
  '#075E54', // WhatsApp Teal
  '#00897B', // Deep Teal
  '#3F51B5', // Indigo
  '#FF5722', // Deep Orange
  '#4CAF50', // Green
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#4A148C', // Dark Purple
  '#311B92', // Dark Indigo
  '#004D40', // Dark Green
  '#1A237E', // Dark Blue
];

const TextStatusComposerModal: React.FC<TextStatusComposerModalProps> = ({
  visible,
  onClose,
  onPublish,
}) => {
  const [text, setText] = useState('');
  const [colorIndex, setColorIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const activeColor = STATUS_COLORS[colorIndex];

  const handleCycleColor = () => {
    setColorIndex(prev => (prev + 1) % STATUS_COLORS.length);
  };

  const handlePublish = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      await onPublish(text, activeColor);
      setText('');
    } catch (err) {
      console.warn('[TextStatusComposer] Publish failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor={activeColor} translucent />
      
      <KeyboardAvoidingView
        style={[styles.container, {backgroundColor: activeColor}]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safeArea}>
          
          {/* Header Row */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onClose}
              disabled={loading}>
              <Ionicons name="close" size={moderateScale(26)} color="#FFF" />
            </TouchableOpacity>
            
            <View style={styles.rightHeaderActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleCycleColor}
                disabled={loading}>
                <Ionicons name="color-palette" size={moderateScale(24)} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Centered Large Text Input */}
          <View style={styles.inputArea}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Type a status"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
              maxLength={250}
              editable={!loading}
            />
          </View>

          {/* Floating Send Button */}
          {text.trim().length > 0 && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={handlePublish}
                disabled={loading}
                activeOpacity={0.8}>
                {loading ? (
                  <ActivityIndicator size="small" color={activeColor} />
                ) : (
                  <Ionicons name="send" size={moderateScale(20)} color={activeColor} />
                )}
              </TouchableOpacity>
            </View>
          )}

        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingTop: Platform.OS === 'ios' ? verticalScale(6) : (StatusBar.currentHeight || 24) + verticalScale(8),
  },
  rightHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    width: scale(44),
    height: scale(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(32),
  },
  textInput: {
    color: '#FFF',
    fontSize: moderateScale(28),
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    maxHeight: verticalScale(300),
  },
  footer: {
    alignItems: 'flex-end',
    paddingRight: scale(20),
    paddingBottom: verticalScale(20),
  },
  sendBtn: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default TextStatusComposerModal;
