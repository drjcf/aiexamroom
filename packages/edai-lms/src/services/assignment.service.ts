import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config';
import type { Submission, SubmissionStatus, Grade } from '../types';

const SUBMISSIONS = 'lms_submissions';

// ─── Submissions CRUD ────────────────────────────────────────

export async function createSubmission(params: {
  enrollmentId: string;
  userId: string;
  courseId: string;
  lessonId: string;
  content: string;
  isDraft?: boolean;
}): Promise<string> {
  // Get attempt number
  const existing = await listUserLessonSubmissions(
    params.userId, params.enrollmentId, params.lessonId,
  );
  const attemptNumber = existing.length + 1;

  const submissionId = `${params.enrollmentId}_${params.lessonId}_${attemptNumber}`;

  await setDoc(doc(db, SUBMISSIONS, submissionId), {
    enrollmentId: params.enrollmentId,
    userId: params.userId,
    courseId: params.courseId,
    lessonId: params.lessonId,
    content: params.content,
    status: (params.isDraft ? 'draft' : 'submitted') as SubmissionStatus,
    attemptNumber,
    ...(params.isDraft ? {} : { submittedAt: serverTimestamp() }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return submissionId;
}

export async function getSubmission(submissionId: string): Promise<Submission | null> {
  const snap = await getDoc(doc(db, SUBMISSIONS, submissionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Submission;
}

export async function updateSubmissionContent(
  submissionId: string,
  content: string,
  submit: boolean = false,
): Promise<void> {
  await updateDoc(doc(db, SUBMISSIONS, submissionId), {
    content,
    ...(submit ? {
      status: 'submitted' as SubmissionStatus,
      submittedAt: serverTimestamp(),
    } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function submitDraft(submissionId: string): Promise<void> {
  await updateDoc(doc(db, SUBMISSIONS, submissionId), {
    status: 'submitted' as SubmissionStatus,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ─── Querying ────────────────────────────────────────────────

export async function listUserLessonSubmissions(
  userId: string,
  enrollmentId: string,
  lessonId: string,
): Promise<Submission[]> {
  const q = query(
    collection(db, SUBMISSIONS),
    where('userId', '==', userId),
    where('enrollmentId', '==', enrollmentId),
    where('lessonId', '==', lessonId),
    orderBy('attemptNumber', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Submission));
}

export async function listLessonSubmissions(
  courseId: string,
  lessonId: string,
  count: number = 100,
): Promise<Submission[]> {
  const q = query(
    collection(db, SUBMISSIONS),
    where('courseId', '==', courseId),
    where('lessonId', '==', lessonId),
    where('status', 'in', ['submitted', 'grading', 'graded', 'returned']),
    orderBy('submittedAt', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Submission));
}

export async function listCourseSubmissions(
  courseId: string,
  statusFilter?: SubmissionStatus,
  count: number = 100,
): Promise<Submission[]> {
  const constraints: Parameters<typeof query>[1][] = [
    where('courseId', '==', courseId),
    orderBy('submittedAt', 'desc'),
    limit(count),
  ];
  if (statusFilter) {
    constraints.splice(1, 0, where('status', '==', statusFilter));
  }

  const q = query(collection(db, SUBMISSIONS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Submission));
}

export async function getPendingSubmissionCount(courseId: string): Promise<number> {
  const q = query(
    collection(db, SUBMISSIONS),
    where('courseId', '==', courseId),
    where('status', '==', 'submitted'),
  );
  const snap = await getDocs(q);
  return snap.size;
}

// ─── Grading ─────────────────────────────────────────────────

export async function gradeSubmission(
  submissionId: string,
  grade: Omit<Grade, 'gradedAt'>,
): Promise<void> {
  await updateDoc(doc(db, SUBMISSIONS, submissionId), {
    grade: {
      ...grade,
      gradedAt: serverTimestamp(),
    },
    status: 'graded' as SubmissionStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function saveAiSuggestedGrade(
  submissionId: string,
  aiGrade: Omit<Grade, 'gradedAt'>,
): Promise<void> {
  await updateDoc(doc(db, SUBMISSIONS, submissionId), {
    aiSuggestedGrade: {
      ...aiGrade,
      gradedAt: serverTimestamp(),
    },
    status: 'grading' as SubmissionStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function returnSubmission(
  submissionId: string,
  feedback: string,
): Promise<void> {
  await updateDoc(doc(db, SUBMISSIONS, submissionId), {
    status: 'returned' as SubmissionStatus,
    'grade.overallFeedback': feedback,
    updatedAt: serverTimestamp(),
  });
}
