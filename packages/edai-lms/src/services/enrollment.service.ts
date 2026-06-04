import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../config';
import type {
  Enrollment, EnrollmentStatus, LessonProgress, LessonProgressStatus,
  LinkedModuleData,
} from '../types';
import { getCourse, incrementEnrollmentCount } from './course.service';
import { getCourseLessons } from './lesson.service';

const ENROLLMENTS = 'lms_enrollments';
const LESSON_PROGRESS = 'lms_lesson_progress';

// ─── Enrollment CRUD ─────────────────────────────────────────

export async function enrollInCourse(
  userId: string,
  courseId: string,
): Promise<string> {
  // Check for existing enrollment
  const existing = await getEnrollment(userId, courseId);
  if (existing) return existing.id;

  const course = await getCourse(courseId);
  if (!course) throw new Error('Course not found');

  const lessons = await getCourseLessons(courseId);
  const requiredCount = lessons.filter((l) => !l.isOptional).length;

  const ref = await addDoc(collection(db, ENROLLMENTS), {
    userId,
    courseId,
    courseTitle: course.title,
    status: 'enrolled' as EnrollmentStatus,
    progress: {
      completedLessons: 0,
      totalLessons: requiredCount,
      percentComplete: 0,
      lastAccessedAt: serverTimestamp(),
    },
    grades: {
      assessmentScores: {},
    },
    enrolledAt: serverTimestamp(),
  });

  await incrementEnrollmentCount(courseId);
  return ref.id;
}

