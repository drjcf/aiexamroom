// @edai/lms — standalone LMS module extracted from EdAI Suite v3.
//
// Wiring (host app, once at startup):
//   import { configureLms, LmsProvider } from '@edai/lms';
//   configureLms({ db, storage, functions });           // Firebase instances
//   <LmsProvider runtime={{ useAuth, useSessionTracker }}>...</LmsProvider>
//
// Then mount the pages under the route base documented in the README
// (default `/hub/modules/lms`).

// ── Configuration ──────────────────────────────────────────────
export { configureLms } from './config';
export type { LmsFirebaseConfig } from './config';

// Build a path under the configured route base (for host-side links in).
export { lmsRoute } from './routes';

// ── Runtime context ────────────────────────────────────────────
export { LmsProvider, useAuth, useSessionTracker, ModuleNav } from './context';
export type {
  LmsRuntime,
  LmsAuth,
  LmsUser,
  LmsProfile,
  LmsRole,
  LmsSessionTracker,
  ModuleNavTab,
} from './context';

// ── Module manifest (host registers this with its own registry) ─
export { default as manifest } from './manifest.json';

// ── Pages (mount these at routes) ──────────────────────────────
export { default as LMSDashboard } from './pages/LMSDashboard';
export { default as CourseList } from './pages/CourseList';
export { default as CourseDetail } from './pages/CourseDetail';
export { default as CourseEditor } from './pages/CourseEditor';
export { default as CoursePlayer } from './pages/CoursePlayer';
export { default as CurriculaList } from './pages/CurriculaList';
export { default as CurriculumDetail } from './pages/CurriculumDetail';
export { default as CurriculumEditor } from './pages/CurriculumEditor';
export { default as MyLearning } from './pages/MyLearning';
export { default as GradingPage } from './pages/GradingPage';
export { default as CertificatesPage } from './pages/CertificatesPage';
export { default as ReportsPage } from './pages/ReportsPage';

// ── Services (call directly for custom flows) ──────────────────
export * as announcementService from './services/announcement.service';
export * as assignmentService from './services/assignment.service';
export * as certificateService from './services/certificate.service';
export * as courseService from './services/course.service';
export * as curriculumService from './services/curriculum.service';
export * as enrollmentService from './services/enrollment.service';
export * as lessonService from './services/lesson.service';

// ── Domain types ───────────────────────────────────────────────
export * from './types';
