import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  Animated,
  DeviceEventEmitter,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useTheme} from '../context/ThemeContext';
import ChatsTab from './ChatsTab';
import StatusTab from './StatusTab';
import CallsTab from './CallsTab';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const TABS = ['Chats', 'Status', 'Calls'];

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({navigation}) => {
  const {colors, isDark} = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [chatCount, setChatCount] = useState(0);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const currentUid = auth().currentUser?.uid;
    if (!currentUid) return;

    const unsubscribe = firestore()
      .collection('users')
      .onSnapshot(
        snapshot => {
          let count = 0;
          snapshot.forEach(doc => {
            if (doc.id !== currentUid) {
              count++;
            }
          });
          setChatCount(count);
        },
        error => {
          console.error('[HomeScreen] Firestore user count listen error: ', error);
        }
      );

    return () => unsubscribe();
  }, []);

  const switchTab = (index: number) => {
    setActiveTab(index);
    Animated.spring(indicatorAnim, {
      toValue: index,
      friction: 8,
      tension: 80,
      useNativeDriver: false,
    }).start();
  };

  const renderTab = () => {
    switch (activeTab) {
      case 0: return <ChatsTab navigation={navigation} />;
      case 1: return <StatusTab />;
      case 2: return <CallsTab navigation={navigation} />;
      default: return <ChatsTab navigation={navigation} />;
    }
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.bgDark}]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.bgMedium, borderBottomColor: colors.divider}]}>
        {showSearch ? (
          <View style={styles.searchBar}>
            <TouchableOpacity
              onPress={() => { setShowSearch(false); setSearchText(''); }}>
              <Ionicons name="arrow-back" size={moderateScale(22)} color={colors.textPrimary} style={styles.searchBackArrow} />
            </TouchableOpacity>
            <TextInput
              style={[styles.searchInput, {color: colors.textPrimary, backgroundColor: colors.bgInput}]}
              placeholder="Search..."
              placeholderTextColor={colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
          </View>
        ) : (
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, {color: colors.accent}]}>ChatApp</Text>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.headerIcon} onPress={() => setShowSearch(true)}>
                <Ionicons name="search" size={moderateScale(20)} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() => {
                  if (activeTab === 1) {
                    DeviceEventEmitter.emit('LAUNCH_STATUS_CAMERA_DIRECT');
                  } else {
                    switchTab(1);
                    setTimeout(() => {
                      DeviceEventEmitter.emit('LAUNCH_STATUS_CAMERA_DIRECT');
                    }, 350);
                  }
                }}>
                <Ionicons name="camera-outline" size={moderateScale(21)} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() => navigation.navigate('Settings')}>
                <Ionicons name="ellipsis-vertical" size={moderateScale(20)} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tab Bar */}
        <View style={[styles.tabBar, {backgroundColor: colors.bgInput}]}>
          {TABS.map((tab, index) => (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              onPress={() => switchTab(index)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.tabText,
                  {color: activeTab === index ? (isDark ? colors.white : colors.primary) : colors.textSecondary},
                ]}>
                {tab}
              </Text>
              {tab === 'Chats' && chatCount > 0 && (
                <View style={[styles.tabBadge, {backgroundColor: colors.unreadBadge}]}>
                  <Text style={[styles.tabBadgeText, {color: colors.white}]}>{chatCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                backgroundColor: colors.bgCard,
                left: indicatorAnim.interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: ['1.2%', '34.7%', '68.2%'],
                }),
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.content}>{renderTab()}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    paddingTop:
      Platform.OS === 'ios'
        ? verticalScale(52)
        : (StatusBar.currentHeight ?? 24) + verticalScale(8),
    borderBottomWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(10),
  },
  headerTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerIcons: {flexDirection: 'row', alignItems: 'center', gap: scale(2)},
  headerIcon: {
    width: scale(38),
    height: scale(38),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {fontSize: moderateScale(20)},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(10),
  },
  searchBackArrow: {marginRight: scale(12)},
  searchInput: {
    flex: 1,
    fontSize: moderateScale(15),
    height: verticalScale(40),
    borderRadius: moderateScale(8),
    paddingHorizontal: scale(12),
  },
  tabBar: {
    flexDirection: 'row',
    position: 'relative',
    borderRadius: moderateScale(22),
    marginHorizontal: scale(16),
    marginBottom: verticalScale(12),
    padding: scale(4),
    height: verticalScale(44),
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    zIndex: 2,
    gap: scale(5),
  },
  tabText: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabBadge: {
    minWidth: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(4),
  },
  tabBadgeText: {fontSize: moderateScale(10), fontWeight: '700'},
  tabIndicator: {
    position: 'absolute',
    top: scale(4),
    bottom: scale(4),
    width: '30.6%',
    borderRadius: moderateScale(18),
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
    elevation: 2,
  },
  content: {flex: 1},
});

export default HomeScreen;
