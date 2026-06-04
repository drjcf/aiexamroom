'use client';

import { routeBase } from '../config';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle, Clock, XCircle } from 'lucide-react';
import { ModuleNav } from '../context';
import { lmsTabs } from '../routes';
import { useAuth } from '../context';
import { useSessionTracker } from '../context';
import { listUserEnrollments } from '../services/enrollment.service';
import type { Enrollment, EnrollmentStatus } from '../types';
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_COLORS } from '../types';
import ProgressBar from '../components/ProgressBar';

type FilterTab = 'all' | 'active' | 'completed' | 'dropped';

export default function MyLearning() {
  const { user } = useAuth();
  useSessionTracker('lms');

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => {
    if (!user) return;
    listUserEnrollments(user.uid, undefined, 100)
      .then(setEnrollments)
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    if (filter === 'all') return enrollments;
    if (filter === 'active') return enrollments.filter((e) => e.status === 'enrolled' || e.status === 'in_progress');
    return enrollments.filter((e) => e.status === filter);
  }, [enrollments, filter]);

  const counts = useMemo(() => ({
    all: enrollments.length,
    active: enrollments.filter((e) => e.status === 'enrolled' || e.status === 'in_progress').length,
    completed: enrollments.filter((e) => e.status === 'completed').length,
    dropped: enrollments.filter((e) => e.status === 'dropped').length,
  }), [enrollments]);

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'active', label: `Active (${counts.active})` },
    { key: 'completed', label: `Completed (${counts.completed})` },
    { key: 'dropped', label: `Dropped (${counts.dropped})` },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">My Learning</h1>
      <ModuleNav tabs={lmsTabs()} />

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
              filter === tab.key
                ? 'bg-indigo-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Enrollment List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse-slow text-slate-400">Loading...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <BookOpen size={48} className="mx-auto text-slate-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {filter === 'all' ? 'No enrollments yet' : `No ${filter} courses`}
          </h3>
          <p className="text-slate-400 mb-4">Browse available courses to get started.</p>
          <Link href={`${routeBase}/courses`} className="btn-primary inline-flex items-center gap-2">
            <BookOpen size={16} /> Browse Courses
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((enrollment) => (
            <Link
              key={enrollment.id}
              href={
                enrollment.status === 'dropped'
                  ? `${routeBase}/courses/${enrollment.courseId}`
                  : `${routeBase}/courses/${enrollment.courseId}/learn`
              }
              className="glass rounded-xl p-5 flex items-center gap-4 hover:bg-white/10 transition-colors block"
            >
              {/* Status icon */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                enrollment.status === 'completed'
                  ? 'bg-emerald-500/20'
                  : enrollment.status === 'dropped'
                    ? 'bg-slate-500/20'
                    : 'bg-blue-500/20'
              }`}>
                {enrollment.status === 'completed' ? (
                  <CheckCircle size={20} className="text-emerald-400" />
                ) : enrollment.status === 'dropped' ? (
                  <XCircle size={20} className="text-slate-400" />
                ) : (
                  <BookOpen size={20} className="text-blue-400" />
                )}
              </div>

              {/* Course info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate">{enrollment.courseTitle}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span className={`px-1.5 py-0.5 rounded border ${ENROLLMENT_STATUS_COLORS[enrollment.status]}`}>
                    {ENROLLMENT_STATUS_LABELS[enrollment.status]}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {enrollment.progress?.completedLessons ?? 0}/{enrollment.progress?.totalLessons ?? 0} lessons
                  </span>
                </div>
              </div>

              {/* Progress */}
              {(enrollment.status === 'enrolled' || enrollment.status === 'in_progress') && (
                <div className="w-32 shrink-0">
                  <ProgressBar percent={enrollment.progress?.percentComplete ?? 0} />
                </div>
              )}

              {enrollment.status === 'completed' && (
                <span className="text-emerald-400 text-sm font-medium shrink-0">100%</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
