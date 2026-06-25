import React, { useState, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import FAB from '../components/FAB';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface ChatItemProps {
  item: {
    id: string;
    uid: string;
    name: string;
    avatar: string;
    about: string;
    phoneNumber: string;
    isOnline?: boolean;
    lastMessage?: string;
    lastSenderName?: string; // "You" or sender's first name
    lastSenderId?: string;
    time?: string;
    unreadCount?: number;
    isTyping?: boolean;
  };
  onPress: () => void;
}

const ChatItem: React.FC<ChatItemProps> = ({ item, onPress }) => {
  const { colors } = useTheme();
  const animValue = useRef(new Animated.Value(1)).current;
  const myUid = auth().currentUser?.uid;

  const onPressIn = () =>
    Animated.timing(animValue, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  const onPressOut = () =>
    Animated.spring(animValue, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();

  // Prefix last message with sender label: "You: ..." or "<FirstName>: ..."
  const getLastMessagePreview = () => {
    if (!item.lastMessage) return '';
    if (item.isTyping) return null; // handled separately

    const isMine = item.lastSenderId === myUid;
    const prefix = isMine ? 'You: ' : '';
    return `${prefix}${item.lastMessage}`;
  };

  return (
    <Animated.View style={{ transform: [{ scale: animValue }] }}>
      <TouchableOpacity
        style={styles.chatItem}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.85}
      >
        <Avatar
          uri={item?.avatar}
          size="md"
          isOnline={item.isOnline}
          style={styles.avatar}
        />

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text
              style={[styles.chatName, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text
              style={[
                styles.chatTime,
                {
                  color:
                    (item.unreadCount ?? 0) > 0 ? colors.accent : colors.textMuted,
                },
              ]}
            >
              {item.time}
            </Text>
          </View>
          <View style={styles.chatFooter}>
            <View style={styles.messageRow}>
              {item.isTyping ? (
                <Text style={[styles.typingText, { color: colors.accent }]}>
                  typing...
                </Text>
              ) : (
                <Text
                  style={[
                    styles.lastMessage,
                    {
                      color: (item.unreadCount ?? 0) > 0
                        ? colors.textPrimary
                        : colors.textMuted,
                      fontWeight: (item.unreadCount ?? 0) > 0 ? '700' : 'normal',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {getLastMessagePreview()}
                </Text>
              )}
            </View>
            {(item.unreadCount ?? 0) > 0 && (
              <View
                style={[
                  styles.unreadBadge,
                  { backgroundColor: colors.unreadBadge },
                ]}
              >
                <Text style={[styles.unreadText, { color: colors.white }]}>
                  {(item.unreadCount ?? 0) > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

interface ChatsTabProps {
  navigation: any;
}

const ChatsTab: React.FC<ChatsTabProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const currentUid = auth().currentUser?.uid;
      if (!currentUid) {
        setLoading(false);
        return;
      }

      // Holds the base user profiles keyed by uid
      const baseUsersMap = new Map<string, any>();
      // Holds the latest chat data keyed by other user's uid
      const chatDataMap = new Map<string, any>();
      // All active chat listeners so we can clean them up
      const chatListeners: (() => void)[] = [];

      const formatTime = (lastMessageAt: any): string => {
        if (!lastMessageAt) return '';
        const ts = lastMessageAt.toDate
          ? lastMessageAt.toDate()
          : new Date(lastMessageAt.seconds * 1000);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (ts.toDateString() === now.toDateString()) {
          return ts.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        }
        if (ts.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return ts.toLocaleDateString([], {month: 'short', day: 'numeric'});
      };

      const rebuildAndSetUsers = () => {
        const merged = Array.from(baseUsersMap.values()).map(user => ({
          ...user,
          ...(chatDataMap.get(user.uid) || {}),
        }));
        merged.sort((a, b) => {
          if (a.lastMessageAt && b.lastMessageAt) {
            return (b.lastMessageAt.seconds || 0) - (a.lastMessageAt.seconds || 0);
          }
          if (a.lastMessageAt) return -1;
          if (b.lastMessageAt) return 1;
          return a.name.localeCompare(b.name);
        });
        setUsers(merged);
        setLoading(false);
      };

      // ── Step 1: Listen to all users ───────────────────────────────────────────
      const unsubscribeUsers = firestore()
        .collection('users')
        .orderBy('displayName', 'asc')
        .onSnapshot(
          snapshot => {
            // Tear down old per-chat listeners before rebuilding
            chatListeners.forEach(u => u());
            chatListeners.length = 0;
            baseUsersMap.clear();

            snapshot.forEach(doc => {
              const data = doc.data();
              if (data.uid === currentUid) return;
              baseUsersMap.set(data.uid, {
                id: data.uid,
                uid: data.uid,
                name: data.displayName || 'Unknown',
                avatar: data.photoURL || 'https://i.pravatar.cc/150?img=33',
                phoneNumber: data.phoneNumber || '',
                about: data.about || 'Hey there! I am using ChatApp.',
                isOnline: data.isOnline || false,
                lastMessage: '',
                lastSenderId: null,
                time: '',
                unreadCount: 0,
                isTyping: false,
                lastMessageAt: null,
              });
            });

            // ── Step 2: Real-time listener on each chat document ──────────────
            baseUsersMap.forEach(user => {
              const chatId = [currentUid, user.uid].sort().join('_');

              const unsubChat = firestore()
                .collection('chats')
                .doc(chatId)
                .onSnapshot(
                  chatDoc => {
                    if (!chatDoc.exists) {
                      chatDataMap.set(user.uid, {isTyping: false});
                    } else {
                      const cd = chatDoc.data()!;
                      chatDataMap.set(user.uid, {
                        lastMessage: cd.lastMessage || '',
                        lastSenderId: cd.lastSenderId || null,
                        time: formatTime(cd.lastMessageAt),
                        unreadCount: cd.unreadCount?.[currentUid] ?? 0,
                        isTyping: cd.typing?.[user.uid] === true,
                        lastMessageAt: cd.lastMessageAt || null,
                      });
                    }
                    rebuildAndSetUsers();
                  },
                  err => console.log('[ChatsTab] chat listener error', err),
                );

              chatListeners.push(unsubChat);
            });

            rebuildAndSetUsers();
          },
          error => {
            console.error('[ChatsTab] Firestore fetch error:', error);
            setLoading(false);
          },
        );

      return () => {
        unsubscribeUsers();
        chatListeners.forEach(u => u());
      };
    }, [])
  );

  const renderChatItem = ({ item }: { item: any }) => (
    <ChatItem
      item={item}
      onPress={() =>
        navigation.navigate('ChatDetail', {
          name: item.name,
          avatar: item.avatar,
          isOnline: item.isOnline,
          uid: item.uid,
          phoneNumber: item.phoneNumber,
        })
      }
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgDark }]}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading chats...
          </Text>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons
            name="people-outline"
            size={moderateScale(48)}
            color={colors.textMuted}
          />
          <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
            No other registered users yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderChatItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + verticalScale(80) }]}
          ItemSeparatorComponent={() => (
            <View
              style={[styles.separator, { backgroundColor: colors.divider }]}
            />
          )}
        />
      )}

      <FAB
        icon={
          <Ionicons
            name="chatbubble-ellipses"
            size={moderateScale(24)}
            color={isDark ? colors.bgDark : colors.white}
          />
        }
        style={[styles.fab, { bottom: insets.bottom + verticalScale(20) }]}
        onPress={() => navigation.navigate('SelectContact')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingTop: verticalScale(4),
    paddingBottom: verticalScale(80),
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    marginHorizontal: scale(12),
    marginTop: verticalScale(4),
    borderRadius: moderateScale(16),
  },
  avatar: { marginRight: scale(14) },
  chatInfo: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  chatName: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    flex: 1,
    marginRight: scale(8),
  },
  chatTime: { fontSize: moderateScale(11) },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(8),
  },
  lastMessage: { fontSize: moderateScale(13), flex: 1 },
  typingText: {
    fontSize: moderateScale(13),
    fontStyle: 'italic',
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(5),
  },
  unreadText: { fontSize: moderateScale(11), fontWeight: '700' },
  separator: {
    height: 0,
  },
  fab: { position: 'absolute', bottom: verticalScale(20), right: scale(20) },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(32),
  },
  loadingText: {
    fontSize: moderateScale(14),
    marginTop: verticalScale(12),
  },
  emptyText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    marginTop: verticalScale(16),
    textAlign: 'center',
  },
});

export default ChatsTab;
