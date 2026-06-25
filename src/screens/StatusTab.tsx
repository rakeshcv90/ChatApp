import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  DeviceEventEmitter,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import SectionHeader from '../components/SectionHeader';
import FAB from '../components/FAB';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {uploadStatusImage} from '../services/StorageService';
import StatusComposerModal from '../components/StatusComposerModal';
import StoryViewerModal from '../components/StoryViewerModal';
import TextStatusComposerModal from '../components/TextStatusComposerModal';

const formatTimeAgo = (date: Date) => {
  const diffMs = new Date().getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  return 'Yesterday';
};

const StatusTab: React.FC = () => {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  
  // Real-time Firestore statuses state
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Status Composer Modal state
  const [composerVisible, setComposerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Text Status Composer Modal state
  const [textComposerVisible, setTextComposerVisible] = useState(false);

  // Story Viewer Modal state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerStatuses, setViewerStatuses] = useState<any[]>([]);

  // Subscribe to active status updates (less than 24 hours old)
  useEffect(() => {
    const now = new Date();
    
    const unsubscribe = firestore()
      .collection('statuses')
      .where('expiresAt', '>', firestore.Timestamp.fromDate(now))
      .onSnapshot(
        snapshot => {
          const list: any[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            list.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
              expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(),
            });
          });
          
          // Sort in memory by createdAt ascending so older stories play first
          list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          
          // Prefetch images in background for instant loading
          list.forEach(item => {
            if (item.imageUrl) {
              Image.prefetch(item.imageUrl).catch(err => {
                console.log('[StatusTab] Prefetch failed for:', item.imageUrl, err);
              });
            }
          });
          
          setStatuses(list);
          setLoading(false);
        },
        err => {
          console.error('[StatusTab] Firestore subscribe error:', err);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, []);

  const myUid = auth().currentUser?.uid;
  const myProfile = {
    name: auth().currentUser?.displayName || 'My Status',
    avatar: auth().currentUser?.photoURL || '',
  };

  // Group active statuses of the logged-in user
  const myActiveStatuses = useMemo(() => {
    return statuses.filter(s => s.userId === myUid);
  }, [statuses, myUid]);

  // Group other users' active statuses and categorize into Recent/Viewed lists
  const groupedStatuses = useMemo(() => {
    if (!myUid) return {recent: [], viewed: []};
    
    const groups: Record<string, any> = {};

    statuses.forEach(status => {
      // Exclude current user's statuses from lists
      if (status.userId === myUid) return;

      if (!groups[status.userId]) {
        groups[status.userId] = {
          userId: status.userId,
          name: status.userName,
          avatar: status.userAvatar,
          statuses: [],
        };
      }
      groups[status.userId].statuses.push(status);
    });

    const recent: any[] = [];
    const viewed: any[] = [];

    Object.values(groups).forEach(group => {
      // If there is any status not seen by the current user
      const hasUnseen = group.statuses.some((s: any) => !s.seenBy?.includes(myUid));
      
      const latestStatus = group.statuses[group.statuses.length - 1];
      const timeString = formatTimeAgo(latestStatus.createdAt);

      const formattedItem = {
        id: group.userId,
        userId: group.userId,
        name: group.name,
        avatar: group.avatar,
        time: timeString,
        isSeen: !hasUnseen,
        statuses: group.statuses,
      };

      if (hasUnseen) {
        recent.push(formattedItem);
      } else {
        viewed.push(formattedItem);
      }
    });

    return {recent, viewed};
  }, [statuses, myUid]);

  // Status Media Selection methods
  const handleLaunchCamera = () => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
      },
      response => {
        if (response.assets && response.assets.length > 0) {
          const uri = response.assets[0].uri;
          if (uri) {
            setSelectedImage(uri);
            setComposerVisible(true);
          }
        }
      }
    );
  };

  const handleLaunchGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
      },
      response => {
        if (response.assets && response.assets.length > 0) {
          const uri = response.assets[0].uri;
          if (uri) {
            setSelectedImage(uri);
            setComposerVisible(true);
          }
        }
      }
    );
  };

  const handlePickStatusImage = () => {
    Alert.alert(
      'Create Status Update',
      'Choose source:',
      [
        {text: 'Camera', onPress: handleLaunchCamera},
        {text: 'Gallery', onPress: handleLaunchGallery},
        {text: 'Cancel', style: 'cancel'},
      ],
      {cancelable: true}
    );
  };

  // Listen for direct camera launch from header
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('LAUNCH_STATUS_CAMERA_DIRECT', () => {
      handleLaunchCamera();
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Upload and write status document to Firestore
  const handlePublishStatus = async (caption: string) => {
    const currentUser = auth().currentUser;
    if (!currentUser || !selectedImage) return;

    try {
      const uploadedUrl = await uploadStatusImage(selectedImage, currentUser.uid);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 Hours later

      await firestore()
        .collection('statuses')
        .add({
          userId: currentUser.uid,
          userName: currentUser.displayName || 'Unknown',
          userAvatar: currentUser.photoURL || '',
          imageUrl: uploadedUrl,
          text: caption.trim(),
          createdAt: firestore.FieldValue.serverTimestamp(),
          expiresAt: firestore.Timestamp.fromDate(expiresAt),
          seenBy: [],
        });

      setComposerVisible(false);
      setSelectedImage(null);
      Alert.alert('Success', 'Status updated successfully!');
    } catch (err) {
      console.error('[StatusTab] Publish status error:', err);
      Alert.alert('Error', 'Failed to publish status update.');
      throw err; // throw back to composer to reset loading state
    }
  };

  const handlePublishTextStatus = async (text: string, backgroundColor: string) => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 Hours later

      await firestore()
        .collection('statuses')
        .add({
          userId: currentUser.uid,
          userName: currentUser.displayName || 'Unknown',
          userAvatar: currentUser.photoURL || '',
          imageUrl: '', // text-only status has no image
          text: text.trim(),
          backgroundColor: backgroundColor,
          createdAt: firestore.FieldValue.serverTimestamp(),
          expiresAt: firestore.Timestamp.fromDate(expiresAt),
          seenBy: [],
        });

      setTextComposerVisible(false);
      Alert.alert('Success', 'Status updated successfully!');
    } catch (err) {
      console.error('[StatusTab] Publish text status error:', err);
      Alert.alert('Error', 'Failed to publish status update.');
      throw err;
    }
  };

  const handleOpenStoryViewer = (storyList: any[]) => {
    setViewerStatuses(storyList);
    setViewerVisible(true);
  };

  // Callback when a user views a status
  const handleStatusViewed = async (statusId: string) => {
    if (!myUid) return;
    try {
      await firestore()
        .collection('statuses')
        .doc(statusId)
        .update({
          seenBy: firestore.FieldValue.arrayUnion(myUid),
        });
    } catch (err) {
      console.log('[StatusTab] Mark status viewed error:', err);
    }
  };

  const renderStatusItem = ({item}: {item: any}) => (
    <TouchableOpacity
      style={styles.statusItem}
      activeOpacity={0.7}
      onPress={() => handleOpenStoryViewer(item.statuses)}>
      <Avatar
        uri={item.avatar}
        size="lg"
        ring
        ringUnseen={!item.isSeen}
        style={styles.avatar}
      />
      <View style={styles.statusInfo}>
        <Text style={[styles.statusName, {color: colors.textPrimary}]}>{item.name}</Text>
        <Text style={[styles.statusTime, {color: colors.textMuted}]}>{item.time}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.bgDark}]}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
            Loading status updates...
          </Text>
        </View>
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={() => (
            <>
              {/* My Status Card */}
              <TouchableOpacity
                style={[styles.myStatus, {borderBottomColor: colors.divider}]}
                activeOpacity={0.7}
                onPress={() => {
                  if (myActiveStatuses.length > 0) {
                    handleOpenStoryViewer(myActiveStatuses);
                  } else {
                    handlePickStatusImage();
                  }
                }}>
                <View style={styles.myAvatarContainer}>
                  {myProfile.avatar ? (
                    <Avatar
                      uri={myProfile.avatar}
                      size="lg"
                      ring={myActiveStatuses.length > 0}
                      ringUnseen={true}
                    />
                  ) : (
                    <View style={[styles.myAvatarPlaceholder, {backgroundColor: colors.bgCard}]}>
                      <Text style={styles.myAvatarEmoji}>😊</Text>
                    </View>
                  )}
                  {myActiveStatuses.length === 0 && (
                    <View style={[styles.addStatusBtn, {backgroundColor: colors.accent, borderColor: colors.bgDark}]}>
                      <Text style={[styles.addIcon, {color: colors.white}]}>+</Text>
                    </View>
                  )}
                </View>
                <View style={styles.statusInfo}>
                  <Text style={[styles.myStatusTitle, {color: colors.textPrimary}]}>My Status</Text>
                  <Text style={[styles.myStatusSubtitle, {color: colors.textMuted}]}>
                    {myActiveStatuses.length > 0
                      ? formatTimeAgo(myActiveStatuses[myActiveStatuses.length - 1].createdAt)
                      : 'Tap to add status update'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Recent Updates List */}
              {groupedStatuses.recent.length > 0 && (
                <>
                  <SectionHeader title="Recent Updates" />
                  {groupedStatuses.recent.map(item => (
                    <View key={item.id}>{renderStatusItem({item})}</View>
                  ))}
                </>
              )}

              {/* Viewed Updates List */}
              {groupedStatuses.viewed.length > 0 && (
                <>
                  <SectionHeader title="Viewed Updates" />
                  {groupedStatuses.viewed.map(item => (
                    <View key={item.id}>{renderStatusItem({item})}</View>
                  ))}
                </>
              )}
            </>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + verticalScale(100) }]}
        />
      )}

      {/* FAB Controls */}
      <View style={[styles.fabContainer, { bottom: insets.bottom + verticalScale(20) }]}>
        <FAB
          icon={<Ionicons name="pencil" size={moderateScale(18)} color={colors.textPrimary} />}
          size="sm"
          style={styles.fabSmall}
          onPress={() => setTextComposerVisible(true)}
        />
        <FAB
          icon={<Ionicons name="camera" size={moderateScale(24)} color={isDark ? colors.bgDark : colors.white} />}
          size="md"
          onPress={handleLaunchCamera}
        />
      </View>

      {/* Status Image Composer Modal */}
      {selectedImage && (
        <StatusComposerModal
          visible={composerVisible}
          imageUri={selectedImage}
          onClose={() => {
            setComposerVisible(false);
            setSelectedImage(null);
          }}
          onPublish={handlePublishStatus}
        />
      )}

      {/* Text Status Composer Modal */}
      <TextStatusComposerModal
        visible={textComposerVisible}
        onClose={() => setTextComposerVisible(false)}
        onPublish={handlePublishTextStatus}
      />

      {/* Story Viewer Modal */}
      {viewerVisible && (
        <StoryViewerModal
          visible={viewerVisible}
          statuses={viewerStatuses}
          onClose={() => {
            setViewerVisible(false);
            setViewerStatuses([]);
          }}
          onStatusViewed={handleStatusViewed}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  listContent: {paddingBottom: verticalScale(100), paddingTop: verticalScale(4)},
  myStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(14),
    marginHorizontal: scale(12),
    marginTop: verticalScale(8),
    borderRadius: moderateScale(16),
    borderBottomWidth: 0,
  },
  myAvatarContainer: {position: 'relative', marginRight: scale(14)},
  myAvatarPlaceholder: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
  },
  myAvatarEmoji: {fontSize: moderateScale(26)},
  addStatusBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: scale(22),
    height: scale(22),
    borderRadius: scale(8),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  addIcon: {fontSize: moderateScale(13), fontWeight: '700'},
  statusInfo: {flex: 1},
  myStatusTitle: {fontSize: moderateScale(15), fontWeight: '700'},
  myStatusSubtitle: {fontSize: moderateScale(13), marginTop: verticalScale(2)},
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(11),
    marginHorizontal: scale(12),
    marginTop: verticalScale(4),
    borderRadius: moderateScale(16),
  },
  avatar: {marginRight: scale(14)},
  statusName: {fontSize: moderateScale(15), fontWeight: '600'},
  statusTime: {fontSize: moderateScale(12), marginTop: verticalScale(2)},
  fabContainer: {
    position: 'absolute',
    bottom: verticalScale(20),
    right: scale(20),
    alignItems: 'center',
  },
  fabSmall: {marginBottom: verticalScale(12)},
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
});

export default StatusTab;
