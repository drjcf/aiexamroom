#!/usr/bin/env node
/**
 * Create (or update) ALL FOUR seat tracks end to end, from one source of truth:
 *   - one `lms_courses` doc per seat:  course_patient | course_caregiver | course_physician | course_nurse
 *   - one `lms_lessons` doc per module per seat, each an iframe -> that module on ?seat=<seat>
 *
 * Every track is the same nine cross-seat modules opened on a different ?seat=.
 * Module 9 (the proper-use practicum) reads ?seat= and renders that seat's edition.
 *
 * To add a module: append to MODULES below (file + per-seat description). Lesson ids,
 * lessonOrder, and estimatedHours are all derived from the array.
 *
 * Re-runnable: merges, and preserves enrollmentCount / createdAt / publishedAt on
 * existing docs (a re-run never resets live counters or original timestamps).
 *
 * Usage:
 *   # all four tracks:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/setup-courses.mjs
 *   # one track only:
 *   SEAT=patient   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/setup-courses.mjs
 *   # absolute encounter origin (default is root-relative / same-origin):
 *   ENCOUNTER_ORIGIN=https://aiintheexamroom.com node scripts/setup-courses.mjs
 *
 * NOTE: each m<n>.html must be deployed at /encounters/m<n>.html before (or with) a run,
 * or the iframe lesson loads empty.
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const AUTHOR_UID = process.env.AUTHOR_UID || 'UGRmcXclgdYQgqQlV9hktiF85PJ3';
const ORIGIN = process.env.ENCOUNTER_ORIGIN || ''; // '' => root-relative, same-origin

// ---- Per-seat course copy (schema) ---------------------------------------
const SEATS = {
  patient: {
    title: 'For Patients',
    shortDescription: 'Being a better-prepared patient, not a worse-informed one.',
    description:
      `The same encounters the caregiver, physician, and nurse tracks teach, from the patient's chair: when AI makes you a sharper, better-prepared patient, when it quietly misleads you, and how to use it without handing over your own care.`,
  },
  caregiver: {
    title: 'For Caregivers',
    shortDescription: 'Advocating well when AI and the care team disagree.',
    description:
      `You are the most common AI user in the exam room and the one no one trained. This track teaches the same encounters the patient, physician, and nurse tracks teach, from the seat of the person advocating for someone else: when AI sharpens your advocacy, when it derails it, and how to be heard.`,
  },
  physician: {
    title: 'For Physicians',
    shortDescription: 'Where AI is uplift, where judgment stays primary.',
    description:
      `The same encounters the other tracks teach, from the physician's chair: calibrating trust to the task, keeping a real (not ceremonial) human in the loop, modeling intelligent humility, and coaching the patient who arrives already using AI.`,
  },
  nurse: {
    title: 'For Nurses',
    shortDescription: 'Catching confident-wrong at the point of care.',
    description:
      `The same encounters the other tracks teach, from the nurse's chair: scope-appropriate use, catching confident-wrong before it becomes an order or a belief, re-triaging from the symptom, and teaching patients and families proper use.`,
  },
};

// ---- The modules (one source of truth) -----------------------------------
// desc: a per-seat one-line description used as that track's lesson blurb.
const MODULES = [
  {
    n: 1, file: 'm1.html', title: 'Module 1 \u00b7 The Prepared Patient', est: 15,
    desc: {
      patient: `Let AI organize your history and questions, then share it as a starting point, not a diagnosis, so you arrive prepared without anchoring your clinician.`,
      caregiver: `Your father's headaches, your 2am research, and a nine-page AI workup you brought to the visit. What to push for, what to let go, and how to advocate when the other side of the table hasn't trained for this.`,
      physician: `The AI-prepared patient is an asset, not a threat: welcome the preparation, watch for anchoring, and reason from your exam rather than their summary.`,
      nurse: `Help the AI-prepared patient use their workup to prepare, not to script the visit, and keep it from anchoring the team.`,
    },
  },
  {
    n: 2, file: 'm2.html', title: 'Module 2 \u00b7 But AI Said\u2026', est: 15,
    desc: {
      patient: `Sometimes the AI on your phone is right; learn to raise its point as a question instead of a fight, and let the clinician verify it.`,
      caregiver: `You drove your sister in, and the AI on her phone made a fair point about a prescription she didn't want. How to carry that point into the room without taking the wheel: translate, then hand the question back.`,
      physician: `When the patient's AI has a real point, authority is the wrong tool: verify the checkable claim with them instead of waving it off.`,
      nurse: `When an AI flags something legitimate, capture the detail that makes it checkable and tee up a shared decision rather than dismissing it.`,
    },
  },
  {
    n: 3, file: 'm3.html', title: 'Module 3 \u00b7 The 3am Confidant', est: 15,
    desc: {
      patient: `An AI can feel like it's listening at 3am; take the comfort, but let a person carry what a machine only kept company with.`,
      caregiver: `Late at night you ask an AI avatar about wigs for your wife on chemo, and end up confessing the fear and shame you can't show her. What the machine can give you, what it can't carry, and who to tell by daylight.`,
      physician: `The caregiver is the second patient, the one googling wigs at midnight: ask how they're holding up and refer them to real support.`,
      nurse: `A caregiver's careful practical question is a door to unspoken fear: answer it, then ask how they're doing and surface the strain.`,
    },
  },
  {
    n: 4, file: 'm4.html', title: 'Module 4 \u00b7 The Unsensed Room', est: 15,
    desc: {
      patient: `AI only knows what you type, and you'll send the calm version; for anything sudden or one-sided, get seen, don't self-triage.`,
      caregiver: `Your father types a calm version of his symptoms into an AI and it tells him to wait, but you can see the droop he can't feel. You're usually the sensor; how to trust your eyes over a confident screen, and act.`,
      physician: `AI reasons on a thin text slice; reproduce the exam it can't have and anchor on the time of onset no channel carries.`,
      nurse: `Triage is sensing: pull the stripped cues back across the channel (smile on camera, time of onset) instead of trusting the words.`,
    },
  },
  {
    n: 5, file: 'm5.html', title: 'Module 5 \u00b7 Access for the Unreached', est: 15,
    desc: {
      patient: `With no doctor, no English, no ride, AI in your language can be the first door: use it to understand, then find a person to confirm the dose.`,
      caregiver: `The person you care for had no doctor, no English, no ride, and an AI in their language was the first door that opened. Understanding the care you navigated blind, and being the bridge between a general answer and their specific body.`,
      physician: `The AI-informed under-served patient is a win, not a threat: welcome the access and supply the specificity the average answer can't.`,
      nurse: `AI may do the first teach in the patient's language; you confirm and correct, especially the dose and the red flags it kept general.`,
    },
  },
  {
    n: 6, file: 'm6.html', title: 'Module 6 \u00b7 The Reassurance Gamble', est: 15,
    desc: {
      patient: `A chatbot's calm and its alarm are both just tone: know your red flags and let a human make the time-critical call.`,
      caregiver: `Deciding whether to act or wait for someone else, on a chatbot's confident say-so. Why a calm screen and an alarmist one deserve equal skepticism, and why red-flag symptoms go to a human, not another message.`,
      physician: `Both the delayed and the over-presented land in your room: ask what the AI told them and rebuild the disposition with reasoning attached.`,
      nurse: `Triage absorbs the swing first: re-triage from the symptom, ignore the bot's verdict, and report floods as a calibration signal.`,
    },
  },
  {
    n: 7, file: 'm7.html', title: 'Module 7 \u00b7 Confident \u2260 Correct', est: 15,
    desc: {
      patient: `Fluency is no signal of truth: ask for a verifiable source and trust "I don't know" over a flawless, citation-filled paragraph.`,
      caregiver: `You were one click from giving your mother a supplement on a chatbot's confident, well-cited, wrong say-so. The tells that separate fluent from correct, and why you verify with a human before acting for someone vulnerable.`,
      physician: `The model is equally articulate right and wrong: calibrate trust to the source and task, demand the citation, and model intelligent humility.`,
      nurse: `You're the last filter before a confident-wrong claim becomes an order or a belief: verify unfamiliar "cited" claims before they're actioned.`,
    },
  },
  {
    n: 8, file: 'm8.html', title: 'Module 8 \u00b7 The Good Co-pilot', est: 15,
    desc: {
      patient: `Used well, AI does the prep so your twelve minutes go to the conversation only a human can have: bring the prep, leave the diagnosis to them.`,
      caregiver: `The resolution. AI finally carries the coordinating labor, consolidating records and meds across providers, so you advocate from one organized picture and stay the judgment that knows the person behind the chart.`,
      physician: `Offload the labor, the records, drafts, the second read, and keep the judgment and the signature; that's optimized, not replaced.`,
      nurse: `Let AI draft reconciliation and the first teach; your confirm-and-correct and the teach-back that sticks are where the safety lives.`,
    },
  },
  {
    n: 9, file: 'm9.html', title: 'Module 9 \u00b7 The Proper-Use Practicum', est: 20,
    desc: {
      patient: `Your proper-use playbook: prepare don't diagnose, share without anchoring, verify what you'd act on, and the red flags that mean stop and be seen.`,
      caregiver: `The caregiver edition of the proper-use playbook: verify before acting for someone who can't, use AI to coordinate and understand without deciding, advocate with the team, and the red flags that send you to a human, now.`,
      physician: `Your proper-use playbook: calibrate trust to task not fluency, verify and document a real loop, model humility, and coach the patient who brings AI in.`,
      nurse: `Your proper-use playbook: scope-appropriate use, catch confident-wrong at the point of care, re-triage from the symptom, and teach families proper use.`,
    },
  },
];

// --------------------------------------------------------------------------
if (!getApps().length) initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const now = FieldValue.serverTimestamp();

const courseId = (seat) => `course_${seat}`;
const lessonId = (seat, n) => `${courseId(seat)}_l${String(n).padStart(2, '0')}`;

function lessonDoc(seat, M) {
  return {
    id: lessonId(seat, M.n),
    courseId: courseId(seat),
    title: M.title,
    description: M.desc[seat],
    type: 'iframe',
    position: M.n,
    content: {
      iframeUrl: `${ORIGIN}/encounters/${M.file}?seat=${seat}`,
      iframeHeight: 1400,
      iframeAllowFullscreen: true,
    },
    completionCriteria: { type: 'view' },
    estimatedMinutes: M.est,
    isOptional: false,
    createdBy: AUTHOR_UID,
    updatedAt: now,
  };
}

function courseBase(seat) {
  const c = SEATS[seat];
  const lessonOrder = MODULES.map((M) => lessonId(seat, M.n));
  const totalMin = MODULES.reduce((s, M) => s + M.est, 0);
  return {
    id: courseId(seat),
    title: c.title,
    description: c.description,
    shortDescription: c.shortDescription,
    category: seat,
    tags: [seat, 'ai-literacy'],
    difficulty: 'beginner',
    estimatedHours: Math.max(1, Math.round(totalMin / 60)),
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
}

async function buildSeat(seat) {
  // Lessons first, so the course's lessonOrder always points at real docs.
  for (const M of MODULES) {
    const ref = db.collection('lms_lessons').doc(lessonId(seat, M.n));
    const snap = await ref.get();
    await ref.set(
      { ...lessonDoc(seat, M), createdAt: snap.exists ? snap.get('createdAt') : now },
      { merge: true },
    );
    console.log(`  lms_lessons/${lessonId(seat, M.n)}  ${snap.exists ? '(updated)' : '(created)'}  -> ${ORIGIN}/encounters/${M.file}?seat=${seat}`);
  }

  const ref = db.collection('lms_courses').doc(courseId(seat));
  const snap = await ref.get();
  await ref.set(
    {
      ...courseBase(seat),
      enrollmentCount: snap.exists ? snap.get('enrollmentCount') ?? 0 : 0,
      createdAt: snap.exists ? snap.get('createdAt') : now,
      publishedAt: snap.exists ? snap.get('publishedAt') ?? now : now,
    },
    { merge: true },
  );
  console.log(`lms_courses/${courseId(seat)}  ${snap.exists ? '(updated)' : '(created)'}  status=published  lessons=${MODULES.length}\n`);
}

async function run() {
  const target = (process.env.SEAT || 'all').toLowerCase();
  const seats = target === 'all' ? Object.keys(SEATS) : [target];
  for (const seat of seats) {
    if (!SEATS[seat]) { console.error(`Unknown SEAT "${seat}". Use one of: ${Object.keys(SEATS).join(', ')}, or omit for all.`); process.exit(1); }
  }
  for (const seat of seats) {
    console.log(`=== ${courseId(seat)} ===`);
    await buildSeat(seat);
  }
  console.log(`Done. Built ${seats.length} track(s): ${seats.map(courseId).join(', ')}, ${MODULES.length} modules each.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
