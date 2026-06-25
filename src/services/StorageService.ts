import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';

/**
 * Uploads a local profile picture URI to Firebase Storage.
 * If the URI is already a web URL, it returns it directly.
 */
export const uploadProfileImage = async (localUri: string): Promise<string> => {
  const user = auth().currentUser;
  if (!user) throw new Error('User not authenticated');

  // If already a web url, no upload needed
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    return localUri;
  }

  try {
    const filename = `profile_${Date.now()}.jpg`;
    const reference = storage().ref(`users/${user.uid}/${filename}`);

    console.log('[StorageService] Starting putFile for:', localUri, 'to path:', reference.fullPath);
    // Perform upload
    try {
      await reference.putFile(localUri);
      console.log('[StorageService] putFile completed successfully.');
    } catch (putErr: any) {
      console.error('[StorageService] putFile step failed:', putErr.code, putErr.message);
      throw putErr;
    }

    // Get and return the public web download URL
    console.log('[StorageService] Requesting download URL...');
    try {
      const downloadUrl = await reference.getDownloadURL();
      console.log('[StorageService] getDownloadURL completed. URL:', downloadUrl);
      return downloadUrl;
    } catch (getErr: any) {
      console.error('[StorageService] getDownloadURL step failed:', getErr.code, getErr.message);
      throw getErr;
    }
  } catch (error: any) {
    console.error('[StorageService] Profile image upload helper failed:', error);
    throw error;
  }
};

/**
 * Uploads local chat media (image/video) to Firebase Storage under chat reference.
 */
export const uploadChatMedia = async (
  localUri: string,
  type: 'image' | 'video',
  chatId: string,
  onProgress?: (progress: number) => void,
): Promise<string> => {
  const filename = `${type}_${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`;
  const reference = storage().ref(`chats/${chatId}/${filename}`);
  const task = reference.putFile(localUri);

  if (onProgress) {
    task.on('state_changed', snapshot => {
      if (snapshot.totalBytes > 0) {
        onProgress(snapshot.bytesTransferred / snapshot.totalBytes);
      }
    });
  }

  try {
    await task;
  } catch (putErr: any) {
    console.error('[StorageService] Chat media putFile failed:', putErr.message);
    throw putErr;
  }

  try {
    return await reference.getDownloadURL();
  } catch (getErr: any) {
    console.error('[StorageService] getDownloadURL failed:', getErr.message);
    throw getErr;
  }
};

/**
 * Uploads local status image to Firebase Storage under status references.
 */
export const uploadStatusImage = async (localUri: string, userId: string): Promise<string> => {
  try {
    const filename = `status_${Date.now()}.jpg`;
    const reference = storage().ref(`statuses/${userId}/${filename}`);

    console.log('[StorageService] Starting status image putFile for:', localUri, 'to path:', reference.fullPath);
    // Perform upload
    try {
      await reference.putFile(localUri);
      console.log('[StorageService] Status image putFile completed successfully.');
    } catch (putErr: any) {
      console.error('[StorageService] Status image putFile step failed:', putErr.code, putErr.message);
      throw putErr;
    }

    // Get and return the public web download URL
    console.log('[StorageService] Requesting status image download URL...');
    try {
      const downloadUrl = await reference.getDownloadURL();
      console.log('[StorageService] Status image getDownloadURL completed. URL:', downloadUrl);
      return downloadUrl;
    } catch (getErr: any) {
      console.error('[StorageService] Status image getDownloadURL step failed:', getErr.code, getErr.message);
      throw getErr;
    }
  } catch (error: any) {
    console.error('[StorageService] Status image upload helper failed:', error);
    throw error;
  }
};
