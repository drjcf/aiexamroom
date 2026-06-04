# @edai/lms

Standalone **Learning Management** module extracted from EdAI Suite v3 — courses,
curricula, enrollments, lesson progress, assignments, AI-assisted grading, and
certificate generation.

It ships as **TypeScript source** consumed by a **Next.js (App Router) host**.
It is *not* a runnable app: you bring your own Firebase project and auth, wire
them in once, and mount the pages at your own routes.

---

## What's inside

```
src/
  index.ts                 Public API (config, provider, pages, services, types)
  config.ts                configureLms({ db, storage, functions }) — Firebase wiring
  context.tsx              <LmsProvider runtime={{ useAuth, useSessionTracker }}>
  manifest.json            Module manifest (register with your own registry)
  types.ts                 Domain types (Course, Lesson, Enrollment, …)
  services/                Firestore data access (7 services)
  pages/                   12 page components (mount at routes)
  components/              LMS-internal UI (CourseCard, LessonRenderer, …)
  ui/ModuleNav.tsx         Vendored tab-nav (generic, no app coupling)
  vendor/research-notebook/  Vendored leaf deps: RN types + 8 content viewers
firestore.rules            LMS security rules to merge into your host
firestore.indexes.json     16 composite indexes the LMS queries need
```

## Install

```bash
npm install   # peer deps: react, react-dom, next, firebase
```

In the **host** Next.js config, transpile the package source:

```js
// next.config.mjs
export default { transpilePackages: ['@edai/lms'] };
```

## Wire it up (once, at app startup)

The module was decoupled from its origin app through two injection points.

### 1. Firebase instances — `configureLms`

```ts
import { configureLms } from '@edai/lms';
import { db, storage, functions } from '@/lib/firebase'; // your instances

configureLms({
  db,                          // required — Firestore
  storage,                     // optional — only for course cover-image uploads
  functions,                   // optional — only for AI-assisted grading
  routeBase: '/hub/modules/lms', // optional — where you mount the pages (default shown)
});
```

Call this **before** any LMS page or service runs (e.g. in a top-level client
provider). Services read `db` as a live binding; calling a service before
`configureLms` throws a clear error.

### 2. Auth + analytics — `<LmsProvider>`

```tsx
'use client';
import { LmsProvider, type LmsRuntime } from '@edai/lms';
import { useAuth } from '@/components/auth';            // your hook
import { useSessionTracker } from '@/lib/analytics';    // optional

const runtime: LmsRuntime = {
  useAuth,            // must return { user, role, profile, loading? }
  useSessionTracker,  // optional — omit for a no-op (analytics off)
};

export function Providers({ children }: { children: React.ReactNode }) {
  return <LmsProvider runtime={runtime}>{children}</LmsProvider>;
}
```

Your `useAuth` must return this shape (a Firebase `User` satisfies `user`):

```ts
{
  user:    { uid: string; email?: string|null; displayName?: string|null } | null;
  role:    'superadmin'|'admin'|'content_curator'|'diplomate'|'fellow'|'researcher' | null;
  profile: { email: string; displayName: string } | null;
  loading?: boolean;
}
```

## Mount the pages

The pages build all internal links from the configured `routeBase` (default
**`/hub/modules/lms`**). Mount them under whatever base you pass to
`configureLms({ routeBase })`. Example App Router wiring (default base):

```tsx
// app/hub/modules/lms/page.tsx
'use client';
import { LMSDashboard } from '@edai/lms';
export default function Page() { return <LMSDashboard />; }

// app/hub/modules/lms/courses/[courseId]/page.tsx
'use client';
import { CourseDetail } from '@edai/lms';
export default function Page({ params }: { params: { courseId: string } }) {
  return <CourseDetail courseId={params.courseId} />;
}

// app/hub/modules/lms/certificates/page.tsx
// CertificatesPage calls useSearchParams(), so it MUST be wrapped in a
// <Suspense> boundary — otherwise `next build` fails to prerender this route.
import { Suspense } from 'react';
import { CertificatesPage } from '@edai/lms';
export default function Page() {
  return <Suspense><CertificatesPage /></Suspense>;
}
```

Exported pages: `LMSDashboard`, `CourseList`, `CourseDetail`, `CourseEditor`,
`CoursePlayer`, `CurriculaList`, `CurriculumDetail`, `CurriculumEditor`,
`MyLearning`, `GradingPage`, `CertificatesPage`, `ReportsPage`.

Services are also exported as namespaces for custom flows:
`courseService`, `lessonService`, `enrollmentService`, `curriculumService`,
`assignmentService`, `certificateService`, `announcementService`.

## Firestore setup

1. Merge `firestore.rules` (helpers + `lms_*` blocks) into your project's rules.
   The rules expect **role-based custom claims** (`roles` array, or legacy
   `role`) on the auth token.
2. Merge `firestore.indexes.json` into your project's indexes and deploy
   (`firebase deploy --only firestore`).

The module owns these collections: `lms_courses`, `lms_lessons`,
`lms_enrollments`, `lms_lesson_progress`, `lms_submissions`, `lms_curricula`,
`lms_curriculum_enrollments`, `lms_certificates`, `lms_announcements`.

## Assumptions & host requirements

These are the couplings that did **not** become injection points — know them
before deploying into a new project:

- **Route base.** Configurable via `configureLms({ routeBase })`, default
  `/hub/modules/lms`. Mount the pages at the same base. Use the exported
  `lmsRoute(sub)` to build links into the LMS from your own code.
- **Cross-module links.** A lesson may link to `/hub/modules/orals/session` or
  `/hub/modules/discussions/<id>` (other EdAI modules). These stay hardcoded and
  are independent of `routeBase` — harmless 404s if you don't run those modules.
- **Cross-module data (read-only).** `LessonRenderer` reads `mcq_sets`,
  `mcq_questions`, and `presentations` collections to embed MCQ/slide lessons.
  Those collections come from other EdAI modules; lessons of those types render
  empty if the collections are absent. Plain content lessons are unaffected.
- **AI grading Cloud Function.** `GradingPage`'s "AI feedback" calls a callable
  named `gradeAssignmentWithAI`. Deploy that function (and pass `functions` to
  `configureLms`) to enable it; manual grading works without it.
- **Tailwind.** Components are styled with Tailwind utility classes (dark theme,
  `indigo`/`teal` accents). Your host must run Tailwind and include this
  package's `src` in its `content` globs.
- **Suspense for `CertificatesPage`.** It uses `useSearchParams()`, so mount it
  inside a `<Suspense>` boundary (see *Mount the pages*) or `next build` fails
  to prerender that route. The other pages need no boundary.
- **Transpile the package.** It ships TypeScript source — add
  `transpilePackages: ['@edai/lms']` to `next.config`.

## Verify

```bash
npm run type-check   # tsc --noEmit — passes clean
```
