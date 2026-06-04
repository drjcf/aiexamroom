'use client';

import { routeBase } from '../config';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { GraduationCap, BookOpen, Clock, TrendingUp, ChevronRight, Plus } from 'lucide-react';
import { ModuleNav } from '../context';
import { lmsTabs } from '../routes';
import { useAuth } from '../context';
import { useSessionTracker } from '../context';
import { listUserEnrollments } from '../services/enrollment.service';
import { listPublishedCourses, listCourses } from '../services/course.service';
import type { Enrollment, Course } from '../types';
import CourseCard from '../components/CourseCard';
import ProgressBar from '../components/ProgressBar';

export default function LMSDashboard() {
  const { user, role } = useAuth();
  useSessionTracker('lms');

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const isCurator = role === 'content_curator' || role === 'admin' || role === 'superadmin';

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [e, published] = await Promise.all([
        listUserEnrollments(user.uid, undefined, 10),
        listPublishedCourses(6),
      ]);
      // Curators also see their own draft courses
      let allCourses = published;
      if (isCurator) {
        const drafts = await listCourses({ status: 'draft', createdBy: user.uid }, 6);
        const publishedIds = new Set(published.map((c) => c.id));
        allCourses = [...drafts.filter((c) => !publishedIds.has(c.id)), ...published];
      }
      setEnrollments(e);
      setCourses(allCourses);
    })().finally(() => setLoading(false));
  }, [user, isCurator]);

  const activeEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === 'in_progress' || e.status === 'enrolled'),
    [enrollments],
  );

  const completedCount = useMemo(
    () => enrollments.filter((e) => e.status === 'completed').length,
    [enrollments],
  );

  const totalHours = useMemo(
    () => enrollments.reduce((sum, e) => {
      const lessons = e.progress?.completedLessons ?? 0;
      return sum + lessons * 0.5; // rough estimate
    }, 0),
    [enrollments],
  );

  const enrolledCourseIds = useMemo(
    () => new Set(enrollments.map((e) => e.courseId)),
    [enrollments],
  );

  const recommendedCourses = useMemo(
    () => courses.filter((c) => !enrolledCourseIds.has(c.id)).slice(0, 3),
    [courses, enrolledCourseIds],
  );

  if (loading) {
    return (
      <div className="p-6">
        <ModuleNav tabs={lmsTabs()} className="mb-6" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse-slow text-slate-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500">
            <GraduationCap size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Learning Management</h1>
            <p className="text-sm text-slate-400">Structured courses and learning paths</p>
          </div>
        </div>
        {isCurator && (
          <Link
            href={`${routeBase}/courses/new`}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Create Course
          </Link>
        )}
      </div>

      <ModuleNav tabs={lmsTabs()} />

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <BookOpen size={20} className="text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-white">{activeEnrollments.length}</p>
              <p className="text-xs text-slate-400">Active Courses</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <TrendingUp size={20} className="text-cyan-400" />
            <div>
              <p className="text-2xl font-bold text-white">{completedCount}</p>
              <p className="text-xs text-slate-400">Completed</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-white">{totalHours.toFixed(1)}</p>
              <p className="text-xs text-slate-400">Hours Learned</p>
            </div>
          </div>
        </div>
      </div>

      {/* Continue Learning */}
      {activeEnrollments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Continue Learning</h2>
            <Link href={`${routeBase}/my-learning`} className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {activeEnrollments.slice(0, 3).map((enrollment) => (
              <Link
                key={enrollment.id}
                href={`${routeBase}/courses/${enrollment.courseId}/learn`}
                className="glass rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors block"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{enrollment.courseTitle}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {enrollment.progress?.completedLessons ?? 0} of {enrollment.progress?.totalLessons ?? 0} lessons completed
                  </p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="w-32">
                    <ProgressBar percent={enrollment.progress?.percentComplete ?? 0} />
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recommended Courses */}
      {recommendedCourses.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Recommended Courses</h2>
            <Link href={`${routeBase}/courses`} className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              Browse all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendedCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {activeEnrollments.length === 0 && recommendedCourses.length === 0 && (
        <div className="glass rounded-xl p-12 text-center">
          <GraduationCap size={48} className="mx-auto text-slate-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No courses yet</h3>
          <p className="text-slate-400 mb-4">
            {isCurator
              ? 'Create your first course to get started.'
              : 'Browse available courses to begin learning.'}
          </p>
          <Link
            href={isCurator ? `${routeBase}/courses/new` : `${routeBase}/courses`}
            className="btn-primary inline-flex items-center gap-2"
          >
            {isCurator ? <><Plus size={16} /> Create Course</> : <><BookOpen size={16} /> Browse Courses</>}
          </Link>
        </div>
      )}
    </div>
  );
}
