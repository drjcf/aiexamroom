'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Runtime contract the host application must satisfy.
 *
 * The LMS pages were extracted from a host that provided auth + analytics via
 * its own `@components`/`@core` modules. Instead of importing those, the pages
 * now read this runtime from React context, which the host populates once via
 * `<LmsProvider runtime={...}>`.
 */

/** Roles the LMS pages branch on (gating curator/admin actions). */
export type LmsRole =
  | 'superadmin'
  | 'admin'
  | 'content_curator'
  | 'diplomate'
  | 'fellow'
  | 'researcher';

/** Minimal authenticated-user shape the LMS reads (a Firebase `User` satisfies it). */
export interface LmsUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

/** Minimal user-profile shape the LMS reads. */
export interface LmsProfile {
  email: string;
  displayName: string;
  [key: string]: unknown;
}

/** Return shape of the host's `useAuth` hook, as consumed by the LMS. */
export interface LmsAuth {
  user: LmsUser | null;
  role: LmsRole | null;
  profile: LmsProfile | null;
  loading?: boolean;
}

/** Optional session/interaction tracker, mirroring the host analytics hook. */
export interface LmsSessionTracker {
  sessionId: string | null;
  trackInteraction: (type: string, data?: Record<string, unknown>) => void;
}

export interface LmsRuntime {
  /** Hook returning the current auth state. Required. */
  useAuth: () => LmsAuth;
  /** Optional analytics hook. Defaults to a no-op tracker when omitted. */
  useSessionTracker?: (moduleId: string) => LmsSessionTracker;
}

const RuntimeContext = createContext<LmsRuntime | null>(null);

export function LmsProvider({
  runtime,
  children,
}: {
  runtime: LmsRuntime;
  children: ReactNode;
}) {
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

function useRuntime(): LmsRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error('[@edai/lms] Missing <LmsProvider runtime={...}> ancestor.');
  }
  return runtime;
}

/** Auth hook used throughout the LMS pages. Backed by the host's `useAuth`. */
export function useAuth(): LmsAuth {
  return useRuntime().useAuth();
}

const NOOP_TRACKER: LmsSessionTracker = {
  sessionId: null,
  trackInteraction: () => {},
};

/**
 * Session tracker used by LMS pages. Falls back to a no-op when the host does
 * not supply analytics, so analytics is opt-in rather than required.
 */
export function useSessionTracker(moduleId: string): LmsSessionTracker {
  const runtime = useRuntime();
  // Hooks must be called unconditionally; when the host omits the tracker we
  // still need a stable call, so branch on the function reference, not state.
  return runtime.useSessionTracker
    ? runtime.useSessionTracker(moduleId)
    : NOOP_TRACKER;
}

/** Re-exported so pages can keep `import { ModuleNav } from '...'`. */
export type { ModuleNavTab } from './ui/ModuleNav';
export { ModuleNav } from './ui/ModuleNav';
