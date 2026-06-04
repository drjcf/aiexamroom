import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../config';
import type { Lesson, LessonType, LessonContent, LessonCompletionCriteria } from '../types';
import { updateCourse, getCourse } from './course.service';

const LESSONS = 'lms_lessons';

// ─── CRUD ────────────────────────────────────────────────────

export async function createLesson(params: {
  courseId: string;
  title: string;
  description: string;
  type: LessonType;
  content: LessonContent;
  completionCriteria?: LessonCompletionCriteria;
  estimatedMinutes: number;
  isOptional?: boolean;
  createdBy: string;
}): Promise<string> {
  // Get current lesson count for position
  const existing = await getCourseLessons(params.courseId);
  const position = existing.length;

  const ref = await addDoc(collection(db, LESSONS), {
    courseId: params.courseId,
    title: params.title,
    description: params.description,
    type: params.type,
    position,
    content: params.content,
    completionCriteria: params.completionCriteria ?? { type: 'view' },
    estimatedMinutes: params.estimatedMinutes,
    isOptional: params.isOptional ?? false,
    createdBy: params.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Add to course lessonOrder
  const course = await getCourse(params.courseId);
  if (course) {
    await updateCourse(params.courseId, {
      lessonOrder: [...course.lessonOrder, ref.id],
    });
  }

  return ref.id;
}

export async function getLesson(lessonId: string): Promise<Lesson | null> {
  const snap = await getDoc(doc(db, LESSONS, lessonId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Lesson;
}

export async function getCourseLessons(courseId: string): Promise<Lesson[]> {
  const q = query(
    collection(db, LESSONS),
    where('courseId', '==', courseId),
    orderBy('position', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lesson));
}

export async function updateLesson(
  lessonId: string,
  updates: Partial<Pick<Lesson,
    'title' | 'description' | 'type' | 'content' | 'completionCriteria' |
    'estimatedMinutes' | 'isOptional' | 'position'
  >>,
): Promise<void> {
  await updateDoc(doc(db, LESSONS, lessonId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteLesson(lessonId: string, courseId: string): Promise<void> {
  // Remove from course lessonOrder
  const course = await getCourse(courseId);
  if (course) {
    await updateCourse(courseId, {
      lessonOrder: course.lessonOrder.filter((id) => id !== lessonId),
    });
  }

  await deleteDoc(doc(db, LESSONS, lessonId));
}

export async function reorderLessons(courseId: string, lessonIds: string[]): Promise<void> {
  const batch = writeBatch(db);

  lessonIds.forEach((id, index) => {
    batch.update(doc(db, LESSONS, id), { position: index, updatedAt: serverTimestamp() });
  });

  await batch.commit();
  await updateCourse(courseId, { lessonOrder: lessonIds });
}
