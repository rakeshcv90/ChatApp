import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  Dimensions,
  StatusBar,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import Avatar from './Avatar';
import Ionicons from 'react-native-vector-icons/Ionicons';

const {width} = Dimensions.get('window');
const SLIDE_DURATION = 5000; // 5 seconds per status

interface StoryViewerModalProps {
  visible: boolean;
  statuses: any[];
  onClose: () => void;
  onStatusViewed?: (statusId: string) => void;
}

const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  visible,
  statuses,
  onClose,
  onStatusViewed,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const currentStatus = statuses[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  }, [currentIndex, statuses.length, onClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      // Restart current slide
      progressAnim.setValue(0);
      setCurrentIndex(0);
    }
  }, [currentIndex, progressAnim]);

  // Reset index when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      const firstStatus = statuses[0];
      if (firstStatus && !firstStatus.imageUrl) {
        setImageLoading(false);
      } else {
        setImageLoading(true);
      }
    }
  }, [visible, statuses]);

  // Reset loading state when index or currentStatus changes
  useEffect(() => {
    if (currentStatus && !currentStatus.imageUrl) {
      setImageLoading(false);
    } else {
      setImageLoading(true);
    }
  }, [currentIndex, currentStatus]);

  // Start progress animation for the active slide
  useEffect(() => {
    if (!visible || !statuses.length || currentIndex >= statuses.length) return;

    // Pause animation if the image is still loading
    if (imageLoading) {
      progressAnim.setValue(0);
      return;
    }

    // Trigger viewed callback for current status
    if (onStatusViewed && currentStatus) {
      onStatusViewed(currentStatus.id);
    }

    progressAnim.setValue(0);
    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: SLIDE_DURATION,
      useNativeDriver: false,
    });

    animation.start(({finished}) => {
      if (finished) {
        handleNext();
      }
    });

    return () => {
      animation.stop();
    };
  }, [visible, currentIndex, statuses, imageLoading, currentStatus, handleNext, onStatusViewed, progressAnim]);

  const handleTapScreen = (e: any) => {
    const x = e.nativeEvent.locationX;
    // If tap is in the left 30% of screen, go back
    if (x < width * 0.3) {
      handlePrev();
    } else {
      // Otherwise, skip forward
      handleNext();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  };

  if (!visible || !statuses.length || !currentStatus) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={currentStatus.imageUrl ? '#000' : (currentStatus.backgroundColor || '#075E54')}
        translucent
      />
      
      <TouchableWithoutFeedback onPress={handleTapScreen}>
        <View style={styles.container}>
          
          {/* Status Image or Text status background */}
          {currentStatus.imageUrl ? (
            <>
              <Image
                source={{uri: currentStatus.imageUrl}}
                style={styles.backgroundImage}
                resizeMode="contain"
                blurRadius={imageLoading ? 15 : 0}
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
              />
              {/* Centered Loading Spinner */}
              {imageLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FFF" />
                </View>
              )}
            </>
          ) : (
            <View style={[styles.textStatusContainer, {backgroundColor: currentStatus.backgroundColor || '#075E54'}]}>
              <Text style={styles.textStatusText}>{currentStatus.text}</Text>
            </View>
          )}

          {/* Progress Indicators Bar */}
          <SafeAreaView style={styles.overlayContainer}>
            <View style={styles.progressRow}>
              {statuses.map((status, index) => {
                let progressWidth: any = '0%';
                if (index < currentIndex) {
                  progressWidth = '100%';
                } else if (index === currentIndex) {
                  return (
                    <View key={status.id} style={styles.progressBarTrack}>
                      <Animated.View
                        style={[
                          styles.progressBarFill,
                          {
                            width: progressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                            }),
                          },
                        ]}
                      />
                    </View>
                  );
                }

                return (
                  <View key={status.id} style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, {width: progressWidth}]} />
                  </View>
                );
              })}
            </View>

            {/* Sender Profile Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Avatar uri={currentStatus.userAvatar} size="sm" style={styles.headerAvatar} />
                <View>
                  <Text style={styles.headerName}>{currentStatus.userName}</Text>
                  <Text style={styles.headerTime}>{formatTime(currentStatus.createdAt)}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={moderateScale(24)} color="#FFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Caption Overlay for Image statuses */}
          {currentStatus.imageUrl && currentStatus.text ? (
            <View style={styles.captionContainer}>
              <Text style={styles.captionText}>{currentStatus.text}</Text>
            </View>
          ) : null}

        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  overlayContainer: {
    paddingHorizontal: scale(10),
    paddingTop: Platform.OS === 'ios' ? verticalScale(6) : (StatusBar.currentHeight || 24) + verticalScale(8),
  },
  progressRow: {
    flexDirection: 'row',
    height: 3,
    paddingHorizontal: scale(6),
    marginTop: verticalScale(10),
    gap: scale(4),
  },
  progressBarTrack: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(8),
    marginTop: verticalScale(12),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    marginRight: scale(10),
  },
  headerName: {
    color: '#FFF',
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  headerTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: moderateScale(11),
    marginTop: 1,
  },
  closeBtn: {
    width: scale(38),
    height: scale(38),
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionContainer: {
    backgroundColor: 'rgba(24, 24, 27, 0.85)',
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(16),
    paddingBottom: Platform.OS === 'ios' ? verticalScale(34) : verticalScale(28),
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  captionText: {
    color: '#FFF',
    fontSize: moderateScale(15),
    textAlign: 'center',
    lineHeight: moderateScale(22),
  },
  textStatusContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(32),
  },
  textStatusText: {
    color: '#FFF',
    fontSize: moderateScale(28),
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: moderateScale(38),
  },
});

export default StoryViewerModal;
