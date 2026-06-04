'use client';

import { routeBase } from '../config';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Eye, Plus, Trash2, GripVertical,
  ChevronDown, ChevronUp, Route,
} from 'lucide-react';
import { useAuth } from '../context';
import {
  createCurriculum, getCurriculum, updateCurriculum,
  publishCurriculum, unpublishCurriculum,
} from '../services/curriculum.service';
import { listPublishedCourses } from '../services/course.service';
import type { Curriculum, CurriculumCourse, Course, DifficultyLevel } from '../types';

interface CurriculumEditorProps {
  curriculumId?: string;
}

export default function CurriculumEditor({ curriculumId }: CurriculumEditorProps) {
  const { user } = useAuth();
  const router = useRouter();
  const isNew = !curriculumId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('intermediate');
  const [certificateEnabled, setCertificateEnabled] = useState(false);
  const [cmeCredits, setCmeCredits] = useState<number | undefined>();

  const [courses, setCourses] = useState<CurriculumCourse[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [showCourseSelector, setShowCourseSelector] = useState(false);

  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loading, setLoading] = useState(!!curriculumId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listPublishedCourses(200).then(setAvailableCourses);
  }, []);

  useEffect(() => {
    if (!curriculumId) return;
    getCurriculum(curriculumId).then((c) => {
      if (c) {
        setCurriculum(c);
        setTitle(c.title);
        setDescription(c.description);
        setShortDescription(c.shortDescription);
        setCategory(c.category);
        setDifficulty(c.difficulty);
        setCertificateEnabled(c.certificateEnabled);
        setCmeCredits(c.cmeCredits);
        setCourses(c.courses);
      }
      setLoading(false);
    });
  }, [curriculumId]);

  const handleSave = useCallback(async () => {
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      const estimatedHours = courses.reduce((sum, cc) => {
        const c = availableCourses.find((ac) => ac.id === cc.courseId);
        return sum + (c?.estimatedHours ?? 0);
      }, 0);

      if (isNew) {
        const id = await createCurriculum({
          title: title.trim(),
          description: description.trim(),
          shortDescription: shortDescription.trim(),
          category: category.trim(),
          difficulty,
          certificateEnabled,
          ...(cmeCredits ? { cmeCredits } : {}),
          createdBy: user.uid,
        });
        // Save courses separately since createCurriculum doesn't include them
        if (courses.length > 0) {
          await updateCurriculum(id, { courses, estimatedHours });
        }
        router.push(`${routeBase}/curricula/${id}/edit`);
      } else if (curriculumId) {
        await updateCurriculum(curriculumId, {
          title: title.trim(),
          description: description.trim(),
          shortDescription: shortDescription.trim(),
          category: category.trim(),
          difficulty,
          certificateEnabled,
          ...(cmeCredits ? { cmeCredits } : {}),
          courses,
          estimatedHours,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [
    user, title, description, shortDescription, category, difficulty,
    certificateEnabled, cmeCredits, courses, availableCourses, isNew, curriculumId, router,
  ]);

  const handlePublish = async () => {
    if (!curriculumId) return;
    if (curriculum?.status === 'published') {
      await unpublishCurriculum(curriculumId);
    } else {
      await publishCurriculum(curriculumId);
    }
    const updated = await getCurriculum(curriculumId);
    setCurriculum(updated);
  };

  const addCourse = (course: Course) => {
    if (courses.some((c) => c.courseId === course.id)) return;
    setCourses([...courses, {
      courseId: course.id,
      courseTitle: course.title,
      position: courses.length,
      isRequired: true,
      prerequisiteCourseIds: [],
    }]);
    setShowCourseSelector(false);
  };

  const removeCourse = (courseId: string) => {
    const updated = courses
      .filter((c) => c.courseId !== courseId)
      .map((c, i) => ({
        ...c,
        position: i,
        prerequisiteCourseIds: c.prerequisiteCourseIds.filter((id) => id !== courseId),
      }));
    setCourses(updated);
  };

  const updateCourseField = (courseId: string, field: string, value: unknown) => {
    setCourses((prev) => prev.map((c) =>
      c.courseId === courseId ? { ...c, [field]: value } : c,
    ));
  };

  const moveCourse = (index: number, direction: -1 | 1) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= courses.length) return;
    const updated = [...courses];
    [updated[index], updated[newIdx]] = [updated[newIdx], updated[index]];
    setCourses(updated.map((c, i) => ({ ...c, position: i })));
  };

  const unusedCourses = availableCourses.filter(
    (ac) => !courses.some((c) => c.courseId === ac.id),
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-pulse-slow text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href={`${routeBase}/curricula`} className="hover:text-white flex items-center gap-1">
            <ArrowLeft size={14} /> Learning Paths
          </Link>
          <span>/</span>
          <span className="text-slate-300">{isNew ? 'New Path' : 'Edit Path'}</span>
        </div>
        <div className="flex items-center gap-2">
          {curriculumId && (
            <>
              <Link
                href={`${routeBase}/curricula/${curriculumId}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white text-sm"
              >
                <Eye size={14} /> Preview
              </Link>
              <button
                onClick={handlePublish}
                className={`px-3 py-2 rounded-lg text-sm ${
                  curriculum?.status === 'published'
                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                }`}
              >
                {curriculum?.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="glass rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Route size={18} className="text-emerald-400" /> Path Details
        </h2>
        <div>
          <label className="text-sm text-slate-400 block mb-1">Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Cardiology Fellowship Track" className="input-base w-full" />
        </div>
        <div>
          <label className="text-sm text-slate-400 block mb-1">Short Description</label>
          <input type="text" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)}
            placeholder="Brief summary" className="input-base w-full" />
        </div>
        <div>
          <label className="text-sm text-slate-400 block mb-1">Full Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            rows={3} placeholder="Detailed description..." className="input-base w-full resize-y" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-slate-400 block mb-1">Category</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Cardiology" className="input-base w-full" />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
              className="input-base w-full">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">CME Credits</label>
            <input type="number" value={cmeCredits ?? ''} min={0} step={0.5}
              onChange={(e) => setCmeCredits(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Optional" className="input-base w-full" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer pt-6">
            <input type="checkbox" checked={certificateEnabled}
              onChange={(e) => setCertificateEnabled(e.target.checked)} className="rounded border-white/20" />
            Certificate
          </label>
        </div>
      </div>

      {/* Courses */}
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Courses ({courses.length})</h2>
          <button
            onClick={() => setShowCourseSelector(!showCourseSelector)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-sm"
          >
            <Plus size={14} /> Add Course
          </button>
        </div>

        {/* Course Selector */}
        {showCourseSelector && (
          <div className="bg-white/5 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
            {unusedCourses.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">No more published courses available.</p>
            ) : unusedCourses.map((course) => (
              <button
                key={course.id}
                onClick={() => addCourse(course)}
                className="w-full text-left px-3 py-2 rounded text-sm text-slate-300 hover:bg-white/10 hover:text-white"
              >
                {course.title} <span className="text-xs text-slate-500 ml-2">{course.category}</span>
              </button>
            ))}
          </div>
        )}

        {/* Course List */}
        <div className="space-y-2">
          {courses.map((cc, index) => (
            <div key={cc.courseId} className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveCourse(index, -1)} disabled={index === 0}
                    className="text-slate-500 hover:text-white disabled:opacity-20">
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={() => moveCourse(index, 1)} disabled={index === courses.length - 1}
                    className="text-slate-500 hover:text-white disabled:opacity-20">
                    <ChevronDown size={12} />
                  </button>
                </div>
                <GripVertical size={14} className="text-slate-500" />
                <span className="text-sm text-slate-400 w-6">{index + 1}.</span>
                <span className="flex-1 text-white text-sm truncate">{cc.courseTitle}</span>

                <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={cc.isRequired}
                    onChange={(e) => updateCourseField(cc.courseId, 'isRequired', e.target.checked)}
                    className="rounded border-white/20" />
                  Required
                </label>

                <button onClick={() => removeCourse(cc.courseId)}
                  className="p-1 rounded text-red-400 hover:bg-red-500/10">
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Prerequisites selector */}
              {index > 0 && (
                <div className="mt-2 ml-12">
                  <label className="text-xs text-slate-500 block mb-1">Prerequisites</label>
                  <div className="flex gap-1 flex-wrap">
                    {courses.slice(0, index).map((prev) => {
                      const isPrereq = cc.prerequisiteCourseIds.includes(prev.courseId);
                      return (
                        <button
                          key={prev.courseId}
                          onClick={() => {
                            const prereqs = isPrereq
                              ? cc.prerequisiteCourseIds.filter((id) => id !== prev.courseId)
                              : [...cc.prerequisiteCourseIds, prev.courseId];
                            updateCourseField(cc.courseId, 'prerequisiteCourseIds', prereqs);
                          }}
                          className={`px-2 py-0.5 rounded text-xs ${
                            isPrereq
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : 'bg-white/5 text-slate-500 hover:text-white'
                          }`}
                        >
                          {prev.courseTitle}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {courses.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-4">
              No courses added. Click &quot;Add Course&quot; to build the learning path.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
