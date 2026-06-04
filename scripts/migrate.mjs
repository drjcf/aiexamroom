#!/usr/bin/env node
/**
 * One-time migration: WordPress modules -> @edai/lms Courses + Lessons.
 *
 * Extraction (v3 — complete + clean):
 *   These are hand-built Elementor PAGES: the body is spread across many sibling
 *   sections. Readability picks the single densest block and drops the rest, so
 *   it is NOT used. Instead we take the whole Elementor page-content wrapper
 *   ([data-elementor-type="wp-page"]) — every authored section, in order — and
 *   strip site chrome. The nav menus live in a separate header template, so the
 *   wrapper already excludes them.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json AUTHOR_UID=<uid> \
 *     node scripts/migrate.mjs --preview                    # first module, no writes
 *     node scripts/migrate.mjs --preview --slug=clinical-scenarios   # a specific module
 *     node scripts/migrate.mjs                              # full run (re-runnable)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { JSDOM, VirtualConsole } from 'jsdom';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const PREVIEW = process.argv.includes('--preview');
const SLUG = (process.argv.find((a) => a.startsWith('--slug=')) || '').split('=')[1] || null;
const AUTHOR_UID = process.env.AUTHOR_UID || 'MIGRATION';
const ORIGIN = 'https://aiintheexamroom.com';

// Chrome removed before conversion (nav menus, header/footer, skip links, responsive dupes).
const CHROME = [
  'script', 'style', 'noscript', 'form', 'header', 'footer', 'nav', '#wpadminbar',
  '.elementor-location-header', '.elementor-location-footer',
  '.elementor-nav-menu', '.elementor-widget-nav-menu', '[role="navigation"]',
  '.e-n-menu', '.elementor-menu-toggle',
  '.elementor-hidden-desktop', '.elementor-screen-only', '.screen-reader-text', '.skip-link',
].join(',');

// Whole authored page body, most-specific first. NO Readability fallback (it truncates);
// fall back only to broader containers so content is never lost.
const PAGE_ROOTS = [
  '[data-elementor-type="wp-page"]',
  '[data-elementor-type="wp-post"]',
  '.elementor-location-single',
  'main',
  'body',
];

const TRACKS = [
  {
    key: 'patient', category: 'patient',
    courseTitle: 'For Patients', baseUrl: '/for-patients/',
    description: 'Using medical AI safely as a patient.',
    modules: [
      { slug: 'why-youre-here', title: "Module 1: Why You're Here" },
      { slug: 'velociraptor-test', title: 'Module 2: The Velociraptor Test' },
      { slug: 'red-flags', title: 'Module 3: Red Flags' },
      { slug: 'the-hallucination-problem', title: 'Module 4: The Hallucination Problem' },
      { slug: 'content-controlled-ai', title: 'Module 5: Content-Controlled AI' },
      { slug: 'intelligent-humility', title: 'Module 6: Intelligent Humility' },
      { slug: 'questions-to-ask-your-ai', title: 'Module 7: Questions to Ask Your AI' },
      { slug: 'module-8-when-ai-is-actually-helpful', title: 'Module 8: When AI Is Actually Helpful' },
    ],
  },
  {
    key: 'physician', category: 'physician',
    courseTitle: 'For Physicians', baseUrl: '/for-physicians/',
    description: 'Receiving, validating, correcting, and documenting AI-informed patients.',
    modules: [
      { slug: 'the-new-reality', title: 'Module 1: The New Reality' },
      { slug: 'the-opening-question', title: 'Module 2: The Opening Question' },
      { slug: 'exam-ai-couldnt-do', title: "Module 3: The Exam AI Couldn't Do" },
      { slug: 'validating-what-ai-got-right', title: 'Module 4: Validating What AI Got Right' },
      { slug: 'correcting-what-ai-missed', title: 'Module 5: Correcting What AI Missed' },
      { slug: 'teaching-the-velociraptor-test', title: 'Module 6: Teaching the Velociraptor Test' },
      { slug: 'teaching-intelligent-humility', title: 'Module 7: Teaching Intelligent Humility' },
      { slug: 'malpractice-reality', title: 'Module 8: The Malpractice Reality' },
      { slug: 'clinical-scenarios', title: 'Module 9: Clinical Scenarios' },
      { slug: 'implementation-documentation-2', title: 'Module 10: Implementation & Documentation' },
    ],
  },
  {
    key: 'nurse', category: 'nurse',
    courseTitle: 'For Nurses', baseUrl: '/for-nurses/',
    description: 'AI at the bedside: triage, reconciliation, education.',
    modules: [
      { slug: 'the-new-reality', title: 'Module 1: The New Reality' },
      { slug: 'nursing-velociraptor-test', title: 'Module 2: The Nursing Velociraptor Test' },
      { slug: 'ai-nursing-workflows', title: 'Module 3: AI in Nursing Workflows' },
      { slug: 'content-controlled-nursing', title: 'Module 4: Content-Controlled Intelligence' },
      { slug: 'intelligent-humility-nursing', title: 'Module 5: Intelligent Humility' },
      { slug: 'medication-safety-ai', title: 'Module 6: Medication Safety and AI' },
      { slug: 'patient-family-education-ai', title: 'Module 7: Patient and Family Education' },
      { slug: 'ai-nursing-workflows-2', title: 'Module 8: The Malpractice Reality' },
      { slug: 'nursing-clinical-scenarios', title: 'Module 9: Clinical Scenarios' },
      { slug: 'nursing-implementation-protection', title: 'Module 10: Implementation and Protection' },
    ],
  },
  {
    key: 'caregiver', category: 'caregiver',
    courseTitle: 'For Caregivers', baseUrl: '/for-caregivers/',
    description: 'Advocating for someone in your care.',
    modules: [],
  },
];

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
td.use(gfm);

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

function clean(md) {
  return md
    .replace(/\r/g, '')
    .replace(/^\s*\[Skip to content\].*$/gim, '')
    .replace(/^\s*Module \d+ of \d+\s*$/gim, '')
    .replace(/^\s*\d+%\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function toMarkdown(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (edai-migration)' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const virtualConsole = new VirtualConsole();       // swallow jsdom's CSS-parse noise
  virtualConsole.on('jsdomError', () => {});
  const dom = new JSDOM(await res.text(), { url, virtualConsole });
  const doc = dom.window.document;
  doc.querySelectorAll(CHROME).forEach((n) => n.remove());

  let root = null, used = null;
  for (const sel of PAGE_ROOTS) {
    const el = doc.querySelector(sel);
    if (el && el.textContent.trim().length > 200) { root = el; used = sel; break; }
  }
  if (!root) throw new Error(`No content root for ${url}`);
  return { md: clean(td.turndown(root.innerHTML)), used };
}

function courseDoc(track, lessonOrder) {
  const now = FieldValue.serverTimestamp();
  return {
    title: track.courseTitle, description: track.description,
    shortDescription: track.description.slice(0, 140),
    category: track.category, tags: [track.category, 'ai-literacy'],
    difficulty: 'beginner', estimatedHours: Math.max(1, Math.round(lessonOrder.length * 0.25)),
    visibility: 'public', status: 'draft', lessonOrder, prerequisiteCourseIds: [],
    settings: {
      selfPaced: true, passingScore: 0, certificateEnabled: true, cmeCredits: 0,
      allowRetakes: true, enforceSequentialProgress: false,
    },
    createdBy: AUTHOR_UID, instructorIds: [AUTHOR_UID], enrollmentCount: 0,
    createdAt: now, updatedAt: now,
  };
}

function lessonDoc(courseId, m, position, body) {
  const now = FieldValue.serverTimestamp();
  return {
    courseId, title: m.title, description: '', type: 'content', position,
    content: { body }, completionCriteria: { type: 'view' },
    estimatedMinutes: Math.max(3, Math.round(body.length / 1500)),
    isOptional: false, createdBy: AUTHOR_UID, createdAt: now, updatedAt: now,
  };
}

async function run() {
  for (const track of TRACKS) {
    if (!track.modules.length) { if (!PREVIEW) console.log(`(skip ${track.key}: no modules listed)`); continue; }
    const courseId = `course_${track.key}`;
    const lessonOrder = [];
    let i = 0;
    for (const m of track.modules) {
      i += 1;
      if (PREVIEW && SLUG && m.slug !== SLUG) continue;
      const url = `${ORIGIN}${track.baseUrl}${m.slug}/`;
      const { md, used } = await toMarkdown(url);
      if (PREVIEW) {
        console.log(`\n--- PREVIEW ${track.key} #${i} ${m.slug} (${url}) ---`);
        console.log(`root: ${used}   length: ${md.length} chars`);
        console.log('----- first 1200 chars -----');
        console.log(md.slice(0, 1200));
        console.log('----- last 600 chars -----');
        console.log(md.slice(-600));
        console.log('--- end preview (no writes) ---');
        return;
      }
      const lessonId = `${courseId}_l${String(i).padStart(2, '0')}`;
      await db.collection('lms_lessons').doc(lessonId).set(lessonDoc(courseId, m, i, md), { merge: true });
      lessonOrder.push(lessonId);
      console.log(`  ${lessonId}  (${md.length} chars, via ${used})`);
    }
    if (!PREVIEW) {
      await db.collection('lms_courses').doc(courseId).set(courseDoc(track, lessonOrder), { merge: true });
      console.log(`course ${courseId}: ${lessonOrder.length} lessons`);
    }
  }
  if (PREVIEW && SLUG) console.log(`(no module matched --slug=${SLUG})`);
  else if (!PREVIEW) console.log('\nDone. Courses are status=draft; review and publish in-app.');
}

run().catch((e) => { console.error(e); process.exit(1); });
