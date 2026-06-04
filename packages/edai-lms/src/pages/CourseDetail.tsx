'use client';

import { routeBase } from '../config';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Clock, BarChart3, Users, BookOpen,
  CheckCircle, Lock, Edit, GraduationCap,
} from 'lucide-react';
import { useAuth } from '../context';
import { getCourse } from '../services/course.service';
import { getCourseLessons } from '../services/lesson.service';
import { enrollInCourse, getEnrollment } from '../services/enrollment.service';
import type { Course, Lesson, Enrollment } from '../types';
import {
  DIFFICULTY_LABELS, DIFFICULTY_COLORS,
  COURSE_STATUS_LABELS, COURSE_STATUS_COLORS,
  LESSON_TYPE_LABELS,
} from '../types';

interface CourseDetailProps {
  courseId: string;
}

export default function CourseDetail({ courseId }: CourseDetailProps) {
  const { user, role } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  const isCurator = role === 'content_curator' || role === 'admin' || role === 'superadmin';
  const isInstructor = course?.instructorIds?.includes(user?.uid ?? '') ?? false;
  const canEdit = isCurator || isInstructor;

  useEffect(() => {
    if (!user || !courseId) return;
    Promise.all([
      getCourse(courseId),
      getCourseLessons(courseId),
      getEnrollment(user.uid, courseId),
    ]).then(([c, l, e]) => {
      setCourse(c);
      setLessons(l);
      setEnrollment(e);
    }).finally(() => setLoading(false));
  }, [user, courseId]);

  const handleEnroll = async () => {
    if (!user || !course) return;
    setEnrolling(true);
    try {
      await enrollInCourse(user.uid, courseId);
      router.push(`${routeBase}/courses/${courseId}/learn`);
    } catch (err) {
      console.error('Enrollment failed:', err);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-pulse-slow text-slate-400">Loading course...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Course not found.</p>
        <Link href={`${routeBase}/courses`} className="text-cyan-400 hover:text-cyan-300 mt-2 inline-block">
          Back to courses
        </Link>
      </div>
    );
  }

  const requiredLessons = lessons.filter((l) => !l.isOptional);
  const totalMinutes = lessons.reduce((sum, l) => sum + (l.estimatedMinutes ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href={`${routeBase}/courses`} className="hover:text-white flex items-center gap-1">
          <ArrowLeft size={14} /> Courses
        </Link>
        <span>/</span>
        <span className="text-slate-300">{course.title}</span>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFFICULTY_COLORS[course.difficulty]}`}>
                {DIFFICULTY_LABELS[course.difficulty]}
              </span>
              {course.status !== 'published' && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${COURSE_STATUS_COLORS[course.status]}`}>
                  {COURSE_STATUS_LABELS[course.status]}
                </span>
              )}
              {course.category && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-white/5 text-slate-300 border-white/10">
                  {course.category}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{course.title}</h1>
            <p className="text-slate-300">{course.description}</p>
          </div>

          <div className="flex gap-2 shrink-0">
            {canEdit && (
              <Link
                href={`${routeBase}/courses/${courseId}/edit`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Edit size={16} />
                Edit
              </Link>
            )}
            {enrollment ? (
              <Link
                href={`${routeBase}/courses/${courseId}/learn`}
                className="btn-primary flex items-center gap-2"
              >
                {enrollment.status === 'completed' ? (
                  <><CheckCircle size={16} /> Review Course</>
                ) : (
                  <><BookOpen size={16} /> Continue Learning</>
                )}
              </Link>
            ) : course.status === 'published' ? (
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="btn-primary flex items-center gap-2"
              >
                <GraduationCap size={16} />
                {enrolling ? 'Enrolling...' : 'Enroll Now'}
              </button>
            ) : null}
          </div>
        </div>

        {/* Meta Row */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10 text-sm text-slate-400">
          <div className="flex items-center gap-1.5">
            <BookOpen size={14} />
            {requiredLessons.length} lesson{requiredLessons.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            {course.estimatedHours}h estimated
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={14} />
            {course.enrollmentCount ?? 0} enrolled
          </div>
          {course.settings?.cmeCredits && (
            <div className="flex items-center gap-1.5">
              <BarChart3 size={14} />
              {course.settings.cmeCredits} CME credits
            </div>
          )}
        </div>
      </div>

      {/* Lesson List */}
      <section>
        <h2 className="section-title mb-3">Course Content</h2>
        <div className="space-y-2">
          {lessons.map((lesson, index) => (
            <div
              key={lesson.id}
              className="glass rounded-lg p-4 flex items-center gap-4"
            >
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm text-slate-300 shrink-0">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate">{lesson.title}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span>{LESSON_TYPE_LABELS[lesson.type]}</span>
                  <span>{lesson.estimatedMinutes} min</span>
                  {lesson.isOptional && <span className="text-amber-400">Optional</span>}
                </div>
              </div>
              {!enrollment && (
                <Lock size={14} className="text-slate-500 shrink-0" />
              )}
            </div>
          ))}
          {lessons.length === 0 && (
            <div className="glass rounded-lg p-8 text-center text-slate-400">
              No lessons added yet.
            </div>
          )}
        </div>
      </section>

      {/* Course Settings Info */}
      {course.settings && (
        <section>
          <h2 className="section-title mb-3">Course Details</h2>
          <div className="glass rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Format</span>
              <p className="text-white">{course.settings.selfPaced ? 'Self-paced' : 'Scheduled'}</p>
            </div>
            <div>
              <span className="text-slate-400">Passing Score</span>
              <p className="text-white">{course.settings.passingScore}%</p>
            </div>
            <div>
              <span className="text-slate-400">Sequential</span>
              <p className="text-white">{course.settings.enforceSequentialProgress ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className="text-slate-400">Retakes</span>
              <p className="text-white">
                {course.settings.allowRetakes
                  ? course.settings.maxRetakes ? `Up to ${course.settings.maxRetakes}` : 'Unlimited'
                  : 'Not allowed'}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
