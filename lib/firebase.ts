import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// The Firebase WEB config is a public client identifier (safe to ship). It must
// reach the browser bundle, which for Next.js means NEXT_PUBLIC_* vars present
// at BUILD time (locally: .env.local; App Hosting: apphosting.yaml env).
const firebaseConfig = {
  apiKey: "AIzaSyBIu1xsRAhp_znCp6NuyDh5HTLzb-A-cN8",
  authDomain: "aiexamroom.firebaseapp.com",
  projectId: "aiexamroom",
  storageBucket: "aiexamroom.firebasestorage.app",
  messagingSenderId: "165792063241",
  appId: "1:165792063241:web:92c370cfe87ce238ff7dd8",
  measurementId: "G-FPSKX7PTEC"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
