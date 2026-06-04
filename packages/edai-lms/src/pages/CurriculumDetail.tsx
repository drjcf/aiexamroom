'use client';

import { routeBase } from '../config';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Route, BookOpen, Clock, Users, GraduationCap,
  Check, Lock, Edit, ChevronRight, Award,
} from 'lucide-react';
import { useAuth } from '../context';
import {
  getCurriculum, enrollInCurriculum, getCurriculumEnrollment,
} from '../services/curriculum.service';
import { getEnrollment } from '../services/enrollment.service';
import { getCourse } from '../services/course.service';
import { issueCertificate, getCertificateByReference } from '../services/certificate.service';
import type { Curriculum, CurriculumEnrollment, Course, Enrollment, Certificate } from '../types';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '../types';
import ProgressBar from '../components/ProgressBar';

interface CurriculumDetailProps {
  curriculumId: string;
}

export default function CurriculumDetail({ curriculumId }: CurriculumDetailProps) {
  const { user, role, profile } = useAuth();
  const router = useRouter();

  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [enrollment, setEnrollment] = useState<CurriculumEnrollment | null>(null);
  const [courseDetails, setCourseDetails] = useState<Record<string, Course>>({});
  const [courseEnrollments, setCourseEnrollments] = useState<Record<string, Enrollment>>({});
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  const isCurator = role === 'content_curator' || role === 'admin' || role === 'superadmin';

  useEffect(() => {
    if (!user || !curriculumId) return;
    (async () => {
      const c = await getCurriculum(curriculumId);
      setCurriculum(c);
      if (!c) { setLoading(false); return; }

      const e = await getCurriculumEnrollment(user.uid, curriculumId);
      setEnrollment(e);

      // Fetch course details and enrollments
      const details: Record<string, Course> = {};
      const enrolls: Record<string, Enrollment> = {};
      await Promise.all(
        c.courses.map(async (cc) => {
          const [course, courseEnroll] = await Promise.all([
            getCourse(cc.courseId),
            getEnrollment(user.uid, cc.courseId),
          ]);
          if (course) details[cc.courseId] = course;
          if (courseEnroll) enrolls[cc.courseId] = courseEnroll;
        }),
      );
      setCourseDetails(details);
      setCourseEnrollments(enrolls);

      // Check for certificate
      if (e?.status === 'completed') {
        const cert = await getCertificateByReference(user.uid, curriculumId);
        setCertificate(cert);
      }

      setLoading(false);
    })();
  }, [user, curriculumId]);

  const handleEnroll = async () => {
    if (!user) return;
    setEnrolling(true);
    try {
      await enrollInCurriculum(user.uid, curriculumId);
      const e = await getCurriculumEnrollment(user.uid, curriculumId);
      setEnrollment(e);
    } finally {
      setEnrolling(false);
    }
  };

  const handleClaimCertificate = async () => {
    if (!user || !curriculum || !profile) return;
    const certId = await issueCertificate({
      userId: user.uid,
      userName: profile.displayName || profile.email || user.uid,
      type: 'curriculum',
      referenceId: curriculumId,
      referenceTitle: curriculum.title,
      cmeCredits: curriculum.cmeCredits,
    });
    const cert = await getCertificateByReference(user.uid, curriculumId);
    setCertificate(cert);
  };

  const isCourseUnlocked = (courseId: string, prerequisites: string[]): boolean => {
    if (!enrollment) return false;
    if (prerequisites.length === 0) return true;
    return prerequisites.every((preId) =>
      courseEnrollments[preId]?.status === 'completed',
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-pulse-slow text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!curriculum) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Learning path not found.</p>
        <Link href={`${routeBase}/curricula`} className="text-cyan-400 hover:text-cyan-300 mt-2 inline-block">
          Back to learning paths
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href={`${routeBase}/curricula`} className="hover:text-white flex items-center gap-1">
          <ArrowLeft size={14} /> Learning Paths
        </Link>
        <span>/</span>
        <span className="text-slate-300">{curriculum.title}</span>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Route size={20} className="text-emerald-400" />
              <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFFICULTY_COLORS[curriculum.difficulty]}`}>
                {DIFFICULTY_LABELS[curriculum.difficulty]}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{curriculum.title}</h1>
            <p className="text-slate-300">{curriculum.description}</p>
          </div>

          <div className="flex gap-2 shrink-0">
            {isCurator && (
              <Link
                href={`${routeBase}/curricula/${curriculumId}/edit`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white"
              >
                <Edit size={16} /> Edit
              </Link>
            )}
            {!enrollment && curriculum.status === 'published' && (
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="btn-primary flex items-center gap-2"
              >
                <GraduationCap size={16} />
                {enrolling ? 'Enrolling...' : 'Start Path'}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10 text-sm text-slate-400">
          <span className="flex items-center gap-1.5"><BookOpen size={14} /> {curriculum.courses.length} courses</span>
          <span className="flex items-center gap-1.5"><Clock size={14} /> {curriculum.estimatedHours}h</span>
          <span className="flex items-center gap-1.5"><Users size={14} /> {curriculum.enrollmentCount ?? 0} enrolled</span>
          {curriculum.cmeCredits && (
            <span className="flex items-center gap-1.5"><Award size={14} /> {curriculum.cmeCredits} CME</span>
          )}
        </div>

        {enrollment && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Your Progress</span>
              <span className="text-sm text-white font-semibold">{enrollment.percentComplete}%</span>
            </div>
            <ProgressBar percent={enrollment.percentComplete} />
            <p className="text-xs text-slate-500 mt-1">
              {enrollment.completedCourseIds.length}/{enrollment.totalCourses} required courses completed
            </p>
          </div>
        )}
      </div>

      {/* Completion / Certificate */}
      {enrollment?.status === 'completed' && (
        <div className="glass rounded-xl p-6 text-center border border-emerald-500/30">
          <Check size={48} className="mx-auto text-emerald-400 mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Learning Path Completed!</h2>
          {certificate ? (
            <Link
              href={`${routeBase}/certificates?id=${certificate.id}`}
              className="btn-primary inline-flex items-center gap-2 mt-2"
            >
              <Award size={16} /> View Certificate
            </Link>
          ) : curriculum.certificateEnabled ? (
            <button
              onClick={handleClaimCertificate}
              className="btn-primary inline-flex items-center gap-2 mt-2"
            >
              <Award size={16} /> Claim Certificate
            </button>
          ) : null}
        </div>
      )}

      {/* Course List */}
      <section>
        <h2 className="section-title mb-3">Courses in this Path</h2>
        <div className="space-y-3">
          {curriculum.courses
            .sort((a, b) => a.position - b.position)
            .map((cc, index) => {
              const course = courseDetails[cc.courseId];
              const courseEnroll = courseEnrollments[cc.courseId];
              const completed = courseEnroll?.status === 'completed';
              const unlocked = isCourseUnlocked(cc.courseId, cc.prerequisiteCourseIds);
              const inProgress = courseEnroll?.status === 'in_progress';

              return (
                <div
                  key={cc.courseId}
                  className={`glass rounded-xl p-4 flex items-center gap-4 ${
                    !enrollment ? 'opacity-70' : !unlocked ? 'opacity-50' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    completed
                      ? 'bg-emerald-500 text-white'
                      : inProgress
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white/10 text-slate-400'
                  }`}>
                    {completed ? <Check size={16} /> : !unlocked ? <Lock size={14} /> : index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">
                      {cc.courseTitle || course?.title || 'Unknown Course'}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      {course && <span>{course.estimatedHours}h</span>}
                      {!cc.isRequired && <span className="text-amber-400">Optional</span>}
                      {completed && <span className="text-emerald-400">Completed</span>}
                      {inProgress && (
                        <span className="text-indigo-400">
                          {courseEnroll.progress?.percentComplete ?? 0}% done
                        </span>
                      )}
                    </div>
                  </div>

                  {enrollment && unlocked && (
                    <Link
                      href={`${routeBase}/courses/${cc.courseId}${courseEnroll ? '/learn' : ''}`}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 hover:text-white text-sm"
                    >
                      {completed ? 'Review' : courseEnroll ? 'Continue' : 'Start'}
                      <ChevronRight size={14} />
                    </Link>
                  )}
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
