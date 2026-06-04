'use client';

import type { ReactNode } from 'react';
import { configureLms, LmsProvider } from '@edai/lms';
import { db, storage, functions } from '@/lib/firebase';
import { AuthProvider, useAuth } from '@/lib/auth';

// Wire the LMS to our Firebase instances once, at module load.
configureLms({ db, storage, functions, routeBase: '/learn' });

export function Providers({ children }: { children: ReactNode }) {
  // LmsProvider must sit INSIDE AuthProvider so its useAuth resolves our context.
  return (
    <AuthProvider>
      <LmsProvider runtime={{ useAuth }}>{children}</LmsProvider>
    </AuthProvider>
  );
}
