'use client';

import { routeBase } from '../config';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, Clock,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { useAuth } from '../context';
import { getCourse } from '../services/course.service';
import { issueCertificate } from '../services/certificate.service';
import { getCourseLessons } from '../services/lesson.service';
import {
  getEnrollment, enrollInCourse,
  getEnrollmentLessonProgress, startLesson, completeLesson, completeLessonWithScore,
} from '../services/enrollment.service';
import type { Course, Lesson, Enrollment, LessonProgress } from '../types';
import { LESSON_TYPE_LABELS } from '../types';
import ProgressBar from '../components/ProgressBar';
import LessonRenderer from '../components/LessonRenderer';

interface CoursePlayerProps {
  courseId: string;
}

const LESSON_SIDEBAR_STORAGE_KEY = 'edai:lms:course-player-sidebar-collapsed';

export default function CoursePlayer({ courseId }: CoursePlayerProps) {
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Restore collapsed state on mount
  useEffect(() => {
    try {
      if (window.localStorage.getItem(LESSON_SIDEBAR_STORAGE_KEY) === '1') {
        setSidebarCollapsed(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Persist collapsed state
  useEffect(() => {
    try {
      window.localStorage.setItem(LESSON_SIDEBAR_STORAGE_KEY, sidebarCollapsed ? '1' : '0');
    } catch { /* ignore */ }
  }, [sidebarCollapsed]);
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgress>>({});
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const activeLesson = lessons[activeLessonIndex] ?? null;

  // Course completion: true once the enrollment is complete (or 100% of lessons done).
  const courseComplete =
    enrollment?.status === 'completed' ||
    (enrollment?.progress?.percentComplete ?? 0) >= 100;

  // Load course data
  useEffect(() => {
    if (!user || !courseId) return;
    (async () => {
      const [c, l] = await Promise.all([
        getCourse(courseId),
        getCourseLessons(courseId),
      ]);
      setCourse(c);
      setLessons(l);

      let e = await getEnrollment(user.uid, courseId);
      if (!e && c) {
        // Auto-enroll if accessing player directly
        await enrollInCourse(user.uid, courseId);
        e = await getEnrollment(user.uid, courseId);
      }
      setEnrollment(e);

      if (e) {
        const progress = await getEnrollmentLessonProgress(e.id, user.uid);
        const map: Record<string, LessonProgress> = {};
        for (const p of progress) map[p.lessonId] = p;
        setProgressMap(map);

        // Resume from last incomplete lesson
        if (e.progress?.currentLessonId) {
          const idx = l.findIndex((les) => les.id === e.progress.currentLessonId);
          if (idx >= 0) setActiveLessonIndex(idx);
        } else {
          // Find first incomplete lesson
          const firstIncomplete = l.findIndex((les) => !map[les.id] || map[les.id].status !== 'completed');
          if (firstIncomplete >= 0) setActiveLessonIndex(firstIncomplete);
        }
      }

      setLoading(false);
    })();
  }, [user, courseId]);

  // Track lesson start
  useEffect(() => {
    if (!enrollment || !activeLesson || !user) return;
    startTimeRef.current = Date.now();
    startLesson(enrollment.id, user.uid, courseId, activeLesson.id);
  }, [enrollment, activeLesson, user, courseId]);

  const handleComplete = useCallback(async () => {
    if (!enrollment || !activeLesson) return;
    setCompleting(true);

    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 60000);
    await completeLesson(enrollment.id, activeLesson.id, timeSpent);

    // Update local state
    setProgressMap((prev) => ({
      ...prev,
      [activeLesson.id]: {
        ...prev[activeLesson.id],
        status: 'completed',
        lessonId: activeLesson.id,
      } as LessonProgress,
    }));

    // Refresh enrollment to get updated progress
    if (user) {
      const e = await getEnrollment(user.uid, courseId);
      if (e) {
        setEnrollment(e);
        // Auto-issue certificate on course completion
        if (e.status === 'completed' && course?.settings?.certificateEnabled) {
          issueCertificate({
            userId: user.uid,
            userName: user.displayName || user.email || user.uid,
            type: 'course',
            referenceId: courseId,
            referenceTitle: course.title,
            score: e.grades?.overallScore,
            cmeCredits: course.settings?.cmeCredits,
          }).catch(() => {}); // Non-blocking
        }
      }
    }

    // Auto-advance to next lesson
    if (activeLessonIndex < lessons.length - 1) {
      setActiveLessonIndex(activeLessonIndex + 1);
    }

    setCompleting(false);
  }, [enrollment, activeLesson, activeLessonIndex, lessons.length, user, courseId, course]);

  const handleAssessmentComplete = useCallback(async (
    score: number,
    passed: boolean,
    moduleRef: { moduleId: string; referenceId: string },
  ) => {
    if (!enrollment || !activeLesson) return;

    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 60000);
    await completeLessonWithScore(
      enrollment.id,
      activeLesson.id,
      score,
      passed,
      { ...moduleRef, completedInModule: true },
      timeSpent,
    );

    // Update local state
    setProgressMap((prev) => ({
      ...prev,
      [activeLesson.id]: {
        ...prev[activeLesson.id],
        status: 'completed',
        lessonId: activeLesson.id,
        score,
        passed,
      } as LessonProgress,
    }));

    // Refresh enrollment
    if (user) {
      const e = await getEnrollment(user.uid, courseId);
      if (e) setEnrollment(e);
    }
  }, [enrollment, activeLesson, user, courseId]);

  const isAssessmentType = useCallback((type: string) => {
    return type === 'mcq_assessment' || type === 'assignment';
  }, []);

  const isLessonLocked = useCallback((index: number) => {
    if (!course?.settings?.enforceSequentialProgress) return false;
    if (index === 0) return false;
    // Check if all previous required lessons are completed
    for (let i = 0; i < index; i++) {
      const lesson = lessons[i];
      if (lesson.isOptional) continue;
      const progress = progressMap[lesson.id];
      if (!progress || progress.status !== 'completed') return true;
    }
    return false;
  }, [course, lessons, progressMap]);

  const isLessonCompleted = useCallback((lessonId: string) => {
    return progressMap[lessonId]?.status === 'completed';
  }, [progressMap]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-pulse-slow text-slate-400">Loading course...</div>
      </div>
    );
  }

  if (!course || !enrollment) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Course not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <aside
        className={`relative border-r border-white/10 bg-slate-900/50 overflow-y-auto shrink-0 transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-14' : 'w-72'
        }`}
      >
        <button
          type="button"
          onClick={() => setSidebarCollapsed((c) => !c)}
          title={sidebarCollapsed ? 'Expand lesson list' : 'Collapse lesson list'}
          aria-label={sidebarCollapsed ? 'Expand lesson list' : 'Collapse lesson list'}
          className="absolute top-2 right-1 z-10 p-1 rounded text-slate-400 hover:bg-white/10 hover:text-white transition"
        >
          {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>

        {!sidebarCollapsed && (
          <div className="p-4 border-b border-white/10">
            <Link
              href={`${routeBase}/courses/${courseId}`}
              className="text-sm text-slate-400 hover:text-white flex items-center gap-1 mb-2"
            >
              <ArrowLeft size={14} /> Back to Course
            </Link>
            <h2 className="text-sm font-semibold text-white truncate">{course.title}</h2>
            <div className="mt-2">
              <ProgressBar percent={enrollment.progress?.percentComplete ?? 0} />
              <p className="text-xs text-slate-400 mt-1">
                {enrollment.progress?.completedLessons ?? 0}/{enrollment.progress?.totalLessons ?? 0} lessons
              </p>
            </div>
          </div>
        )}

        {sidebarCollapsed && (
          <div className="pt-10 pb-2 flex flex-col items-center border-b border-white/10">
            <Link
              href={`${routeBase}/courses/${courseId}`}
              title="Back to Course"
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft size={16} />
            </Link>
          </div>
        )}

        <nav className={sidebarCollapsed ? 'p-1 pt-2' : 'p-2'}>
          {lessons.map((lesson, index) => {
            const completed = isLessonCompleted(lesson.id);
            const locked = isLessonLocked(index);
            const active = index === activeLessonIndex;

            return (
              <button
                key={lesson.id}
                onClick={() => !locked && setActiveLessonIndex(index)}
                disabled={locked}
                title={sidebarCollapsed ? `${index + 1}. ${lesson.title}` : undefined}
                className={`w-full text-left rounded-lg mb-1 flex items-center transition-colors ${
                  sidebarCollapsed ? 'p-2 justify-center' : 'p-3 gap-3'
                } ${
                  active
                    ? 'bg-indigo-500/20 text-white'
                    : locked
                      ? 'text-slate-600 cursor-not-allowed'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  completed
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/10 text-slate-400'
                }`}>
                  {completed ? <Check size={12} /> : index + 1}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{lesson.title}</p>
                    <p className="text-xs text-slate-500">{lesson.estimatedMinutes} min</p>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {activeLesson ? (
          <div className={`${
            activeLesson.type === 'iframe' || activeLesson.type === 'html' || activeLesson.type === 'notebook_source'
              ? 'max-w-none p-4'
              : 'max-w-3xl mx-auto p-8'
          }`}>
            {/* Course completion: take-home resources entry point */}
            {courseComplete && (
              <div className="glass rounded-xl p-5 mb-6 border-l-4" style={{ borderLeftColor: 'var(--brand-teal)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Check size={18} className="text-emerald-400" />
                  <h2 className="text-lg font-semibold text-white">You&rsquo;ve completed {course.title}</h2>
                </div>
                <p className="text-sm text-slate-400 mb-4">Take the patient and clinician materials with you.</p>
                <div className="flex flex-wrap gap-3">
                  {/* Static file in public/, not an app route, so a plain anchor (not next/link). */}
                  <a href="/resources.html" className="btn-primary">Get your take-home resources &rarr;</a>
                  {course.settings?.certificateEnabled && (
                    <Link
                      href={`${routeBase}/certificates`}
                      className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      View certificate
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Lesson Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <span>Lesson {activeLessonIndex + 1} of {lessons.length}</span>
                <span className="text-slate-600">|</span>
                <Clock size={12} />
                <span>{activeLesson.estimatedMinutes} min</span>
              </div>
              <h1 className="text-2xl font-bold text-white">{activeLesson.title}</h1>
              {activeLesson.description && (
                <p className="text-slate-400 mt-1">{activeLesson.description}</p>
              )}
            </div>

            {/* Lesson Type Badge */}
            {activeLesson.type !== 'content' && (
              <div className="mb-4">
                <span className="text-xs px-2 py-0.5 rounded-full border bg-white/5 text-slate-300 border-white/10">
                  {LESSON_TYPE_LABELS[activeLesson.type]}
                </span>
              </div>
            )}

            {/* Lesson Content */}
            <div
              className={`mb-6 ${
                activeLesson.type === 'iframe' || activeLesson.type === 'html' || activeLesson.type === 'notebook_source'
                  ? ''
                  : 'glass rounded-xl p-6'
              }`}
            >
              <LessonRenderer
                lesson={activeLesson}
                progress={progressMap[activeLesson.id] ?? null}
                enrollmentId={enrollment.id}
                userId={user?.uid}
                courseId={courseId}
                onAssessmentComplete={handleAssessmentComplete}
              />
            </div>

            {/* Score display for assessment lessons */}
            {progressMap[activeLesson.id]?.score !== undefined && (
              <div className="glass rounded-lg p-3 mb-4 flex items-center justify-center gap-2 text-sm">
                <span className="text-slate-400">Score:</span>
                <span className={progressMap[activeLesson.id].score! >= (activeLesson.content?.mcqPassingScore ?? 70) ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {progressMap[activeLesson.id].score}%
                </span>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveLessonIndex(Math.max(0, activeLessonIndex - 1))}
                disabled={activeLessonIndex === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <div className="flex items-center gap-3">
                {isLessonCompleted(activeLesson.id) ? (
                  <span className="flex items-center gap-2 text-emerald-400 text-sm">
                    <Check size={16} /> Completed
                  </span>
                ) : !isAssessmentType(activeLesson.type) ? (
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Check size={16} />
                    {completing ? 'Saving...' : 'Mark Complete'}
                  </button>
                ) : null}
              </div>

              <button
                onClick={() => setActiveLessonIndex(Math.min(lessons.length - 1, activeLessonIndex + 1))}
                disabled={activeLessonIndex === lessons.length - 1}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            Select a lesson to begin.
          </div>
        )}
      </main>
    </div>
  );
}