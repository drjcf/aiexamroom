import {
  collection, doc, getDocs, addDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config';
import type { Announcement, AnnouncementPriority } from '../types';

const ANNOUNCEMENTS = 'lms_announcements';

export async function createAnnouncement(params: {
  courseId: string;
  title: string;
  body: string;
  priority?: AnnouncementPriority;
  pinned?: boolean;
  createdBy: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, ANNOUNCEMENTS), {
    courseId: params.courseId,
    title: params.title,
    body: params.body,
    priority: params.priority ?? 'normal',
    pinned: params.pinned ?? false,
    createdBy: params.createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listCourseAnnouncements(
  courseId: string,
  count: number = 20,
): Promise<Announcement[]> {
  const q = query(
    collection(db, ANNOUNCEMENTS),
    where('courseId', '==', courseId),
    orderBy('createdAt', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement));
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  await deleteDoc(doc(db, ANNOUNCEMENTS, announcementId));
}
