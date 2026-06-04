# AI in the Exam Room — host app

Public, non-commercial AI-literacy curriculum. Next.js (App Router) host that mounts
the standalone **@edai/lms** module, backed by Firestore + Firebase Auth, deployed on
**Firebase App Hosting**. Open reading (anonymous auth, no signup wall); authoring gated
to a curator role; CME deferred (completion certificates only for now).

## Layout

```
app/                 marketing shell + /learn/* mounts of the LMS pages
lib/firebase.ts      Firebase client init (FIREBASE_WEBAPP_CONFIG in prod, env locally)
lib/auth.tsx         anonymous-auth useAuth() satisfying the LMS runtime contract
app/providers.tsx    configureLms({ routeBase:'/learn' }) + LmsProvider + AuthProvider
packages/edai-lms/   the LMS module (workspace package)
scripts/migrate.mjs  WordPress -> lms_courses/lms_lessons
scripts/set-author-claim.mjs
firestore.rules      adapted: open learning, gated authoring
firestore.indexes.json   16 composite indexes the LMS requires
apphosting.yaml / firebase.json
```

## Setup

1. **Firebase**: create project `aiexamroom` on the **Blaze** plan. Enable Firestore,
   Authentication (turn on **Anonymous** + any upgrade providers you want), and App Hosting.
2. **Install**: `npm install` (workspaces install the LMS + peer deps).
3. **Web app + config**: in Firebase console > Project settings > Your apps, register a
   **Web app** if none exists, and copy its `firebaseConfig`. The web API key is public
   (safe to commit). Put the values in `.env.local` (local) and in `apphosting.yaml` env
   (deploy). In Authentication > Sign-in method, enable **Google**; add your deploy domain
   under Authentication > Settings > Authorized domains (localhost is allowed by default).
3. **Env**: `cp .env.local.example .env.local` and fill the web config (prod uses the
   injected `FIREBASE_WEBAPP_CONFIG`).
4. **Author sign-in + role**: enable the **Google** sign-in provider in Firebase Auth.
   Visit `/signin` and continue with Google once (this links your anonymous session to a
   real account with an email). Then grant yourself the curator role:
   `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/set-author-claim.mjs you@domain.com`
   (or `--uid <uid>` using the uid shown on the /signin page). Sign out/in to refresh the token.
5. **Rules + indexes**: `firebase deploy --only firestore:rules,firestore:indexes`.
6. **Dev**: `npm run dev`.

## Migrate the WordPress modules

1. `TRACKS` in `scripts/migrate.mjs` is pre-filled for patient (8), physician (10), and nurse (10). Caregiver is empty until authored.
2. Dry run (module 1 only, prints matched container + markdown, no writes):
   `AUTHOR_UID=<uid> GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json npm run migrate:preview`
   Confirm the container selector is right; adjust `CONTAINERS`/`STRIP` if needed.
3. Full run: `... npm run migrate`. Courses land as `status=draft`; review and publish in-app.

## Deploy (App Hosting)

Connect this repo as an App Hosting backend (`backendId: aiexamroom`) for push-to-deploy,
or `firebase apphosting:backends:create`. The Firebase web config is auto-injected; add only
true server secrets via `firebase apphosting:secrets:set NAME`.

## Cutover

Keep the WordPress site live until content parity, then point aiintheexamroom.com (custom
domain) at the App Hosting backend.

---
*A free, non-commercial educational initiative by John C. Ferguson, MD, FACS.*

## Troubleshooting

- `auth/api-key-not-valid` on sign-in: the client bundle has no valid web config. Fill the
  `NEXT_PUBLIC_FIREBASE_*` values (`.env.local` locally, `apphosting.yaml` for deploy) and
  rebuild/restart. NEXT_PUBLIC vars only take effect at build/startup.
- Google popup blocked / `auth/unauthorized-domain`: add the domain under Firebase Auth >
  Settings > Authorized domains.

## Theme

Dark, brand-themed (TheDude Teal + Medical Authority Blue) with the parallax dot background. `app/globals.css` defines the brand tokens, the parallax, and the global classes the LMS expects (`glass`, `btn-primary`, `input-base`, `animate-pulse-slow`), plus accent retune and lesson callout styles. `@tailwindcss/typography` is configured in `tailwind.config.ts` (run `npm install`). Lesson markdown renders through a branded `prose` and the vendored `ContentRenderer` segments recurring labels (What AI got right / missed, Teaching moment, Outcome, Your exam findings) into colored callouts.