export async function getEnrollment(
  userId: string,
  courseId: string,
): Promise<Enrollment | null> {
  const q = query(
    collection(db, ENROLLMENTS),
    where('userId', '==', userId),
    where('courseId', '==', courseId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Enrollment;
}

export async function getEnrollmentById(enrollmentId: string): Promise<Enrollment | null> {
  const snap = await getDoc(doc(db, ENROLLMENTS, enrollmentId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Enrollment;
}

export async function listUserEnrollments(
  userId: string,
  status?: EnrollmentStatus,
  count: number = 50,
): Promise<Enrollment[]> {
  const constraints: Parameters<typeof query>[1][] = [
    where('userId', '==', userId),
    orderBy('enrolledAt', 'desc'),
    limit(count),
  ];
  if (status) constraints.splice(1, 0, where('status', '==', status));

  const q = query(collection(db, ENROLLMENTS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
}

export async function listCourseEnrollments(
  courseId: string,
  count: number = 100,
): Promise<Enrollment[]> {
  const q = query(
    collection(db, ENROLLMENTS),
    where('courseId', '==', courseId),
    orderBy('enrolledAt', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
}

export async function dropEnrollment(enrollmentId: string): Promise<void> {
  await updateDoc(doc(db, ENROLLMENTS, enrollmentId), {
    status: 'dropped' as EnrollmentStatus,
    droppedAt: serverTimestamp(),
  });
}

// ─── Lesson Progress ─────────────────────────────────────────

export async function getLessonProgress(
  enrollmentId: string,
  lessonId: string,
): Promise<LessonProgress | null> {
  const progressId = `${enrollmentId}_${lessonId}`;
  const snap = await getDoc(doc(db, LESSON_PROGRESS, progressId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as LessonProgress;
}

export async function getEnrollmentLessonProgress(
  enrollmentId: string,
  userId: string,
): Promise<LessonProgress[]> {
  const q = query(
    collection(db, LESSON_PROGRESS),
    where('enrollmentId', '==', enrollmentId),
    where('userId', '==', userId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LessonProgress));
}

export async function startLesson(
  enrollmentId: string,
  userId: string,
  courseId: string,
  lessonId: string,
): Promise<void> {
  const progressId = `${enrollmentId}_${lessonId}`;
  const existing = await getDoc(doc(db, LESSON_PROGRESS, progressId));

  if (existing.exists()) {
    // Already started — just update access time
    await updateDoc(doc(db, LESSON_PROGRESS, progressId), {
      updatedAt: serverTimestamp(),
    });
  } else {
    // Create new progress record using set with explicit ID
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, LESSON_PROGRESS, progressId), {
      enrollmentId,
      userId,
      courseId,
      lessonId,
      status: 'in_progress' as LessonProgressStatus,
      timeSpentMinutes: 0,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Update enrollment status if still 'enrolled'
  const enrollment = await getEnrollmentById(enrollmentId);
  if (enrollment && enrollment.status === 'enrolled') {
    await updateDoc(doc(db, ENROLLMENTS, enrollmentId), {
      status: 'in_progress' as EnrollmentStatus,
      'progress.currentLessonId': lessonId,
      'progress.lastAccessedAt': serverTimestamp(),
    });
  } else if (enrollment) {
    await updateDoc(doc(db, ENROLLMENTS, enrollmentId), {
      'progress.currentLessonId': lessonId,
      'progress.lastAccessedAt': serverTimestamp(),
    });
  }
}

export async function completeLesson(
  enrollmentId: string,
  lessonId: string,
  timeSpentMinutes?: number,
): Promise<void> {
  const progressId = `${enrollmentId}_${lessonId}`;

  await updateDoc(doc(db, LESSON_PROGRESS, progressId), {
    status: 'completed' as LessonProgressStatus,
    ...(timeSpentMinutes !== undefined ? { timeSpentMinutes } : {}),
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Recalculate enrollment progress
  await recalcEnrollmentProgress(enrollmentId);
}

export async function completeLessonWithScore(
  enrollmentId: string,
  lessonId: string,
  score: number,
  passed: boolean,
  linkedModuleData?: LinkedModuleData,
  timeSpentMinutes?: number,
): Promise<void> {
  const progressId = `${enrollmentId}_${lessonId}`;

  await updateDoc(doc(db, LESSON_PROGRESS, progressId), {
    status: 'completed' as LessonProgressStatus,
    score,
    passed,
    ...(linkedModuleData ? { linkedModuleData } : {}),
    ...(timeSpentMinutes !== undefined ? { timeSpentMinutes } : {}),
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Store score in enrollment grades
  await updateDoc(doc(db, ENROLLMENTS, enrollmentId), {
    [`grades.assessmentScores.${lessonId}`]: score,
  });

  await recalcEnrollmentProgress(enrollmentId);
}

export async function updateLessonTime(
  enrollmentId: string,
  lessonId: string,
  additionalMinutes: number,
): Promise<void> {
  const progressId = `${enrollmentId}_${lessonId}`;
  const existing = await getLessonProgress(enrollmentId, lessonId);
  if (!existing) return;

  await updateDoc(doc(db, LESSON_PROGRESS, progressId), {
    timeSpentMinutes: (existing.timeSpentMinutes ?? 0) + additionalMinutes,
    updatedAt: serverTimestamp(),
  });
}

// ─── Progress Recalculation ──────────────────────────────────

async function recalcEnrollmentProgress(enrollmentId: string): Promise<void> {
  const enrollment = await getEnrollmentById(enrollmentId);
  if (!enrollment) return;

  const lessons = await getCourseLessons(enrollment.courseId);
  const requiredLessons = lessons.filter((l) => !l.isOptional);
  const allProgress = await getEnrollmentLessonProgress(enrollmentId, enrollment.userId);

  const completedProgress = allProgress.filter((p) => p.status === 'completed');
  const completedRequiredCount = completedProgress.filter((p) =>
    requiredLessons.some((l) => l.id === p.lessonId),
  ).length;

  const totalRequired = requiredLessons.length;
  const percentComplete = totalRequired > 0
    ? Math.round((completedRequiredCount / totalRequired) * 100)
    : 0;

  const isComplete = completedRequiredCount >= totalRequired && totalRequired > 0;

  const updates: Record<string, unknown> = {
    'progress.completedLessons': completedRequiredCount,
    'progress.totalLessons': totalRequired,
    'progress.percentComplete': percentComplete,
    'progress.lastAccessedAt': serverTimestamp(),
  };

  if (isComplete && enrollment.status !== 'completed') {
    updates.status = 'completed' as EnrollmentStatus;
    updates.completedAt = serverTimestamp();
  }

  await updateDoc(doc(db, ENROLLMENTS, enrollmentId), updates);
}
