import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  Image,
  Keyboard,
  InputAccessoryView,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {uploadChatMedia} from '../services/StorageService';

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');

// Session-level cache: once an image URL loads successfully it stays "done"
// across parent re-renders and navigating away/back within the same app session.
const loadedImageCache = new Set<string>();

// ── ChatImage ─────────────────────────────────────────────────────────────────
// Defined at module level so React never sees it as a new type on re-render,
// which would unmount/remount it and reset the download state to idle.
const ChatImage: React.FC<{uri: string; onPress: () => void}> = ({uri, onPress}) => {
  const [dlState, setDlState] = useState<'idle' | 'loading' | 'done'>(
    loadedImageCache.has(uri) ? 'done' : 'idle',
  );
  // Prevents onError from undoing a successful onLoad (RN fires both on some devices)
  const loadedRef = useRef(loadedImageCache.has(uri));

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={chatImageStyles.touch}
      onPress={() => {
        if (dlState === 'idle') setDlState('loading');
        else if (dlState === 'done') onPress();
      }}
    >
      {/* Only fetch from Storage after user taps the download icon */}
      {dlState !== 'idle' && (
        <Image
          source={{uri}}
          style={chatImageStyles.image}
          resizeMode="cover"
          onLoad={() => {
            // onLoad fires ONLY on success — safe to mark done
            loadedRef.current = true;
            loadedImageCache.add(uri);
            setDlState('done');
          }}
          onError={() => {
            // Only reset if image never loaded — guards against devices that fire
            // onError after onLoad (which would put the icon back after success)
            if (!loadedRef.current) {
              setDlState('idle');
            }
          }}
        />
      )}
      {/* Grey placeholder + download icon */}
      {dlState === 'idle' && (
        <View style={[chatImageStyles.image, chatImageStyles.placeholder]}>
          <View style={chatImageStyles.downloadCircle}>
            <Ionicons
              name="cloud-download-outline"
              size={moderateScale(28)}
              color="white"
            />
          </View>
        </View>
      )}
      {/* Spinner overlay while image is fetching */}
      {dlState === 'loading' && (
        <View style={chatImageStyles.overlay}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const chatImageStyles = StyleSheet.create({
  touch: {width: '100%', height: '100%'},
  image: {width: '100%', height: '100%'},
  placeholder: {
    backgroundColor: '#B8B8B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadCircle: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

interface ChatDetailScreenProps {
  navigation: any;
  route: any;
}

const INPUT_ACCESSORY_ID = 'chatDetailInput';

const ChatDetailScreen: React.FC<ChatDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { name, avatar, isOnline, uid } = route.params;
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [otherName, setOtherName] = useState(name);
  const [otherAvatar, setOtherAvatar] = useState(avatar);
  const [otherIsOnline, setOtherIsOnline] = useState(isOnline);
  const [otherLastSeen, setOtherLastSeen] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadingMessages, setUploadingMessages] = useState<
    {id: string; uri: string; progress: number}[]
  >([]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Exact header height used as KAV offset on iOS
  const headerHeight =
    Platform.OS === 'ios' ? insets.top + verticalScale(64) : 0;

  useEffect(() => {
    const myUid = auth().currentUser?.uid;
    if (!myUid || !uid) return;

    const chatId = [myUid, uid].sort().join('_');

    const unsubscribeUser = firestore()
      .collection('users')
      .doc(uid)
      .onSnapshot(
        doc => {
          if (doc.exists) {
            const data = doc.data();
            if (data?.displayName) setOtherName(data.displayName);
            if (data?.photoURL) setOtherAvatar(data.photoURL);
            if (data?.isOnline !== undefined) setOtherIsOnline(data.isOnline);
            if (data?.lastSeen) setOtherLastSeen(data.lastSeen);
          }
        },
        err => console.log('[ChatDetailScreen] profile error:', err),
      );

    const unsubscribe = firestore()
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .onSnapshot(
        snapshot => {
          const fetchedMessages: any[] = [];
          
          // Batch to mark unread messages as read
          const batch = firestore().batch();
          let hasUnread = false;

          snapshot.forEach(doc => {
            const data = doc.data();
            
            // If message is from the OTHER person and is unread, mark it as read
            if (data.senderId === uid && !data.isRead) {
              batch.update(doc.ref, { isRead: true });
              hasUnread = true;
            }

            fetchedMessages.push({
              id: doc.id,
              text: data.text || '',
              time: data.createdAt
                ? new Date(data.createdAt.seconds * 1000).toLocaleTimeString(
                    [],
                    { hour: '2-digit', minute: '2-digit' },
                  )
                : new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
              isSent: data.senderId === myUid,
              isRead: data.isRead || false,
              isDelivered: data.isDelivered || false,
              mediaType: data.mediaType || 'text',
              mediaUrl: data.mediaUrl || '',
            });
          });

          // Commit the batch if we found any unread messages and reset unread count
          if (hasUnread) {
            batch.commit().catch(err => console.log('[ChatDetail] Error marking as read:', err));
            firestore()
              .collection('chats')
              .doc(chatId)
              .set({[`unreadCount.${myUid}`]: 0}, {merge: true})
              .catch(() => {});
          }

          setMessages(fetchedMessages);
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: true }),
            150,
          );
        },
        err => console.error('[ChatDetail] Messages fetch error:', err),
      );

    return () => {
      unsubscribeUser();
      unsubscribe();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      const cleanupUid = auth().currentUser?.uid;
      if (cleanupUid) {
        const cleanupChatId = [cleanupUid, uid].sort().join('_');
        firestore()
          .collection('chats')
          .doc(cleanupChatId)
          .set({[`typing.${cleanupUid}`]: false}, {merge: true})
          .catch(() => {});
      }
    };
  }, [uid]);

  // Auto-scroll + track visibility when keyboard opens/closes
  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const formatLastSeen = (ts: any): string => {
    if (!ts) return 'last seen recently';
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const time = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    if (date.toDateString() === now.toDateString()) return `last seen today at ${time}`;
    if (date.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;
    const day = date.toLocaleDateString([], {month: 'short', day: 'numeric'});
    return `last seen ${day} at ${time}`;
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    const myUid = auth().currentUser?.uid;
    if (!myUid || !uid) return;
    const chatId = [myUid, uid].sort().join('_');
    const chatRef = firestore().collection('chats').doc(chatId);
    chatRef.set({[`typing.${myUid}`]: text.length > 0}, {merge: true}).catch(() => {});
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (text.length > 0) {
      typingTimerRef.current = setTimeout(() => {
        chatRef.set({[`typing.${myUid}`]: false}, {merge: true}).catch(() => {});
      }, 3000);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const myUid = auth().currentUser?.uid;
    if (!myUid || !uid) return;

    const chatId = [myUid, uid].sort().join('_');
    const messageText = inputText.trim();
    setInputText('');

    try {
      await firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .add({
          text: messageText,
          senderId: myUid,
          receiverId: uid,
          createdAt: firestore.FieldValue.serverTimestamp(),
          mediaType: 'text',
          isRead: false,
          isDelivered: true,
        });

      await firestore()
        .collection('chats')
        .doc(chatId)
        .set(
          {
            lastMessage: messageText,
            lastMessageAt: firestore.FieldValue.serverTimestamp(),
            lastSenderId: myUid,
            lastSenderName: auth().currentUser?.displayName || 'You',
            users: [myUid, uid],
            [`unreadCount.${uid}`]: firestore.FieldValue.increment(1),
          },
          {merge: true},
        );
    } catch (err) {
      console.error('[ChatDetail] Send message error:', err);
    }
  };

  const sendMediaMessage = async (uri: string, type: 'image' | 'video') => {
    const myUid = auth().currentUser?.uid;
    if (!myUid || !uid) return;
    const chatId = [myUid, uid].sort().join('_');
    const tempId = `uploading_${Date.now()}`;

    // Show local image immediately with 0% progress
    setUploadingMessages(prev => [...prev, {id: tempId, uri, progress: 0}]);

    try {
      const mediaUrl = await uploadChatMedia(uri, type, chatId, progress => {
        setUploadingMessages(prev =>
          prev.map(m => (m.id === tempId ? {...m, progress} : m)),
        );
      });

      // Upload done — remove optimistic item before Firestore fires
      setUploadingMessages(prev => prev.filter(m => m.id !== tempId));

      await firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .add({
          text: type === 'image' ? '📷 Photo' : '🎥 Video',
          senderId: myUid,
          receiverId: uid,
          createdAt: firestore.FieldValue.serverTimestamp(),
          mediaType: type,
          mediaUrl,
          isRead: false,
          isDelivered: true,
        });

      await firestore()
        .collection('chats')
        .doc(chatId)
        .set(
          {
            lastMessage: type === 'image' ? '📷 Photo' : '🎥 Video',
            lastMessageAt: firestore.FieldValue.serverTimestamp(),
            lastSenderId: myUid,
            lastSenderName: auth().currentUser?.displayName || 'You',
            users: [myUid, uid],
            [`unreadCount.${uid}`]: firestore.FieldValue.increment(1),
          },
          {merge: true},
        );
    } catch (err) {
      setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
      console.error('[ChatDetail] Send media error:', err);
      Alert.alert('Upload Failed', 'Could not send the image. Please try again.');
    }
  };

  const handleQuickCameraPhoto = () => {
    launchCamera({ mediaType: 'photo', quality: 0.8 }, response => {
      if (response.assets?.[0]?.uri)
        sendMediaMessage(response.assets[0].uri, 'image');
    });
  };

  const handlePickMediaOptions = () => {
    Alert.alert(
      'Send Attachment',
      'Select media type to share:',
      [
        { text: 'Take Photo', onPress: handleQuickCameraPhoto },
        {
          text: 'Choose Photo from Gallery',
          onPress: () =>
            launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, r => {
              if (r.assets?.[0]?.uri)
                sendMediaMessage(r.assets[0].uri, 'image');
            }),
        },
        {
          text: 'Record Video',
          onPress: () =>
            launchCamera({ mediaType: 'video', quality: 0.8 }, r => {
              if (r.assets?.[0]?.uri)
                sendMediaMessage(r.assets[0].uri, 'video');
            }),
        },
        {
          text: 'Choose Video from Gallery',
          onPress: () =>
            launchImageLibrary({ mediaType: 'video', quality: 0.8 }, r => {
              if (r.assets?.[0]?.uri)
                sendMediaMessage(r.assets[0].uri, 'video');
            }),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMedia = item.mediaType === 'image' || item.mediaType === 'video';

    // ── Uploading message (sender optimistic) ──
    if (item.uploading) {
      return (
        <View style={[styles.mediaBubble, styles.sentBubble]}>
          <View style={styles.mediaImageTouch}>
            <Image source={{uri: item.uri}} style={styles.mediaImage} resizeMode="cover" />
            <View style={styles.imageOverlay}>
              <View style={styles.uploadCircle}>
                <ActivityIndicator size="small" color="white" />
              </View>
              <Text style={styles.uploadProgressText}>
                {Math.round(item.progress * 100)}%
              </Text>
            </View>
          </View>
          <View style={styles.mediaFooter}>
            <Text style={styles.mediaTime}> </Text>
          </View>
        </View>
      );
    }

    // ── Media messages (image / video) ──
    if (isMedia) {
      return (
        <View
          style={[
            styles.mediaBubble,
            item.isSent ? styles.sentBubble : styles.receivedBubble,
          ]}
        >
          {item.mediaType === 'image' ? (
            item.isSent ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedImageUri(item.mediaUrl)}
                style={styles.mediaImageTouch}
              >
                <Image
                  source={{uri: item.mediaUrl}}
                  style={styles.mediaImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <ChatImage
                uri={item.mediaUrl}
                onPress={() => setSelectedImageUri(item.mediaUrl)}
              />
            )
          ) : (
            <View
              style={[styles.videoPlaceholder, { backgroundColor: colors.bgDark }]}
            >
              <Ionicons
                name="play-circle"
                size={moderateScale(42)}
                color={colors.white}
              />
              <Text style={[styles.videoText, { color: colors.white }]}>
                Play Video
              </Text>
            </View>
          )}
          <View style={styles.mediaFooter}>
            <Text style={styles.mediaTime}>{item.time}</Text>
            {item.isSent && (
              <Text
                style={[
                  styles.mediaReceipt,
                  { color: item.isRead ? colors.statusBlue : 'rgba(255,255,255,0.7)' },
                ]}
              >
                {item.isRead ? '✓✓' : item.isDelivered ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </View>
      );
    }

    // ── Text messages ──
    return (
      <View
        style={[
          styles.messageBubble,
          item.isSent
            ? [styles.sentBubble, { backgroundColor: colors.bubbleSent }]
            : [styles.receivedBubble, { backgroundColor: colors.bubbleReceived }],
        ]}
      >
        <Text style={[styles.messageText, { color: colors.textPrimary }]}>
          {item.text}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, { color: colors.textMuted }]}>
            {item.time}
          </Text>
          {item.isSent && (
            <Text
              style={[
                styles.readReceipt,
                { color: item.isRead ? colors.statusBlue : colors.textMuted },
              ]}
            >
              {item.isRead ? '✓✓' : item.isDelivered ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.bubbleTail,
            item.isSent
              ? [styles.sentTail, { borderLeftColor: colors.bubbleSent }]
              : [
                  styles.receivedTail,
                  { borderRightColor: colors.bubbleReceived },
                ],
          ]}
        />
      </View>
    );
  };

  return (
    <>
      {/*
       * KeyboardAvoidingView
       * iOS   → behavior="padding"  pushes content UP when keyboard opens
       * Android → behavior="height"  shrinks the view so input stays visible
       * keyboardVerticalOffset = header height so the bar doesn't over-shift
       */}
      <View style={[styles.container, {backgroundColor: colors.bgDark}]}>
        {/* ── Header — outside KAV so it never moves when keyboard opens ── */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.bgMedium,
              paddingTop: insets.top + verticalScale(10),
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.bgLight }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            activeOpacity={0.6}
          >
            <Ionicons
              name="chevron-back"
              size={moderateScale(22)}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
          <Avatar
            uri={otherAvatar}
            size="sm"
            isOnline={otherIsOnline}
            style={styles.headerAvatar}
          />
          <View style={styles.headerInfo}>
            <Text
              style={[styles.headerName, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {otherName}
            </Text>
            <Text
              style={[
                styles.headerStatus,
                { color: otherIsOnline ? colors.online : colors.textMuted },
              ]}
            >
              {otherIsOnline ? 'online' : formatLastSeen(otherLastSeen)}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.headerActionBtn,
                { backgroundColor: colors.bgLight },
              ]}
              onPress={() =>
                navigation.navigate('Call', {
                  name: otherName,
                  avatar: otherAvatar,
                  callType: 'video',
                  uid,
                })
              }
            >
              <Ionicons
                name="videocam"
                size={moderateScale(18)}
                color={colors.accent}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.headerActionBtn,
                { backgroundColor: colors.bgLight },
              ]}
              onPress={() =>
                navigation.navigate('Call', {
                  name: otherName,
                  avatar: otherAvatar,
                  callType: 'audio',
                  uid,
                })
              }
            >
              <Ionicons
                name="call"
                size={moderateScale(16)}
                color={colors.accent}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* KAV wraps only messages + input — header above it is unaffected.
            iOS: behavior="padding" adds padding equal to keyboard height.
            Android 0.76+ edge-to-edge: adjustResize no longer resizes the window,
                     so KAV with behavior="height" shrinks the view instead. */}
        <KeyboardAvoidingView
          style={{flex: 1}}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        {/* ── Messages ── */}
        <FlatList
          ref={flatListRef}
          data={[
            ...messages,
            ...uploadingMessages.map(m => ({
              ...m,
              uploading: true,
              isSent: true,
              mediaType: 'image',
              time: '',
              isRead: false,
              isDelivered: false,
            })),
          ]}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesList}
          style={[styles.messagesContainer, { backgroundColor: colors.bgDark }]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={15}
          windowSize={11}
          initialNumToRender={20}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />

        {/* ── Input Bar ──
            ONE TextInput lives here for the entire screen.
            iOS:     inputAccessoryViewID links it to the toolbar above keyboard.
                     KAV behavior="padding" pushes this bar above the keyboard.
            Android: KAV behavior="height" shrinks the screen so this bar is visible.
        */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.bgMedium,
              borderTopColor: isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.06)',
              // Safe-area bottom padding — on Android skip insets when keyboard
              // is open, otherwise the inset gap appears between bar and keyboard
              paddingBottom:
                Platform.OS === 'ios'
                  ? Math.max(insets.bottom, verticalScale(10))
                  : isKeyboardVisible
                  ? verticalScale(8)
                  : insets.bottom > 0
                  ? insets.bottom + verticalScale(4)
                  : verticalScale(10),
            },
          ]}
        >
          <View
            style={[
              styles.inputRow,
              {
                backgroundColor: isDark
                  ? 'rgba(30,41,59,0.85)'
                  : 'rgba(241,245,249,0.95)',
                borderColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <TouchableOpacity style={styles.inputIconBtn}>
              <Ionicons
                name="happy-outline"
                size={moderateScale(22)}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            {/* ★ THE ONLY TextInput in this component ★ */}
            <TextInput
              ref={inputRef}
              inputAccessoryViewID={
                Platform.OS === 'ios' ? INPUT_ACCESSORY_ID : undefined
              }
              style={[styles.textInput, { color: colors.textPrimary }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              scrollEnabled={false}
              maxLength={1000}
              returnKeyType="default"
            />

            <TouchableOpacity
              style={styles.inputIconBtn}
              onPress={handlePickMediaOptions}
            >
              <Ionicons
                name="attach"
                size={moderateScale(22)}
                color={colors.textMuted}
                style={styles.attachIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inputIconBtn}
              onPress={handleQuickCameraPhoto}
            >
              <Ionicons
                name="camera-outline"
                size={moderateScale(20)}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: colors.accent, shadowColor: colors.accent },
            ]}
            onPress={sendMessage}
            activeOpacity={0.7}
          >
            <Ionicons
              name={inputText.trim() ? 'send' : 'mic'}
              size={moderateScale(20)}
              color={colors.white}
            />
          </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>
      </View>

      {/* ── iOS InputAccessoryView ──
          Sticks just ABOVE the iOS keyboard when TextInput is focused.
          MUST be outside KeyboardAvoidingView.
          NO TextInput inside — only action buttons.
      */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
          <View
            style={[
              styles.accessoryBar,
              {
                backgroundColor: colors.bgMedium,
                borderTopColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.1)',
              },
            ]}
          >
            <View style={styles.accessoryLeft}>
              <TouchableOpacity
                style={styles.accessoryIconBtn}
                onPress={handlePickMediaOptions}
              >
                <Ionicons
                  name="attach"
                  size={moderateScale(22)}
                  color={colors.textMuted}
                  style={styles.attachIcon}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.accessoryIconBtn}
                onPress={handleQuickCameraPhoto}
              >
                <Ionicons
                  name="camera-outline"
                  size={moderateScale(20)}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.accessoryIconBtn}>
                <Ionicons
                  name="happy-outline"
                  size={moderateScale(22)}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.accessorySendBtn,
                { backgroundColor: colors.accent, shadowColor: colors.accent },
              ]}
              onPress={sendMessage}
              activeOpacity={0.7}
            >
              <Ionicons
                name={inputText.trim() ? 'send' : 'mic'}
                size={moderateScale(18)}
                color={colors.white}
              />
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

      {/* Full Screen Image Viewer Modal */}
      <Modal
        visible={selectedImageUri !== null}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelectedImageUri(null)}
      >
        <View style={styles.viewerOverlay}>
          {/* Close button — uses safe area insets */}
          <TouchableOpacity
            style={[
              styles.viewerCloseBtn,
              { top: insets.top + verticalScale(12) },
            ]}
            onPress={() => setSelectedImageUri(null)}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={moderateScale(26)} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Image — tap anywhere on the image to close */}
          {selectedImageUri && (
            <TouchableOpacity
              style={styles.viewerImageWrap}
              activeOpacity={1}
              onPress={() => setSelectedImageUri(null)}
            >
              <Image
                source={{ uri: selectedImageUri }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──
  // Note: paddingTop is set dynamically via insets in JSX
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: verticalScale(12),
    paddingHorizontal: scale(12),
  },
  backBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(8),
  },
  headerAvatar: { marginRight: scale(10) },
  headerInfo: { flex: 1 },
  headerName: { fontSize: moderateScale(16), fontWeight: '700' },
  headerStatus: { fontSize: moderateScale(11), marginTop: 2 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  headerActionBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Messages ──
  messagesContainer: { flex: 1 },
  messagesList: {
    paddingHorizontal: scale(12),
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(14),
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: scale(14),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(5),
    borderRadius: moderateScale(18),
    marginVertical: verticalScale(3),
    position: 'relative',
  },
  // Media bubble — no padding, no shadow, no card look
  mediaBubble: {
    maxWidth: '78%',
    width: scale(230),
    height: scale(180),
    borderRadius: moderateScale(14),
    marginVertical: verticalScale(3),
    overflow: 'hidden',
    position: 'relative',
  },
  mediaImageTouch: {
    width: '100%',
    height: '100%',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: verticalScale(6),
  },
  uploadCircle: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadProgressText: {
    color: 'white',
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  sentBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: moderateScale(6),
  },
  receivedBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: moderateScale(6),
  },
  messageText: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: verticalScale(2),
    gap: scale(4),
  },
  messageTime: { fontSize: moderateScale(10) },
  readReceipt: { fontSize: moderateScale(11) },
  bubbleTail: { position: 'absolute', top: 0, width: 0, height: 0 },
  sentTail: {
    right: -6,
    borderLeftWidth: 8,
    borderTopWidth: 8,
    borderTopColor: 'transparent',
  },
  receivedTail: {
    left: -6,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderTopColor: 'transparent',
  },
  videoPlaceholder: {
    width: '100%',
    height: scale(120),
    borderRadius: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(2),
    gap: verticalScale(4),
  },
  videoText: { fontSize: moderateScale(11), fontWeight: '600' },

  // ── Input Bar ──
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: scale(12),
    paddingTop: verticalScale(8),
    borderTopWidth: 1,
  },
  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: moderateScale(24),
    paddingHorizontal: scale(8),
    marginRight: scale(8),
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: verticalScale(48),
    maxHeight: verticalScale(120),
  },
  inputIconBtn: {
    width: scale(36),
    height: verticalScale(48),
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: moderateScale(15),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(4),
    maxHeight: verticalScale(100),
  },
  attachIcon: { transform: [{ rotate: '45deg' }] },
  sendBtn: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: scale(4) },
    shadowOpacity: 0.4,
    shadowRadius: scale(10),
    elevation: 8,
  },

  // ── iOS InputAccessoryView toolbar ──
  accessoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderTopWidth: 1,
  },
  accessoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  accessoryIconBtn: {
    width: scale(36),
    height: scale(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessorySendBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: scale(2) },
    shadowOpacity: 0.35,
    shadowRadius: scale(6),
    elevation: 6,
  },

  // ── Image Viewer Modal Styles ──
  viewerOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCloseBtn: {
    position: 'absolute',
    // top is set dynamically via insets in JSX
    right: scale(16),
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImageWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: SCREEN_W,
    height: SCREEN_H,
  },

  // ── Media Footer Styles (Overlayed on top of image/video) ──
  mediaFooter: {
    position: 'absolute',
    bottom: scale(6),
    right: scale(8),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(10),
    gap: scale(4),
  },
  mediaTime: {
    fontSize: moderateScale(10),
    color: '#FFFFFF',
    fontWeight: '500',
  },
  mediaReceipt: {
    fontSize: moderateScale(11),
    fontWeight: 'bold',
  },
});

export default ChatDetailScreen;
