#!/usr/bin/env node
/**
 * Create (or update) the Caregiver track end to end:
 *   - one `lms_courses` doc:  course_caregiver  (published)
 *   - one `lms_lessons` doc per module, each an iframe -> that module's caregiver seat
 *
 * The caregiver track is the same cross-seat encounters opened on ?seat=caregiver.
 * To add a module: append to LESSONS below (the encounter file + position). The
 * lesson id and lessonOrder are derived from the array.
 *
 * Re-runnable: merges, and preserves enrollmentCount / createdAt on existing docs
 * (a re-run never resets live counters or original timestamps).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/setup-caregiver-course.mjs
 *   # optional overrides:
 *   AUTHOR_UID=<uid> ENCOUNTER_ORIGIN=https://aiintheexamroom.com node scripts/setup-caregiver-course.mjs
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const AUTHOR_UID = process.env.AUTHOR_UID || 'UGRmcXclgdYQgqQlV9hktiF85PJ3';
// Root-relative keeps it same-origin (encounter files ship in /public/encounters
// and serve at the site root). Set ENCOUNTER_ORIGIN to use an absolute URL.
const ORIGIN = process.env.ENCOUNTER_ORIGIN || '';
const SEAT = 'caregiver';

const COURSE_ID = 'course_caregiver';

// One entry per published module. Append as modules ship.
const LESSONS = [
  {
    n: 1,
    file: 'm1.html',
    title: 'Module 1 \u00b7 The Prepared Patient',
    description:
      'The caregiver seat: your father\u2019s headaches, your 2am research, and a nine-page AI workup you brought to the visit. What to push for, what to let go, and how to advocate when the other side of the table hasn\u2019t trained for this.',
    estimatedMinutes: 15,
  },
  {
    n: 2,
    file: 'm2.html',
    title: 'Module 2 \u00b7 But AI Said\u2026',
    description:
      'The caregiver seat: you drove your sister in, and the AI on her phone made a fair point about a prescription she didn\u2019t want. How to carry that point into the room without taking the wheel \u2014 translate, then hand the question back.',
    estimatedMinutes: 15,
  },
  {
    n: 3,
    file: 'm3.html',
    title: 'Module 3 \u00b7 The 3am Confidant',
    description:
      'The caregiver seat: late at night you ask an AI avatar about wigs for your wife on chemo, and end up confessing the fear and shame you can\u2019t show her. What the machine can give you, what it can\u2019t carry, and who to tell by daylight.',
    estimatedMinutes: 15,
  },
  {
    n: 4,
    file: 'm4.html',
    title: 'Module 4 \u00b7 The Unsensed Room',
    description:
      'The caregiver seat: your father types a calm version of his symptoms into an AI and it tells him to wait, but you can see the droop he can\u2019t feel. You\u2019re usually the sensor; how to trust your eyes over a confident screen, and act.',
    estimatedMinutes: 15,
  },
  {
    n: 5,
    file: 'm5.html',
    title: 'Module 5 \u00b7 Access for the Unreached',
    description:
      'The caregiver seat: the person you care for had no doctor, no English, no ride, and an AI in their language was the first door that opened. Understanding the care you navigated blind, and being the bridge between a general answer and their specific body.',
    estimatedMinutes: 15,
  },
  {
    n: 6,
    file: 'm6.html',
    title: 'Module 6 \u00b7 The Reassurance Gamble',
    description:
      'The caregiver seat: deciding whether to act or wait for someone else, on a chatbot\u2019s confident say-so. Why a calm screen and an alarmist one deserve equal skepticism, and why red-flag symptoms go to a human, not another message.',
    estimatedMinutes: 15,
  },
  {
    n: 7,
    file: 'm7.html',
    title: 'Module 7 \u00b7 Confident \u2260 Correct',
    description:
      'The caregiver seat: you were one click from giving your mother a supplement on a chatbot\u2019s confident, well-cited, wrong say-so. The tells that separate fluent from correct, and why you verify with a human before acting for someone vulnerable.',
    estimatedMinutes: 15,
  },
  {
    n: 8,
    file: 'm8.html',
    title: 'Module 8 \u00b7 The Good Co-pilot',
    description:
      'The caregiver seat: the resolution. AI finally carries the coordinating labor, consolidating records and meds across providers, so you advocate from one organized picture and stay the judgment that knows the person behind the chart.',
    estimatedMinutes: 15,
  },
];

if (!getApps().length) initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const now = FieldValue.serverTimestamp();

const lessonId = (n) => `${COURSE_ID}_l${String(n).padStart(2, '0')}`;

function lessonDoc(L) {
  return {
    id: lessonId(L.n),
    courseId: COURSE_ID,
    title: L.title,
    description: L.description,
    type: 'iframe',
    position: L.n,
    content: {
      iframeUrl: `${ORIGIN}/encounters/${L.file}?seat=${SEAT}`,
      iframeHeight: 1400,
      iframeAllowFullscreen: true,
    },
    completionCriteria: { type: 'view' },
    estimatedMinutes: L.estimatedMinutes,
    isOptional: false,
    createdBy: AUTHOR_UID,
    updatedAt: now,
  };
}

const lessonOrder = LESSONS.map((L) => lessonId(L.n));

const courseBase = {
  id: COURSE_ID,
  title: 'For Caregivers',
  description:
    'You are the most common AI user in the exam room and the one no one trained. This track teaches the same encounters the patient, physician, and nurse tracks teach, from the seat of the person advocating for someone else: when AI sharpens your advocacy, when it derails it, and how to be heard.',
  shortDescription: 'Advocating well when AI and the care team disagree.',
  category: 'caregiver',
  tags: ['caregiver', 'ai-literacy'],
  difficulty: 'beginner',
  estimatedHours: Math.max(1, Math.round((LESSONS.length * 15) / 60)),
  visibility: 'public',
  status: 'published',
  lessonOrder,
  prerequisiteCourseIds: [],
  settings: {
    selfPaced: true,
    passingScore: 0,
    certificateEnabled: true,
    cmeCredits: 0, // completion certificate only; CME deferred
    allowRetakes: true,
    enforceSequentialProgress: false,
  },
  createdBy: AUTHOR_UID,
  instructorIds: [AUTHOR_UID],
  updatedAt: now,
};

async function run() {
  // Lessons first, so the course's lessonOrder always points at real docs.
  for (const L of LESSONS) {
    const ref = db.collection('lms_lessons').doc(lessonId(L.n));
    const snap = await ref.get();
    await ref.set(
      { ...lessonDoc(L), createdAt: snap.exists ? snap.get('createdAt') : now },
      { merge: true },
    );
    console.log(`lms_lessons/${lessonId(L.n)}  ${snap.exists ? '(updated)' : '(created)'}  -> ${ORIGIN}/encounters/${L.file}?seat=${SEAT}`);
  }

  const courseRef = db.collection('lms_courses').doc(COURSE_ID);
  const courseSnap = await courseRef.get();
  await courseRef.set(
    {
      ...courseBase,
      enrollmentCount: courseSnap.exists ? courseSnap.get('enrollmentCount') ?? 0 : 0,
      createdAt: courseSnap.exists ? courseSnap.get('createdAt') : now,
      publishedAt: courseSnap.exists ? courseSnap.get('publishedAt') ?? now : now,
    },
    { merge: true },
  );
  console.log(`lms_courses/${COURSE_ID}  ${courseSnap.exists ? '(updated)' : '(created)'}  status=published  lessons=${lessonOrder.length}`);

  console.log(`\nDone. course_caregiver is live with ${lessonOrder.length} module(s): ${lessonOrder.join(', ')}.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
