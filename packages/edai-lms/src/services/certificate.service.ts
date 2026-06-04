import {
  collection, doc, getDoc, getDocs, addDoc,
  query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config';
import type { Certificate } from '../types';

const CERTIFICATES = 'lms_certificates';

function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function issueCertificate(params: {
  userId: string;
  userName: string;
  type: 'course' | 'curriculum';
  referenceId: string;
  referenceTitle: string;
  score?: number;
  cmeCredits?: number;
}): Promise<string> {
  // Check for existing certificate
  const existing = await getCertificateByReference(params.userId, params.referenceId);
  if (existing) return existing.id;

  const data: Record<string, unknown> = {
    userId: params.userId,
    userName: params.userName,
    type: params.type,
    referenceId: params.referenceId,
    referenceTitle: params.referenceTitle,
    verificationCode: generateVerificationCode(),
    issuedAt: serverTimestamp(),
  };
  if (params.score !== undefined) data.score = params.score;
  if (params.cmeCredits !== undefined) data.cmeCredits = params.cmeCredits;

  const ref = await addDoc(collection(db, CERTIFICATES), data);
  return ref.id;
}

export async function getCertificate(id: string): Promise<Certificate | null> {
  const snap = await getDoc(doc(db, CERTIFICATES, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Certificate;
}

export async function getCertificateByReference(
  userId: string,
  referenceId: string,
): Promise<Certificate | null> {
  const q = query(
    collection(db, CERTIFICATES),
    where('userId', '==', userId),
    where('referenceId', '==', referenceId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Certificate;
}

export async function listUserCertificates(
  userId: string,
  count: number = 50,
): Promise<Certificate[]> {
  const q = query(
    collection(db, CERTIFICATES),
    where('userId', '==', userId),
    orderBy('issuedAt', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Certificate));
}

export async function verifyCertificate(
  verificationCode: string,
): Promise<Certificate | null> {
  const q = query(
    collection(db, CERTIFICATES),
    where('verificationCode', '==', verificationCode),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Certificate;
}
