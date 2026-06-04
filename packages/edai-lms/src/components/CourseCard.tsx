'use client';

import { routeBase } from '../config';
import Link from 'next/link';
import { BookOpen, Clock, Users } from 'lucide-react';
import type { Course } from '../types';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS, COURSE_STATUS_COLORS, COURSE_STATUS_LABELS } from '../types';

interface CourseCardProps {
  course: Course;
  showStatus?: boolean;
}

export default function CourseCard({ course, showStatus }: CourseCardProps) {
  return (
    <Link
      href={`${routeBase}/courses/${course.id}`}
      className="glass rounded-xl p-5 hover:bg-white/10 transition-colors block group"
    >
      {/* Tags */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFFICULTY_COLORS[course.difficulty]}`}>
          {DIFFICULTY_LABELS[course.difficulty]}
        </span>
        {showStatus && course.status !== 'published' && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ${COURSE_STATUS_COLORS[course.status]}`}>
            {COURSE_STATUS_LABELS[course.status]}
          </span>
        )}
        {course.category && (
          <span className="text-xs text-slate-500">{course.category}</span>
        )}
      </div>

      {/* Title & Description */}
      <h3 className="text-white font-semibold mb-1 group-hover:text-cyan-300 transition-colors truncate">
        {course.title}
      </h3>
      <p className="text-sm text-slate-400 line-clamp-2 mb-4">
        {course.shortDescription || course.description}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <BookOpen size={12} />
          {course.lessonOrder?.length ?? 0} lessons
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {course.estimatedHours}h
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} />
          {course.enrollmentCount ?? 0}
        </span>
      </div>
    </Link>
  );
}
