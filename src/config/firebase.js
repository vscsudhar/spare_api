import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';

let firebaseApp = null;
let isInitialized = false;

/**
 * Initialize Firebase Admin SDK cleanly and idempotently.
 * Supports service account JSON file, environment variables, or default application credentials.
 */
export const initFirebaseAdmin = () => {
  if (isInitialized && getApps().length > 0) {
    return getApps()[0];
  }

  try {
    if (getApps().length > 0) {
      firebaseApp = getApp();
      isInitialized = true;
      return firebaseApp;
    }

    // 1. Try JSON credentials file from path or default location
    const serviceAccountPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.resolve(process.cwd(), 'service-account.json');

        let resolvedPath = serviceAccountPath;
    if (!fs.existsSync(resolvedPath)) {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const fallbackPath = path.resolve(currentDir, '..', '..', 'service-account.json');
      if (fs.existsSync(fallbackPath)) {
        resolvedPath = fallbackPath;
      }
    }

    if (fs.existsSync(resolvedPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
      });
      isInitialized = true;
      console.log('✅ Firebase Admin SDK initialized from service account JSON file (' + serviceAccount.project_id + ').');
      return firebaseApp;
    }

    // 2. Try JSON credentials passed directly as string in environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        firebaseApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
        });
        isInitialized = true;
        console.log('✅ Firebase Admin SDK initialized from FIREBASE_SERVICE_ACCOUNT_KEY.');
        return firebaseApp;
      } catch (jsonErr) {
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY was provided but could not be parsed as JSON.');
      }
    }

    // 3. Try individual environment variables (Project ID, Client Email, Private Key)
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
      isInitialized = true;
      console.log('✅ Firebase Admin SDK initialized from environment credentials.');
      return firebaseApp;
    }

    console.warn('⚠️ Firebase Admin SDK: No credentials found. Push notifications will be logged without dispatch.');
    return null;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    return null;
  }
};

export const getFirebaseMessaging = () => {
  if (!isInitialized) {
    initFirebaseAdmin();
  }
  if (!isInitialized || getApps().length === 0) {
    return null;
  }
  try {
    return getMessaging(getApps()[0]);
  } catch (err) {
    console.error('Failed to get Firebase Messaging instance:', err.message);
    return null;
  }
};


let firebaseAuthInstance = null;
export const getFirebaseAuth = async () => {
  if (firebaseAuthInstance) return firebaseAuthInstance;
  if (!isInitialized) {
    initFirebaseAdmin();
  }
  if (!isInitialized || getApps().length === 0) {
    return null;
  }
  try {
    const { getAuth } = await import('firebase-admin/auth');
    firebaseAuthInstance = getAuth(getApps()[0]);
    return firebaseAuthInstance;
  } catch (err) {
    console.error('Failed to get Firebase Auth instance:', err.message);
    return null;
  }
};

export default {
  getFirebaseAuth,
  initFirebaseAdmin,
  getFirebaseMessaging,
};
