import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config';
import type {
  Curriculum, CurriculumStatus, CurriculumCourse,
  CurriculumEnrollment, CurriculumEnrollmentStatus,
} from '../types';
import { getEnrollment } from './enrollment.service';

const CURRICULA = 'lms_curricula';
const CURRICULUM_ENROLLMENTS = 'lms_curriculum_enrollments';

// ─── Curriculum CRUD ─────────────────────────────────────────

export async function createCurriculum(params: {
  title: string;
  description: string;
  shortDescription: string;
  category: string;
  difficulty: string;
  certificateEnabled?: boolean;
  cmeCredits?: number;
  createdBy: string;
}): Promise<string> {
  const data: Record<string, unknown> = {
    title: params.title,
    description: params.description,
    shortDescription: params.shortDescription,
    category: params.category,
    difficulty: params.difficulty,
    status: 'draft' as CurriculumStatus,
    courses: [],
    estimatedHours: 0,
    certificateEnabled: params.certificateEnabled ?? false,
    enrollmentCount: 0,
    createdBy: params.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (params.cmeCredits) data.cmeCredits = params.cmeCredits;
  const ref = await addDoc(collection(db, CURRICULA), data);
  return ref.id;
}

export async function getCurriculum(id: string): Promise<Curriculum | null> {
  const snap = await getDoc(doc(db, CURRICULA, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Curriculum;
}

export async function listCurricula(
  filter?: { status?: CurriculumStatus; createdBy?: string },
  count: number = 50,
): Promise<Curriculum[]> {
  const constraints: Parameters<typeof query>[1][] = [
    orderBy('createdAt', 'desc'),
    limit(count),
  ];
  if (filter?.status) constraints.unshift(where('status', '==', filter.status));
  if (filter?.createdBy) constraints.unshift(where('createdBy', '==', filter.createdBy));

  const q = query(collection(db, CURRICULA), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Curriculum));
}

export async function listPublishedCurricula(count: number = 50): Promise<Curriculum[]> {
  return listCurricula({ status: 'published' }, count);
}

export async function updateCurriculum(
  id: string,
  updates: Partial<Pick<Curriculum,
    'title' | 'description' | 'shortDescription' | 'category' | 'difficulty' |
    'courses' | 'estimatedHours' | 'certificateEnabled' | 'cmeCredits'
  >>,
): Promise<void> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) cleaned[key] = value;
  }
  await updateDoc(doc(db, CURRICULA, id), {
    ...cleaned,
    updatedAt: serverTimestamp(),
  });
}

export async function publishCurriculum(id: string): Promise<void> {
  await updateDoc(doc(db, CURRICULA, id), {
    status: 'published' as CurriculumStatus,
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function unpublishCurriculum(id: string): Promise<void> {
  await updateDoc(doc(db, CURRICULA, id), {
    status: 'draft' as CurriculumStatus,
    updatedAt: serverTimestamp(),
  });
}

// ─── Curriculum Enrollment ───────────────────────────────────

export async function enrollInCurriculum(
  userId: string,
  curriculumId: string,
): Promise<string> {
  const existing = await getCurriculumEnrollment(userId, curriculumId);
  if (existing) return existing.id;

  const curriculum = await getCurriculum(curriculumId);
  if (!curriculum) throw new Error('Curriculum not found');

  const requiredCount = curriculum.courses.filter((c) => c.isRequired).length;

  const ref = await addDoc(collection(db, CURRICULUM_ENROLLMENTS), {
    userId,
    curriculumId,
    curriculumTitle: curriculum.title,
    status: 'enrolled' as CurriculumEnrollmentStatus,
    completedCourseIds: [],
    totalCourses: requiredCount,
    percentComplete: 0,
    enrolledAt: serverTimestamp(),
  });

  await updateDoc(doc(db, CURRICULA, curriculumId), {
    enrollmentCount: (curriculum.enrollmentCount ?? 0) + 1,
  });

  return ref.id;
}

export async function getCurriculumEnrollment(
  userId: string,
  curriculumId: string,
): Promise<CurriculumEnrollment | null> {
  const q = query(
    collection(db, CURRICULUM_ENROLLMENTS),
    where('userId', '==', userId),
    where('curriculumId', '==', curriculumId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as CurriculumEnrollment;
}

export async function listUserCurriculumEnrollments(
  userId: string,
  count: number = 50,
): Promise<CurriculumEnrollment[]> {
  const q = query(
    collection(db, CURRICULUM_ENROLLMENTS),
    where('userId', '==', userId),
    orderBy('enrolledAt', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CurriculumEnrollment));
}

export async function recalcCurriculumProgress(
  userId: string,
  curriculumId: string,
): Promise<void> {
  const enrollment = await getCurriculumEnrollment(userId, curriculumId);
  if (!enrollment) return;

  const curriculum = await getCurriculum(curriculumId);
  if (!curriculum) return;

  const requiredCourses = curriculum.courses.filter((c) => c.isRequired);
  const completedIds: string[] = [];

  for (const cc of requiredCourses) {
    const courseEnrollment = await getEnrollment(userId, cc.courseId);
    if (courseEnrollment?.status === 'completed') {
      completedIds.push(cc.courseId);
    }
  }

  const totalRequired = requiredCourses.length;
  const percentComplete = totalRequired > 0
    ? Math.round((completedIds.length / totalRequired) * 100)
    : 0;
  const isComplete = completedIds.length >= totalRequired && totalRequired > 0;

  const updates: Record<string, unknown> = {
    completedCourseIds: completedIds,
    totalCourses: totalRequired,
    percentComplete,
    status: isComplete ? 'completed' : completedIds.length > 0 ? 'in_progress' : 'enrolled',
  };

  if (isComplete && enrollment.status !== 'completed') {
    updates.completedAt = serverTimestamp();
  }

  await updateDoc(doc(db, CURRICULUM_ENROLLMENTS, enrollment.id), updates);
}
