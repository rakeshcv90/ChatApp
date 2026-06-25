import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, FlatList, TouchableOpacity} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useTheme} from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import SectionHeader from '../components/SectionHeader';
import FAB from '../components/FAB';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {
  listenForCallHistory,
  CallHistoryItem,
} from '../services/CallService';

interface CallsTabProps {
  navigation?: any;
}

const CallsTab: React.FC<CallsTabProps> = ({navigation}) => {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [userNames, setUserNames] = useState<Record<string, {name: string; avatar: string}>>({});
  const myUid = auth().currentUser?.uid;

  // Listen for real call history
  useEffect(() => {
    if (!myUid) return;
    const unsubscribe = listenForCallHistory(myUid, (history) => {
      setCalls(history);

      // Fetch user info for all unique user IDs we haven't fetched yet
      const userIds = new Set<string>();
      history.forEach(call => {
        const otherId = call.callerId === myUid ? call.calleeId : call.callerId;
        if (otherId && !userNames[otherId]) {
          userIds.add(otherId);
        }
      });

      userIds.forEach(async (userId) => {
        try {
          const doc = await firestore().collection('users').doc(userId).get();
          if (doc.exists) {
            const data = doc.data();
            setUserNames(prev => ({
              ...prev,
              [userId]: {
                name: data?.displayName || 'Unknown',
                avatar: data?.photoURL || 'https://i.pravatar.cc/150?img=1',
              },
            }));
          }
        } catch (err) {
          console.error('[CallsTab] Error fetching user:', err);
        }
      });
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUid]);

  const getCallDirection = (item: CallHistoryItem): 'incoming' | 'outgoing' | 'missed' => {
    if (item.status === 'missed' || item.status === 'rejected') return 'missed';
    if (item.callerId === myUid) return 'outgoing';
    return 'incoming';
  };

  const getCallIconName = (direction: string) => {
    switch (direction) {
      case 'incoming': return 'arrow-down-outline';
      case 'outgoing': return 'arrow-up-outline';
      case 'missed': return 'close-outline';
      default: return 'call-outline';
    }
  };

  const getCallIconColor = (direction: string) => {
    switch (direction) {
      case 'incoming': return colors.accent;
      case 'outgoing': return colors.textSecondary;
      case 'missed': return colors.statusRed;
      default: return colors.textSecondary;
    }
  };

  const formatCallTime = (item: CallHistoryItem): string => {
    if (!item.createdAt) return '';
    const date = new Date(item.createdAt.seconds * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return `${date.toLocaleDateString([], {month: 'short', day: 'numeric'})}, ${timeStr}`;
  };

  const formatDuration = (item: CallHistoryItem): string => {
    if (!item.createdAt || !item.endedAt) return '';
    const start = item.createdAt.seconds;
    const end = item.endedAt.seconds;
    const durationSecs = Math.max(0, end - start);
    if (durationSecs < 60) return `${durationSecs}s`;
    const mins = Math.floor(durationSecs / 60);
    const secs = durationSecs % 60;
    return `${mins}m ${secs}s`;
  };

  const handleCallBack = (item: CallHistoryItem) => {
    if (!navigation) return;
    const otherId = item.callerId === myUid ? item.calleeId : item.callerId;
    const otherInfo = userNames[otherId];
    navigation.navigate('Call', {
      name: otherInfo?.name || item.callerName || 'Unknown',
      avatar: otherInfo?.avatar || item.callerAvatar || 'https://i.pravatar.cc/150?img=1',
      callType: item.callType,
      uid: otherId,
    });
  };

  const renderCallItem = ({item}: {item: CallHistoryItem}) => {
    const direction = getCallDirection(item);
    const isMissed = direction === 'missed';
    const otherId = item.callerId === myUid ? item.calleeId : item.callerId;
    const otherInfo = userNames[otherId];

    // For outgoing calls, show the callee name; for incoming, show caller name
    const displayName = item.callerId === myUid
      ? (item.calleeName || otherInfo?.name || 'Unknown')
      : (item.callerName || otherInfo?.name || 'Unknown');
    const displayAvatar = item.callerId === myUid
      ? (item.calleeAvatar || otherInfo?.avatar || 'https://i.pravatar.cc/150?img=1')
      : (item.callerAvatar || otherInfo?.avatar || 'https://i.pravatar.cc/150?img=1');

    const duration = formatDuration(item);

    return (
      <TouchableOpacity
        style={styles.callItem}
        activeOpacity={0.7}
        onPress={() => handleCallBack(item)}>
        <Avatar uri={displayAvatar} size="md" style={styles.avatar} />
        <View style={styles.callInfo}>
          <Text
            style={[
              styles.callName,
              {color: isMissed ? colors.statusRed : colors.textPrimary},
            ]}>
            {displayName}
          </Text>
          <View style={styles.callMeta}>
            <Ionicons
              name={getCallIconName(direction)}
              size={moderateScale(14)}
              color={getCallIconColor(direction)}
            />
            <Text
              style={[
                styles.callTime,
                {color: isMissed ? colors.statusRed : colors.textMuted},
              ]}>
              {formatCallTime(item)}
              {duration ? ` · ${duration}` : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() => handleCallBack(item)}>
          <Ionicons
            name={item.callType === 'video' ? 'videocam' : 'call'}
            size={moderateScale(18)}
            color={colors.accent}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, {backgroundColor: isDark ? 'rgba(139,92,246,0.1)' : 'rgba(79,70,229,0.08)'}]}>
        <Ionicons name="call-outline" size={moderateScale(40)} color={colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>No Call History</Text>
      <Text style={[styles.emptySubtitle, {color: colors.textMuted}]}>
        Your audio and video call history will appear here
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.bgDark}]}>
      {/* Create call link */}
      <TouchableOpacity
        style={[styles.createLink, {borderBottomColor: colors.divider}]}
        activeOpacity={0.7}>
        <View style={[styles.linkIcon, {backgroundColor: colors.accent}]}>
          <Ionicons name="link" size={moderateScale(22)} color={colors.bgDark} />
        </View>
        <View style={styles.linkInfo}>
          <Text style={[styles.linkTitle, {color: colors.textPrimary}]}>Create call link</Text>
          <Text style={[styles.linkSubtitle, {color: colors.textMuted}]}>
            Share a link for your ChatApp call
          </Text>
        </View>
      </TouchableOpacity>

      {calls.length > 0 && <SectionHeader title="Recent" />}

      <FlatList
        data={calls}
        renderItem={renderCallItem}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          {paddingBottom: insets.bottom + verticalScale(100)},
          calls.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, {backgroundColor: colors.divider}]} />
        )}
      />

      <FAB
        icon={<Ionicons name="call" size={moderateScale(22)} color={isDark ? colors.bgDark : colors.white} />}
        style={[styles.fab, {bottom: insets.bottom + verticalScale(20)}]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  createLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(13),
    borderBottomWidth: 1,
  },
  linkIcon: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(13),
  },
  linkInfo: {flex: 1},
  linkTitle: {fontSize: moderateScale(15), fontWeight: '600'},
  linkSubtitle: {fontSize: moderateScale(12), marginTop: verticalScale(2)},
  listContent: {paddingBottom: verticalScale(100)},
  emptyListContent: {flex: 1},
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
  },
  avatar: {marginRight: scale(13)},
  callInfo: {flex: 1},
  callName: {fontSize: moderateScale(15), fontWeight: '500'},
  callMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(3),
    gap: scale(4),
  },
  callTime: {fontSize: moderateScale(12)},
  callBtn: {
    width: scale(42),
    height: scale(42),
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    marginLeft: scale(16) + scale(48) + scale(13),
  },
  fab: {position: 'absolute', bottom: verticalScale(20), right: scale(20)},
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(40),
  },
  emptyIcon: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    marginBottom: verticalScale(8),
  },
  emptySubtitle: {
    fontSize: moderateScale(13),
    textAlign: 'center',
    lineHeight: moderateScale(19),
  },
});

export default CallsTab;
