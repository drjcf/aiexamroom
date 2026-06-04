'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle, useAuth } from '@/lib/auth';

export default function SignIn() {
  const router = useRouter();
  const { user, role } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true); setErr(null);
    try { await signInWithGoogle(); router.push('/learn'); }
    catch (e: any) { setErr(e?.message ?? 'Sign-in failed'); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-2xl font-bold mb-2">Sign in</h1>
      <p className="text-slate-400 text-sm mb-8">
        Reading is open to everyone. Sign in only to author content or to save your progress.
      </p>
      <button onClick={go} disabled={busy}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium hover:bg-emerald-500 disabled:opacity-50">
        {busy ? 'Signing in…' : 'Continue with Google'}
      </button>
      {err && <p className="mt-4 text-sm text-red-400">{err}</p>}
      {user && !user.email && (
        <p className="mt-6 text-xs text-slate-500">Currently a guest session ({user.uid.slice(0, 8)}…).</p>
      )}
      {user?.email && (
        <p className="mt-6 text-xs text-slate-500">Signed in as {user.email}{role ? ` · ${role}` : ''}.</p>
      )}
    </main>
  );
}
