import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useTheme} from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface UserProfile {
  uid: string;
  displayName: string;
  phoneNumber: string;
  photoURL: string;
  about?: string;
  createdAt?: any;
}

interface SelectContactScreenProps {
  navigation: any;
}

const SelectContactScreen: React.FC<SelectContactScreenProps> = ({navigation}) => {
  const {colors, isDark} = useTheme();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const currentUid = auth().currentUser?.uid;

    const unsubscribe = firestore()
      .collection('users')
      .orderBy('displayName', 'asc')
      .onSnapshot(
        snapshot => {
          const fetchedUsers: UserProfile[] = [];
          snapshot.forEach(doc => {
            const data = doc.data() as UserProfile;
            // Exclude current logged in user
            if (data.uid !== currentUid) {
              fetchedUsers.push(data);
            }
          });
          setUsers(fetchedUsers);
          setLoading(false);
        },
        error => {
          console.error('[SelectContact] Firestore fetch error: ', error);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchText.trim()) return users;
    const query = searchText.toLowerCase().trim();
    return users.filter(
      u =>
        u.displayName.toLowerCase().includes(query) ||
        u.phoneNumber.toLowerCase().includes(query)
    );
  }, [users, searchText]);

  const handleSelectUser = (selectedUser: UserProfile) => {
    navigation.navigate('ChatDetail', {
      name: selectedUser.displayName,
      avatar: selectedUser.photoURL || 'https://i.pravatar.cc/150?img=33',
      phoneNumber: selectedUser.phoneNumber,
      uid: selectedUser.uid,
      isOnline: false, // Default or can be dynamic if we track presence
    });
  };

  const renderUserItem = ({item}: {item: UserProfile}) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleSelectUser(item)}
      activeOpacity={0.75}>
      <Avatar
        uri={item.photoURL || 'https://i.pravatar.cc/150?img=33'}
        size="md"
        style={styles.avatar}
      />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, {color: colors.textPrimary}]}>
          {item.displayName}
        </Text>
        <Text style={[styles.userPhone, {color: colors.textSecondary}]} numberOfLines={1}>
          {item.about || 'Hey there! I am using ChatApp.'}
        </Text>
      </View>
    </TouchableOpacity>
  );

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
              onPress={() => {
                setShowSearch(false);
                setSearchText('');
              }}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Ionicons
                name="arrow-back"
                size={moderateScale(22)}
                color={colors.textPrimary}
                style={styles.searchBackArrow}
              />
            </TouchableOpacity>
            <TextInput
              style={[
                styles.searchInput,
                {color: colors.textPrimary, backgroundColor: colors.bgInput},
              ]}
              placeholder="Search by name or number..."
              placeholderTextColor={colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
          </View>
        ) : (
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={[
                  styles.backBtn,
                  {backgroundColor: colors.bgCard, borderColor: colors.divider},
                ]}
                onPress={() => navigation.goBack()}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="arrow-back" size={moderateScale(20)} color={colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.titleContainer}>
                <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
                  Select Contact
                </Text>
                <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
                  {users.length} {users.length === 1 ? 'contact' : 'contacts'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.searchIconBtn}
              onPress={() => setShowSearch(true)}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Ionicons name="search" size={moderateScale(20)} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
            Loading directory...
          </Text>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons
            name="people-outline"
            size={moderateScale(60)}
            color={colors.textMuted}
          />
          <Text style={[styles.emptyText, {color: colors.textPrimary}]}>
            {searchText ? 'No contacts match search' : 'No registered users yet'}
          </Text>
          <Text style={[styles.emptySubText, {color: colors.textSecondary}]}>
            {searchText ? 'Try another search query' : 'Share the app to add friends!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUserItem}
          keyExtractor={item => item.uid}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, {backgroundColor: colors.divider}]} />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop:
      Platform.OS === 'ios'
        ? verticalScale(52)
        : (StatusBar.currentHeight ?? 24) + verticalScale(8),
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(10),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  backBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: moderateScale(12),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  titleContainer: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: moderateScale(11),
    marginTop: verticalScale(2),
  },
  searchIconBtn: {
    width: scale(38),
    height: scale(38),
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(10),
  },
  searchBackArrow: {
    marginRight: scale(12),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(14),
    height: verticalScale(38),
    borderRadius: moderateScale(8),
    paddingHorizontal: scale(12),
  },
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
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginTop: verticalScale(16),
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: moderateScale(13),
    marginTop: verticalScale(6),
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: verticalScale(8),
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
  },
  avatar: {
    marginRight: scale(16),
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  userPhone: {
    fontSize: moderateScale(12),
    marginTop: verticalScale(3),
  },
  separator: {
    height: 1,
    marginLeft: scale(16) + scale(48) + scale(16),
  },
});

export default SelectContactScreen;
