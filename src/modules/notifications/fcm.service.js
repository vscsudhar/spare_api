import { getFirebaseMessaging } from '../../config/firebase.js';
import DeviceToken from './deviceToken.model.js';
import Users from '../users/users.model.js';

export const fcmService = {
  /**
   * Register or update a device token
   */
  registerToken: async (userId, tokenData) => {
    const { token, role = 'customer', app = 'customer', platform = 'android', deviceModel = '' } = tokenData;

    const existing = await DeviceToken.findOneAndUpdate(
      { token },
      {
        user: userId,
        role,
        app,
        platform,
        deviceModel,
        isActive: true,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return existing;
  },

  /**
   * Deactivate a specific device token (e.g., on logout)
   */
  deactivateToken: async (userId, token) => {
    return DeviceToken.findOneAndUpdate(
      { user: userId, token },
      { isActive: false, lastUsedAt: new Date() },
      { new: true }
    );
  },

  /**
   * Deactivate all tokens for a user (e.g. account suspension or full logout)
   */
  deactivateAllUserTokens: async (userId, app = null) => {
    const query = { user: userId };
    if (app) query.app = app;
    return DeviceToken.updateMany(query, { isActive: false, lastUsedAt: new Date() });
  },

  /**
   * Remove invalid or expired tokens caught during send
   */
  cleanInvalidTokens: async (tokens) => {
    if (!tokens || tokens.length === 0) return;
    try {
      await DeviceToken.deleteMany({ token: { $in: tokens } });
      console.log(`🧹 Cleaned up ${tokens.length} invalid/unregistered FCM token(s).`);
    } catch (err) {
      console.error('Failed to clean invalid tokens:', err);
    }
  },

  /**
   * Send push notification to a specific user across all active devices
   */
  sendToUser: async (userId, { title, body, image = null, data = {} }) => {
    if (!userId) return { success: false, reason: 'No userId provided' };

    const messaging = getFirebaseMessaging();
    if (!messaging) {
      console.log(`[FCM SKIP] Firebase messaging not configured. Notification to user ${userId} logged: "${title}" - "${body}"`);
      return { success: false, reason: 'Firebase not configured' };
    }

    const tokensDocs = await DeviceToken.find({ user: userId, isActive: true }).select('token platform');
    if (!tokensDocs || tokensDocs.length === 0) {
      return { success: true, delivered: 0, reason: 'No active device tokens found for user' };
    }

    const tokens = tokensDocs
      .map((t) => t.token)
      .filter((t) => typeof t === 'string' && t.trim().length > 0);
    if (tokens.length === 0) {
      return { success: true, delivered: 0, reason: 'No active device tokens found for user' };
    }

    // FCM payload data fields must all be strings
    const sanitizedData = {};
    for (const [k, v] of Object.entries(data)) {
      sanitizedData[k] = v !== null && v !== undefined ? String(v) : '';
    }
    if (image) {
      sanitizedData.image = String(image);
    }

    const notificationPayload = {
      title: String(title),
      body: String(body),
      ...(image ? { imageUrl: String(image) } : {}),
    };

    const message = {
      tokens,
      notification: notificationPayload,
      data: sanitizedData,
      android: {
        priority: 'high',
        notification: {
          channelId: 'voltspare_notifications',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          ...(image ? { imageUrl: String(image) } : {}),
        },
      },
      apns: {
        payload: {
          aps: {
            alert: { title: String(title), body: String(body) },
            sound: 'default',
            badge: 1,
            'mutable-content': 1,
          },
        },
        fcmOptions: image ? { image: String(image) } : undefined,
      },
      webpush: {
        notification: {
          title: String(title),
          body: String(body),
          icon: '/favicon.png',
          ...(image ? { image: String(image) } : {}),
        },
      },
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      console.log(`📲 FCM multicast to user ${userId}: ${response.successCount} succeeded, ${response.failureCount} failed.`);

      // Identify invalid/expired tokens for cleanup
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-argument'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await fcmService.cleanInvalidTokens(invalidTokens);
      }

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (err) {
      console.error('FCM Multicast error:', err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Send push notification to all users of a particular role (e.g. 'admin', 'delivery_staff')
   */
  sendToRole: async (roles, { title, body, image = null, data = {}, excludeUserId = null }) => {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      console.log(`[FCM SKIP] Role notification logged for ${roles}: "${title}" - "${body}"`);
      return { success: false, reason: 'Firebase not configured' };
    }

    const roleList = Array.isArray(roles) ? roles : [roles];
    const query = { role: { $in: roleList }, isActive: true };
    if (excludeUserId) {
      query.user = { $ne: excludeUserId };
    }

    const tokensDocs = await DeviceToken.find(query).select('token');
    if (!tokensDocs || tokensDocs.length === 0) {
      return { success: true, delivered: 0, reason: 'No active device tokens found for role' };
    }

    const tokens = tokensDocs
      .map((t) => t.token)
      .filter((t) => typeof t === 'string' && t.trim().length > 0);
    if (tokens.length === 0) {
      return { success: true, delivered: 0, reason: 'No active device tokens found for role' };
    }

    const sanitizedData = {};
    for (const [k, v] of Object.entries(data)) {
      sanitizedData[k] = v !== null && v !== undefined ? String(v) : '';
    }
    if (image) sanitizedData.image = String(image);

    const message = {
      tokens,
      notification: {
        title: String(title),
        body: String(body),
        ...(image ? { imageUrl: String(image) } : {}),
      },
      data: sanitizedData,
      android: {
        priority: 'high',
        notification: {
          channelId: 'voltspare_notifications',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          ...(image ? { imageUrl: String(image) } : {}),
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'mutable-content': 1,
          },
        },
        fcmOptions: image ? { image: String(image) } : undefined,
      },
      webpush: {
        notification: {
          title: String(title),
          body: String(body),
          icon: '/favicon.png',
          ...(image ? { image: String(image) } : {}),
        },
      },
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      console.log(`📲 FCM multicast to roles [${roleList.join(', ')}]: ${response.successCount} succeeded, ${response.failureCount} failed.`);

      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-argument'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await fcmService.cleanInvalidTokens(invalidTokens);
      }

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (err) {
      console.error('FCM sendToRole error:', err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Broadcast push notification to all customer devices in batches
   */
  sendToAllCustomers: async ({ title, body, image = null, data = {} }) => {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      console.log(`[FCM SKIP] Broadcast to customers logged: "${title}" - "${body}"`);
      return { success: false, reason: 'Firebase not configured' };
    }

    const tokensDocs = await DeviceToken.find({
      $or: [{ role: 'customer' }, { app: 'customer' }],
      isActive: true,
    }).select('token');
    if (!tokensDocs || tokensDocs.length === 0) {
      return { success: true, delivered: 0, reason: 'No active customer device tokens found' };
    }

    const allTokens = [
      ...new Set(
        tokensDocs
          .map((t) => t.token)
          .filter((t) => typeof t === 'string' && t.trim().length > 0)
      ),
    ];
    if (allTokens.length === 0) {
      return { success: true, delivered: 0, reason: 'No active customer device tokens found' };
    }
    const sanitizedData = {};
    for (const [k, v] of Object.entries(data)) {
      sanitizedData[k] = v !== null && v !== undefined ? String(v) : '';
    }
    if (image) sanitizedData.image = String(image);

    const notificationPayload = {
      title: String(title),
      body: String(body),
      ...(image ? { imageUrl: String(image) } : {}),
    };

    let totalSuccess = 0;
    let totalFailure = 0;
    const invalidTokens = [];

    // Multicast in chunks of 500 (Firebase Admin maximum limit per multicast call)
    const chunkSize = 500;
    for (let i = 0; i < allTokens.length; i += chunkSize) {
      const chunk = allTokens.slice(i, i + chunkSize);
      const message = {
        tokens: chunk,
        notification: notificationPayload,
        data: sanitizedData,
        android: {
          priority: 'high',
          notification: {
            channelId: 'voltspare_notifications',
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            ...(image ? { imageUrl: String(image) } : {}),
          },
        },
        apns: {
          payload: {
            aps: {
              alert: { title: String(title), body: String(body) },
              sound: 'default',
              badge: 1,
              'mutable-content': 1,
            },
          },
          fcmOptions: image ? { image: String(image) } : undefined,
        },
        webpush: {
          notification: {
            title: String(title),
            body: String(body),
            icon: '/favicon.png',
            ...(image ? { image: String(image) } : {}),
          },
        },
      };

      try {
        const response = await messaging.sendEachForMulticast(message);
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;

        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const code = resp.error.code;
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-argument'
            ) {
              invalidTokens.push(chunk[idx]);
            }
          }
        });
      } catch (err) {
        console.error('FCM broadcast chunk error:', err.message);
      }
    }

    if (invalidTokens.length > 0) {
      await fcmService.cleanInvalidTokens(invalidTokens);
    }

    return {
      success: true,
      totalTokens: allTokens.length,
      successCount: totalSuccess,
      failureCount: totalFailure,
    };
  },
};

export default fcmService;
