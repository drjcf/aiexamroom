import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// The Firebase WEB config is a public client identifier (safe to ship). It must
// reach the browser bundle, which for Next.js means NEXT_PUBLIC_* vars present
// at BUILD time (locally: .env.local; App Hosting: apphosting.yaml env).
function resolveConfig(): FirebaseOptions {
  if (process.env.NEXT_PUBLIC_FIREBASE_CONFIG) {
    return JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG) as FirebaseOptions;
  }
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  };
}

const config = resolveConfig();
if (!config.apiKey && typeof window !== 'undefined') {
  // Fail visibly instead of a cryptic auth/api-key-not-valid at first auth call.
  console.error(
    '[firebase] Missing NEXT_PUBLIC_FIREBASE_API_KEY. Fill .env.local (local) or ' +
    'apphosting.yaml env (App Hosting) from your Firebase web app config, then rebuild.',
  );
}

export const app = getApps().length ? getApp() : initializeApp(config);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
