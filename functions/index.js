const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Use explicit service account so createCustomToken() works without IAM signBlob permission.
// Falls back to default credentials during local CLI analysis when env vars aren't loaded yet.
admin.initializeApp(
  process.env.SA_BASE64
    ? {
        credential: admin.credential.cert(
          JSON.parse(Buffer.from(process.env.SA_BASE64, 'base64').toString('utf8')),
        ),
      }
    : {}
);

// ─── OTP: Send ────────────────────────────────────────────────────────────────
// Generates a 6-digit OTP, stores it hashed in Firestore, and sends it via SMS.
//
// SMS provider: 2factor.in
// Set the API key with:
//   firebase functions:config:set twofactor.api_key="YOUR_2FACTOR_API_KEY"
//
// During development (no API key set) the OTP is printed to Firebase console logs.
exports.sendOTP = functions.https.onCall(async data => {
  const {phoneNumber} = data;

  if (!phoneNumber || !/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'A valid E.164 phone number is required (e.g. +919876543210).',
    );
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = crypto.createHash('sha256').update(otp + salt).digest('hex');

  await admin
    .firestore()
    .collection('_otps')
    .doc(phoneNumber)
    .set({
      otpHash,
      salt,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // Always log for debugging
  console.log(`[OTP] ${phoneNumber} → ${otp}`);

  // Send real SMS via 2factor.in when API key is configured
  const apiKey = process.env.TWOFACTOR_API_KEY;
  if (apiKey) {
    // 2factor.in expects 10-digit number (strip +91 country code)
    const digits = phoneNumber.replace(/^\+91/, '');
    // API: GET /API/V1/{api_key}/SMS/{mobile}/{otp}
    const url = `https://2factor.in/API/V1/${apiKey}/SMS/${digits}/${otp}`;
    try {
      const res = await fetch(url);
      const body = await res.json();
      if (body.Status !== 'Success') {
        console.error('[OTP] 2factor.in error:', body.Details);
      } else {
        console.log('[OTP] SMS sent via 2factor.in. Session:', body.Details);
      }
    } catch (err) {
      console.error('[OTP] Failed to reach 2factor.in:', err.message);
    }
  } else {
    console.warn('[OTP] twofactor.api_key not configured — OTP only in logs above.');
  }

  return {success: true};
});

// ─── OTP: Verify ─────────────────────────────────────────────────────────────
// Verifies the OTP and returns a Firebase custom auth token.
// The app calls auth().signInWithCustomToken(token) after receiving it.
exports.verifyOTP = functions.https.onCall(async data => {
  const {phoneNumber, otp} = data;

  if (!phoneNumber || !otp) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'phoneNumber and otp are required.',
    );
  }

  const ref = admin.firestore().collection('_otps').doc(phoneNumber);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      'No OTP found for this number. Please request a new one.',
    );
  }

  const {otpHash, salt, expiresAt, attempts} = snap.data();

  if (Date.now() > expiresAt) {
    await ref.delete();
    throw new functions.https.HttpsError(
      'deadline-exceeded',
      'OTP has expired. Please request a new one.',
    );
  }

  if (attempts >= 3) {
    await ref.delete();
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Too many failed attempts. Please request a new OTP.',
    );
  }

  const inputHash = crypto.createHash('sha256').update(otp + salt).digest('hex');
  if (inputHash !== otpHash) {
    await ref.update({attempts: admin.firestore.FieldValue.increment(1)});
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Incorrect OTP. Please try again.',
    );
  }

  // OTP correct — clean up and issue a custom token
  await ref.delete();

  let uid;
  try {
    const existing = await admin.auth().getUserByPhoneNumber(phoneNumber);
    uid = existing.uid;
  } catch {
    const created = await admin.auth().createUser({phoneNumber});
    uid = created.uid;
  }

  const customToken = await admin.auth().createCustomToken(uid);
  return {customToken};
});

/**
 * Triggers when a new message is added to any chat room.
 * Sends a DATA-ONLY push notification to the receiver.
 *
 * ✅ FIX: Using admin.messaging().send() — sendToDevice() was removed in Admin SDK v12+.
 * ✅ FIX: Data-only payload so setBackgroundMessageHandler fires even when app is killed.
 */
exports.onMessageCreate = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();

    const senderId = message.senderId;
    const receiverId = message.receiverId;

    if (!receiverId) {
      console.log('No receiverId on message, skipping notification');
      return null;
    }

    // Fetch receiver's FCM token
    const userDoc = await admin.firestore().collection('users').doc(receiverId).get();
    if (!userDoc.exists) {
      console.log('Receiver user doc not found:', receiverId);
      return null;
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log('No FCM token for user:', receiverId);
      return null;
    }

    // Fetch sender name for the notification title
    let senderName = 'New Message';
    try {
      const senderDoc = await admin.firestore().collection('users').doc(senderId).get();
      if (senderDoc.exists) {
        const sd = senderDoc.data();
        senderName = sd.displayName || sd.name || 'New Message';
      }
    } catch (e) {
      console.log('Could not fetch sender name:', e);
    }

    // ✅ Use admin.messaging().send() — the modern API (Admin SDK v12+)
    const messagePayload = {
      token: fcmToken,
      data: {
        type: 'message',
        chatId: context.params.chatId,
        senderId: senderId,
        senderName: senderName,
        messageText: message.text || (message.mediaUrl ? '📷 Image' : ''),
      },
      android: {
        priority: 'high',      // Wakes device even in Doze mode
        ttl: 86400000,         // 24 hours in ms
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'background',
        },
        payload: {
          aps: {
            contentAvailable: true,  // iOS: wake app in background
          },
        },
      },
    };

    try {
      const response = await admin.messaging().send(messagePayload);
      console.log('Message notification sent successfully. MessageId:', response);
    } catch (error) {
      console.error('Error sending message notification:', error);
    }
    return null;
  });

/**
 * Triggers when a new call is created.
 * Sends a high-priority DATA-ONLY push notification to the callee.
 *
 * ✅ FIX: Using admin.messaging().send() — sendToDevice() was removed in Admin SDK v12+.
 */
exports.onCallCreate = functions.firestore
  .document('calls/{callId}')
  .onCreate(async (snap, context) => {
    const call = snap.data();
    const calleeId = call.calleeId;
    const callerName = call.callerName || 'Someone';

    const userDoc = await admin.firestore().collection('users').doc(calleeId).get();
    if (!userDoc.exists) return null;

    const fcmToken = userDoc.data().fcmToken;
    if (!fcmToken) {
      console.log('No FCM token for callee:', calleeId);
      return null;
    }

    // ✅ Use admin.messaging().send() — the modern API (Admin SDK v12+)
    const messagePayload = {
      token: fcmToken,
      data: {
        type: 'call',
        callId: context.params.callId,
        callerName: callerName,
        callType: call.callType || 'audio',
      },
      android: {
        priority: 'high',   // Critical: wakes device from Doze
        ttl: 30000,         // 30 seconds — calls expire quickly
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'background',
        },
        payload: {
          aps: {
            contentAvailable: true,
          },
        },
      },
    };

    try {
      const response = await admin.messaging().send(messagePayload);
      console.log('Call notification sent successfully. MessageId:', response);
    } catch (error) {
      console.error('Error sending call notification:', error);
    }
    return null;
  });
