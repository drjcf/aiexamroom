import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { Functions } from 'firebase/functions';

/**
 * Firestore / Storage instances used by the LMS services.
 *
 * These are ESM live bindings: the services `import { db } from '../config'`
 * and read it at call time, so reassigning here propagates to every consumer.
 * The host MUST call `configureLms(...)` once, before invoking any service.
 */
export let db: Firestore = undefined as unknown as Firestore;
export let storage: FirebaseStorage = undefined as unknown as FirebaseStorage;
export let functions: Functions = undefined as unknown as Functions;

/**
 * Base path the LMS pages are mounted at. All internal links are built from
 * this (read at render time, so a `configureLms` call updates them). Override
 * to mount the module somewhere other than the default.
 */
export let routeBase = '/hub/modules/lms';

let configured = false;

export interface LmsFirebaseConfig {
  /** A Firestore instance (e.g. `getFirestore(app, DATABASE_ID)`). Required. */
  db: Firestore;
  /** A Firebase Storage instance. Required only for course cover-image uploads. */
  storage?: FirebaseStorage;
  /**
   * A Firebase Functions instance. Required only for AI-assisted grading,
   * which calls the `gradeAssignmentWithAI` callable on the host's backend.
   */
  functions?: Functions;
  /**
   * Base path the pages are mounted at. Defaults to `/hub/modules/lms`.
   * No trailing slash (one is stripped if provided).
   */
  routeBase?: string;
}

/**
 * Wire the LMS package to the host's Firebase instances.
 * Call once at app startup, before any LMS service or page runs.
 */
export function configureLms(cfg: LmsFirebaseConfig): void {
  db = cfg.db;
  if (cfg.storage) storage = cfg.storage;
  if (cfg.functions) functions = cfg.functions;
  if (cfg.routeBase) routeBase = cfg.routeBase.replace(/\/$/, '');
  configured = true;
}

/** Throws if a service runs before `configureLms` was called. */
export function assertConfigured(): void {
  if (!configured) {
    throw new Error(
      '[@edai/lms] Firebase not configured. Call configureLms({ db, storage }) at app startup.',
    );
  }
}
