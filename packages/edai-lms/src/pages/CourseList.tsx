'use client';

import { routeBase } from '../config';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Plus, Filter } from 'lucide-react';
import { ModuleNav } from '../context';
import { lmsTabs } from '../routes';
import { useAuth } from '../context';
import { useSessionTracker } from '../context';
import { listPublishedCourses, listCourses } from '../services/course.service';
import type { Course } from '../types';
import CourseCard from '../components/CourseCard';

export default function CourseList() {
  const { user, role } = useAuth();
  useSessionTracker('lms');

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDrafts, setShowDrafts] = useState(false);

  const isCurator = role === 'content_curator' || role === 'admin' || role === 'superadmin';

  useEffect(() => {
    if (!user) return;
    const fetchCourses = async () => {
      setLoading(true);
      const published = await listPublishedCourses(100);
      let drafts: Course[] = [];
      if (isCurator && showDrafts) {
        drafts = await listCourses({ status: 'draft', createdBy: user.uid });
      }
      setCourses([...drafts, ...published]);
      setLoading(false);
    };
    fetchCourses();
  }, [user, isCurator, showDrafts]);

  const filtered = useMemo(() => {
    if (!search) return courses;
    const q = search.toLowerCase();
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [courses, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Courses</h1>
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

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses..."
            className="input-base pl-9 w-full"
          />
        </div>
        {isCurator && (
          <button
            onClick={() => setShowDrafts(!showDrafts)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              showDrafts ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Filter size={14} />
            {showDrafts ? 'Showing Drafts' : 'Show My Drafts'}
          </button>
        )}
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse-slow text-slate-400">Loading courses...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <p className="text-slate-400">
            {search ? 'No courses match your search.' : 'No courses available yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} showStatus={isCurator} />
          ))}
        </div>
      )}
    </div>
  );
}
