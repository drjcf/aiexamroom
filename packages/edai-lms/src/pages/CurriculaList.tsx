'use client';

import { routeBase } from '../config';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Plus, Route, BookOpen, Clock, Users } from 'lucide-react';
import { ModuleNav } from '../context';
import { lmsTabs } from '../routes';
import { useAuth } from '../context';
import { useSessionTracker } from '../context';
import { listPublishedCurricula, listCurricula } from '../services/curriculum.service';
import type { Curriculum } from '../types';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS, COURSE_STATUS_COLORS, COURSE_STATUS_LABELS } from '../types';

export default function CurriculaList() {
  const { user, role } = useAuth();
  useSessionTracker('lms');

  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const isCurator = role === 'content_curator' || role === 'admin' || role === 'superadmin';

  useEffect(() => {
    if (!user) return;
    (async () => {
      const published = await listPublishedCurricula(100);
      let drafts: Curriculum[] = [];
      if (isCurator) {
        drafts = await listCurricula({ status: 'draft', createdBy: user.uid });
      }
      const publishedIds = new Set(published.map((c) => c.id));
      setCurricula([...drafts.filter((c) => !publishedIds.has(c.id)), ...published]);
    })().finally(() => setLoading(false));
  }, [user, isCurator]);

  const filtered = useMemo(() => {
    if (!search) return curricula;
    const q = search.toLowerCase();
    return curricula.filter(
      (c) => c.title.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q),
    );
  }, [curricula, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Route size={24} className="text-emerald-400" />
          Learning Paths
        </h1>
        {isCurator && (
          <Link
            href={`${routeBase}/curricula/new`}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Create Path
          </Link>
        )}
      </div>

      <ModuleNav tabs={lmsTabs()} />

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search learning paths..."
          className="input-base pl-9 w-full"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse-slow text-slate-400">Loading...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Route size={48} className="mx-auto text-slate-500 mb-4" />
          <p className="text-slate-400">
            {search ? 'No paths match your search.' : 'No learning paths available yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((curriculum) => (
            <Link
              key={curriculum.id}
              href={`${routeBase}/curricula/${curriculum.id}`}
              className="glass rounded-xl p-5 hover:bg-white/10 transition-colors block group"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFFICULTY_COLORS[curriculum.difficulty]}`}>
                  {DIFFICULTY_LABELS[curriculum.difficulty]}
                </span>
                {curriculum.status !== 'published' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${COURSE_STATUS_COLORS[curriculum.status]}`}>
                    {COURSE_STATUS_LABELS[curriculum.status]}
                  </span>
                )}
              </div>
              <h3 className="text-white font-semibold mb-1 group-hover:text-cyan-300 transition-colors truncate">
                {curriculum.title}
              </h3>
              <p className="text-sm text-slate-400 line-clamp-2 mb-4">
                {curriculum.shortDescription || curriculum.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <BookOpen size={12} />
                  {curriculum.courses?.length ?? 0} courses
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {curriculum.estimatedHours}h
                </span>
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {curriculum.enrollmentCount ?? 0}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
