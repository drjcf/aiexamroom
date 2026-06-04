#!/usr/bin/env node
/**
 * One-time migration: WordPress modules -> @edai/lms Courses + Lessons.
 *
 * Extraction strategy (v2 — clean output):
 *   1. strip site chrome (nav, header/footer, skip links, responsive duplicates);
 *   2. take ONLY the Elementor post-content region (the authored body);
 *   3. if that selector is absent, fall back to Mozilla Readability;
 *   4. convert that region to markdown and strip residual progress/skip lines.
 * This avoids dumping the menus + "Module N of 10 / NN%" widget into the body.
 *
 * The scenario -> shared Encounter consolidation is still a deliberate human step.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json AUTHOR_UID=<uid> \
 *     node scripts/migrate.mjs --preview     # module 1 only, prints, no writes
 *   ... node scripts/migrate.mjs             # full run (re-runnable; overwrites bodies)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const PREVIEW = process.argv.includes('--preview');
const AUTHOR_UID = process.env.AUTHOR_UID || 'MIGRATION';
const ORIGIN = 'https://aiintheexamroom.com';

// Removed before extraction: site chrome + Elementor responsive duplicates.
const STRIP = [
  'script', 'style', 'noscript', 'form', 'header', 'footer', 'nav', '#wpadminbar',
  '.elementor-location-header', '.elementor-location-footer',
  '.elementor-hidden-desktop', '.elementor-screen-only', '.screen-reader-text', '.skip-link',
].join(',');

// The authored body, most-specific first. Falls back to Readability if absent.
const PRECISE = [
  '.elementor-widget-theme-post-content .elementor-widget-container',
  '.elementor-widget-theme-post-content',
  '.entry-content',
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
  const dom = new JSDOM(await res.text(), { url });
  const doc = dom.window.document;
  doc.querySelectorAll(STRIP).forEach((n) => n.remove());

  let html = null, used = null;
  for (const sel of PRECISE) {
    const el = doc.querySelector(sel);
    if (el && el.textContent.trim().length > 200) { html = el.innerHTML; used = sel; break; }
  }
  if (!html) {
    try {
      const art = new Readability(doc).parse();
      if (art && art.content) { html = art.content; used = 'readability'; }
    } catch { /* fall through */ }
  }
  if (!html) throw new Error(`No content extracted for ${url}`);
  return { md: clean(td.turndown(html)), used };
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
    if (!track.modules.length) { console.log(`(skip ${track.key}: no modules listed)`); continue; }
    const courseId = `course_${track.key}`;
    const lessonOrder = [];
    let i = 0;
    for (const m of track.modules) {
      i += 1;
      const url = `${ORIGIN}${track.baseUrl}${m.slug}/`;
      const { md, used } = await toMarkdown(url);
      if (PREVIEW) {
        console.log(`\n--- PREVIEW ${track.key} #${i} (${url}) ---`);
        console.log(`extracted via: ${used}  (${md.length} chars)`);
        console.log(md.slice(0, 900));
        console.log('--- end preview (no writes) ---');
        return;
      }
      const lessonId = `${courseId}_l${String(i).padStart(2, '0')}`;
      await db.collection('lms_lessons').doc(lessonId).set(lessonDoc(courseId, m, i, md), { merge: true });
      lessonOrder.push(lessonId);
      console.log(`  ${lessonId}  (${md.length} chars, via ${used})`);
    }
    await db.collection('lms_courses').doc(courseId).set(courseDoc(track, lessonOrder), { merge: true });
    console.log(`course ${courseId}: ${lessonOrder.length} lessons`);
  }
  console.log('\nDone. Courses are status=draft; review and publish in-app.');
}

run().catch((e) => { console.error(e); process.exit(1); });
