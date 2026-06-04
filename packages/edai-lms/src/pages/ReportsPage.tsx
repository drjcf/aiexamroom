'use client';

import { useEffect, useState, useMemo } from 'react';
import { BarChart3, Users, BookOpen, TrendingUp } from 'lucide-react';
import { ModuleNav } from '../context';
import { lmsTabs } from '../routes';
import { useAuth } from '../context';
import { useSessionTracker } from '../context';
import { listCourses } from '../services/course.service';
import { listCourseEnrollments } from '../services/enrollment.service';
import type { Course, Enrollment } from '../types';

interface CourseReport {
  course: Course;
  enrollments: Enrollment[];
  completionRate: number;
  avgProgress: number;
}

export default function ReportsPage() {
  const { user, role } = useAuth();
  useSessionTracker('lms');

  const [reports, setReports] = useState<CourseReport[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = role === 'admin' || role === 'superadmin';

  useEffect(() => {
    if (!user) return;
    (async () => {
      const courses = isAdmin
        ? await listCourses({ status: 'published' })
        : await listCourses({ status: 'published', createdBy: user.uid });

      const courseReports = await Promise.all(
        courses.map(async (course) => {
          const enrollments = await listCourseEnrollments(course.id);
          const completed = enrollments.filter((e) => e.status === 'completed').length;
          const completionRate = enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0;
          const avgProgress = enrollments.length > 0
            ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress?.percentComplete ?? 0), 0) / enrollments.length)
            : 0;
          return { course, enrollments, completionRate, avgProgress };
        }),
      );
      setReports(courseReports);
    })().finally(() => setLoading(false));
  }, [user, isAdmin]);

  const totalEnrollments = useMemo(
    () => reports.reduce((sum, r) => sum + r.enrollments.length, 0),
    [reports],
  );
  const totalCompletions = useMemo(
    () => reports.reduce((sum, r) => sum + r.enrollments.filter((e) => e.status === 'completed').length, 0),
    [reports],
  );
  const overallCompletionRate = totalEnrollments > 0 ? Math.round((totalCompletions / totalEnrollments) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Reports</h1>
      <ModuleNav tabs={lmsTabs()} />

      {!isAdmin && role !== 'content_curator' ? (
        <div className="glass rounded-xl p-12 text-center">
          <BarChart3 size={48} className="mx-auto text-slate-500 mb-4" />
          <p className="text-slate-400">Reports are available to instructors and administrators.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse-slow text-slate-400">Loading reports...</div>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-3">
                <BookOpen size={20} className="text-emerald-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{reports.length}</p>
                  <p className="text-xs text-slate-400">Published Courses</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Users size={20} className="text-cyan-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{totalEnrollments}</p>
                  <p className="text-xs text-slate-400">Total Enrollments</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-3">
                <TrendingUp size={20} className="text-amber-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{totalCompletions}</p>
                  <p className="text-xs text-slate-400">Completions</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-3">
                <BarChart3 size={20} className="text-indigo-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{overallCompletionRate}%</p>
                  <p className="text-xs text-slate-400">Completion Rate</p>
                </div>
              </div>
            </div>
          </div>

          {/* Per-Course Table */}
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-slate-400 font-medium">Course</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Enrolled</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Completed</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Completion Rate</th>
                  <th className="text-center p-4 text-slate-400 font-medium">Avg Progress</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.course.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4 text-white">{report.course.title}</td>
                    <td className="p-4 text-center text-slate-300">{report.enrollments.length}</td>
                    <td className="p-4 text-center text-slate-300">
                      {report.enrollments.filter((e) => e.status === 'completed').length}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`${report.completionRate >= 70 ? 'text-emerald-400' : report.completionRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                        {report.completionRate}%
                      </span>
                    </td>
                    <td className="p-4 text-center text-slate-300">{report.avgProgress}%</td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No published courses yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
