'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged, signInAnonymously, getIdTokenResult, signOut,
  EmailAuthProvider, linkWithCredential, GoogleAuthProvider,
  linkWithPopup, signInWithPopup, signInWithCredential,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { LmsAuth, LmsRole, LmsProfile } from '@edai/lms';

const AuthContext = createContext<LmsAuth>({ user: null, role: null, profile: null, loading: true });

// Open reading: every visitor gets a silent anonymous session so the LMS pages
// (which assume a signed-in user) work without a signup wall. Progress and
// certificates attach to this uid and survive an upgrade to a real account.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LmsAuth>({ user: null, role: null, profile: null, loading: true });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try { await signInAnonymously(auth); } catch (e) { console.error('[auth] anon sign-in failed', e); }
        return; // fires again with the new user
      }
      const token = await getIdTokenResult(u);
      const role = ((token.claims.role as string) || null) as LmsRole | null; // learners: null; author: content_curator
      let profile: LmsProfile | null = null;
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) profile = snap.data() as LmsProfile;
      } catch { /* anonymous users may have no profile doc */ }
      setState({
        user: { uid: u.uid, email: u.email, displayName: u.displayName },
        role, profile, loading: false,
      });
    });
    return () => unsub();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): LmsAuth {
  return useContext(AuthContext);
}

// Author / durable sign-in. If the current session is anonymous we LINK it to
// Google (preserving the uid + any progress); if that Google account already
// exists we just sign into it. This is how you (the author) get a real identity
// with an email that set-author-claim.mjs can target.
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cur = auth.currentUser;
  if (cur && cur.isAnonymous) {
    try {
      return await linkWithPopup(cur, provider);
    } catch (e: any) {
      if (e?.code === 'auth/credential-already-in-use') {
        const cred = GoogleAuthProvider.credentialFromError(e);
        if (cred) return await signInWithCredential(auth, cred);
      }
      throw e;
    }
  }
  return await signInWithPopup(auth, provider);
}

// Sign back out to an anonymous guest session (the listener re-anons immediately).
export async function signOutToGuest() { await signOut(auth); }

// Email/password upgrade helpers (optional, for a learner "save my progress" CTA).
export async function upgradeWithEmail(email: string, password: string) {
  if (!auth.currentUser) throw new Error('No active session');
  return linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email, password));
}
