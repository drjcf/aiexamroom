import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../config';
import type { Course, CourseStatus, CourseSettings, DifficultyLevel, CourseVisibility } from '../types';

const COURSES = 'lms_courses';

// ─── Default Settings ────────────────────────────────────────

const DEFAULT_SETTINGS: CourseSettings = {
  selfPaced: true,
  passingScore: 70,
  certificateEnabled: false,
  allowRetakes: true,
  enforceSequentialProgress: true,
};

// ─── CRUD ────────────────────────────────────────────────────

export async function createCourse(params: {
  title: string;
  description: string;
  shortDescription: string;
  category: string;
  difficulty: DifficultyLevel;
  estimatedHours: number;
  visibility?: CourseVisibility;
  tags?: string[];
  settings?: Partial<CourseSettings>;
  createdBy: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, COURSES), {
    title: params.title,
    description: params.description,
    shortDescription: params.shortDescription,
    category: params.category,
    tags: params.tags ?? [],
    difficulty: params.difficulty,
    estimatedHours: params.estimatedHours,
    visibility: params.visibility ?? 'public',
    status: 'draft' as CourseStatus,
    lessonOrder: [],
    prerequisiteCourseIds: [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...Object.fromEntries(
        Object.entries(params.settings ?? {}).filter(([, v]) => v !== undefined),
      ),
    },
    createdBy: params.createdBy,
    instructorIds: [params.createdBy],
    enrollmentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const snap = await getDoc(doc(db, COURSES, courseId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Course;
}

export async function listCourses(
  filter?: { status?: CourseStatus; createdBy?: string; category?: string },
  count: number = 50,
): Promise<Course[]> {
  const constraints: Parameters<typeof query>[1][] = [
    orderBy('createdAt', 'desc'),
    limit(count),
  ];
  if (filter?.status) constraints.unshift(where('status', '==', filter.status));
  if (filter?.createdBy) constraints.unshift(where('createdBy', '==', filter.createdBy));
  if (filter?.category) constraints.unshift(where('category', '==', filter.category));

  const q = query(collection(db, COURSES), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
}

export async function listPublishedCourses(count: number = 50): Promise<Course[]> {
  return listCourses({ status: 'published' }, count);
}

export async function updateCourse(
  courseId: string,
  updates: Partial<Pick<Course,
    'title' | 'description' | 'shortDescription' | 'category' | 'tags' |
    'difficulty' | 'estimatedHours' | 'visibility' | 'lessonOrder' |
    'prerequisiteCourseIds' | 'settings' | 'instructorIds' | 'coverImageUrl'
  >>,
): Promise<void> {
  // Strip undefined values — Firestore rejects them
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (key === 'settings' && typeof value === 'object' && value !== null) {
      cleaned[key] = Object.fromEntries(
        Object.entries(value).filter(([, v]) => v !== undefined),
      );
    } else {
      cleaned[key] = value;
    }
  }
  await updateDoc(doc(db, COURSES, courseId), {
    ...cleaned,
    updatedAt: serverTimestamp(),
  });
}

export async function publishCourse(courseId: string): Promise<void> {
  await updateDoc(doc(db, COURSES, courseId), {
    status: 'published' as CourseStatus,
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function archiveCourse(courseId: string): Promise<void> {
  await updateDoc(doc(db, COURSES, courseId), {
    status: 'archived' as CourseStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function unpublishCourse(courseId: string): Promise<void> {
  await updateDoc(doc(db, COURSES, courseId), {
    status: 'draft' as CourseStatus,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a course and all of its lessons and announcements.
 * Enrollments, lesson_progress, submissions, and certificates are
 * intentionally preserved for audit/compliance.
 */
export async function deleteCourse(courseId: string): Promise<void> {
  // Delete lessons
  const lessonsSnap = await getDocs(
    query(collection(db, 'lms_lessons'), where('courseId', '==', courseId)),
  );
  await Promise.all(lessonsSnap.docs.map((d) => deleteDoc(d.ref)));

  // Delete announcements
  try {
    const annSnap = await getDocs(
      query(collection(db, 'lms_announcements'), where('courseId', '==', courseId)),
    );
    await Promise.all(annSnap.docs.map((d) => deleteDoc(d.ref)));
  } catch { /* collection may not exist */ }

  // Finally delete the course doc
  await deleteDoc(doc(db, COURSES, courseId));
}

export async function incrementEnrollmentCount(courseId: string): Promise<void> {
  const course = await getCourse(courseId);
  if (!course) return;
  await updateDoc(doc(db, COURSES, courseId), {
    enrollmentCount: (course.enrollmentCount ?? 0) + 1,
  });
}
