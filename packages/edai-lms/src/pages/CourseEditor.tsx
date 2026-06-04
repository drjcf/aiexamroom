'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Eye, Trash2, Plus, GripVertical,
  FileText, PlayCircle, ExternalLink, ChevronDown, ChevronUp,
  Brain, Mic, Presentation, MessageSquare, ClipboardList, BookOpen,
  Code, Layout,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import JSZip from 'jszip';
import { db, storage, routeBase } from '../config';
import type { RNNotebook, RNSource, RNSourceInsight } from '../vendor/research-notebook/types';
import { useAuth } from '../context';
import {
  createCourse, getCourse, updateCourse, publishCourse, unpublishCourse, deleteCourse,
} from '../services/course.service';
import {
  createLesson, getCourseLessons, updateLesson, deleteLesson,
} from '../services/lesson.service';
import type { Course, Lesson, DifficultyLevel, LessonType, LessonContent, RubricCriterion, Rubric } from '../types';
import MarkdownEditor from '../components/MarkdownEditor';

interface CourseEditorProps {
  courseId?: string; // undefined = create new
}

const LESSON_TYPE_OPTIONS: { value: LessonType; label: string; icon: typeof FileText }[] = [
  { value: 'content', label: 'Reading Material', icon: FileText },
  { value: 'video', label: 'Video', icon: PlayCircle },
  { value: 'external_link', label: 'External Link', icon: ExternalLink },
  { value: 'mcq_assessment', label: 'MCQ Assessment', icon: Brain },
  { value: 'oral_practice', label: 'Oral Practice', icon: Mic },
  { value: 'presentation', label: 'Presentation', icon: Presentation },
  { value: 'discussion', label: 'Discussion', icon: MessageSquare },
  { value: 'assignment', label: 'Assignment', icon: ClipboardList },
  { value: 'notebook_source', label: 'Research Notebook Source', icon: BookOpen },
  { value: 'html', label: 'HTML', icon: Code },
  { value: 'iframe', label: 'Embedded iFrame', icon: Layout },
];

// ─── HTML / ZIP Bundle Uploader ─────────────────────────────
// Supports two modes:
//   1. Single .html file — uploads as-is and returns the download URL.
//   2. Multi-file .zip bundle — extracts with JSZip, uploads each asset
//      to Storage, rewrites the HTML's relative refs to the absolute
//      tokenized Storage URLs, then uploads the HTML last and returns
//      its URL.

const MIME_BY_EXT: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  mjs: 'application/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

function guessMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

function sanitizeSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Rewrite an HTML string's relative src/href attributes to use a map
 * of relativePath → absoluteUrl. Absolute URLs, data: URIs, and #anchors
 * pass through unchanged.
 */
function rewriteHtmlRefs(
  html: string,
  htmlDir: string,
  urlMap: Map<string, string>,
): string {
  const resolve = (ref: string): string => {
    if (!ref) return ref;
    if (/^(https?:|data:|blob:|mailto:|#|\/\/)/i.test(ref)) return ref;
    // Drop fragment / query for lookup
    const [pathOnly, fragment] = ref.split('#');
    const [clean] = pathOnly.split('?');
    // Resolve relative to the HTML's directory
    let resolved = clean.startsWith('/')
      ? clean.slice(1)
      : (htmlDir ? `${htmlDir}/${clean}` : clean);
    // Normalize ./  and ../
    const parts: string[] = [];
    for (const seg of resolved.split('/')) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    resolved = parts.join('/');
    const target = urlMap.get(resolved);
    if (!target) return ref; // leave unknown refs alone
    return fragment ? `${target}#${fragment}` : target;
  };

  // Replace attribute values in common src/href attributes.
  // This is a pragmatic regex pass — not a full HTML parser — which is
  // fine for the bundles we host (static educational content).
  return html.replace(
    /\b(src|href|poster|data-src)\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (_m, attr, _quoted, dq, sq) => {
      const ref = dq ?? sq ?? '';
      const resolved = resolve(ref);
      return `${attr}="${resolved}"`;
    },
  );
}

function HtmlFileUploader({
  userId,
  onUploaded,
}: {
  userId: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (path: string, data: Blob, contentType: string): Promise<string> => {
    const ref = storageRef(storage, path);
    await uploadBytes(ref, data, { contentType });
    return getDownloadURL(ref);
  };

  const handleSingleHtml = async (file: File) => {
    setStatusText('Uploading HTML…');
    const bundleDir = `${Date.now()}-${sanitizeSegment(file.name.replace(/\.html?$/i, ''))}`;
    const path = `lms-html-modules/${userId}/${bundleDir}/${sanitizeSegment(file.name)}`;
    const url = await uploadFile(path, file, 'text/html');
    onUploaded(url);
  };

  const handleZip = async (file: File) => {
    setStatusText('Reading zip…');
    const zip = await JSZip.loadAsync(file);

    // Collect all file entries (skip directories and macOS metadata)
    const entries: Array<{ path: string; file: JSZip.JSZipObject }> = [];
    zip.forEach((relativePath, entry) => {
      if (entry.dir) return;
      if (relativePath.startsWith('__MACOSX/') || /(^|\/)\.DS_Store$/.test(relativePath)) return;
      entries.push({ path: relativePath, file: entry });
    });

    if (entries.length === 0) {
      throw new Error('Zip is empty');
    }

    // If the zip has a single top-level directory, strip it so relative
    // refs resolve properly. (e.g. "module2-anatomy/index.html" → "index.html")
    const topSegments = new Set(entries.map((e) => e.path.split('/')[0]));
    let stripPrefix = '';
    if (topSegments.size === 1) {
      const only = [...topSegments][0];
      if (entries.every((e) => e.path.startsWith(`${only}/`))) {
        stripPrefix = `${only}/`;
      }
    }

    const normalized = entries.map((e) => ({
      relPath: stripPrefix ? e.path.slice(stripPrefix.length) : e.path,
      file: e.file,
    }));

    // Find the HTML entry point: prefer index.html at root, else first .html
    const htmlEntry =
      normalized.find((e) => e.relPath.toLowerCase() === 'index.html') ??
      normalized.find((e) => /\.html?$/i.test(e.relPath));
    if (!htmlEntry) {
      throw new Error('No .html file found in zip');
    }
    const htmlDir = htmlEntry.relPath.includes('/')
      ? htmlEntry.relPath.slice(0, htmlEntry.relPath.lastIndexOf('/'))
      : '';

    // Upload non-HTML assets first and build a url map keyed by relative path
    const bundleDir = `${Date.now()}-${sanitizeSegment(file.name.replace(/\.zip$/i, ''))}`;
    const urlMap = new Map<string, string>();
    const nonHtml = normalized.filter((e) => !/\.html?$/i.test(e.relPath));
    let done = 0;
    for (const entry of nonHtml) {
      setStatusText(`Uploading assets ${++done}/${nonHtml.length}…`);
      const blob = await entry.file.async('blob');
      if (blob.size > 10 * 1024 * 1024) {
        throw new Error(`${entry.relPath} is over 10 MB`);
      }
      const contentType = guessMime(entry.relPath);
      const safePath = entry.relPath.split('/').map(sanitizeSegment).join('/');
      const storagePath = `lms-html-modules/${userId}/${bundleDir}/${safePath}`;
      const url = await uploadFile(storagePath, blob, contentType);
      urlMap.set(entry.relPath, url);
    }

    // Rewrite HTML relative refs to point at the uploaded asset URLs
    setStatusText('Processing HTML…');
    const htmlText = await htmlEntry.file.async('string');
    const rewritten = rewriteHtmlRefs(htmlText, htmlDir, urlMap);

    // Upload the rewritten HTML
    setStatusText('Uploading HTML…');
    const htmlSafePath = htmlEntry.relPath.split('/').map(sanitizeSegment).join('/');
    const htmlStoragePath = `lms-html-modules/${userId}/${bundleDir}/${htmlSafePath}`;
    const htmlBlob = new Blob([rewritten], { type: 'text/html' });
    if (htmlBlob.size > 10 * 1024 * 1024) {
      throw new Error('HTML file is over 10 MB after rewriting');
    }
    const htmlUrl = await uploadFile(htmlStoragePath, htmlBlob, 'text/html');
    onUploaded(htmlUrl);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const isHtml = /\.html?$/i.test(file.name) || file.type === 'text/html';
    const isZip = /\.zip$/i.test(file.name) || file.type === 'application/zip';
    if (!isHtml && !isZip) {
      setError('Please pick a .html or .zip file');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File must be under 20 MB');
      return;
    }

    setError(null);
    setUploading(true);
    try {
      if (isZip) {
        await handleZip(file);
      } else {
        await handleSingleHtml(file);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setStatusText('');
    }
  };

  return (
    <div>
      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 cursor-pointer border border-indigo-500/30">
        <input
          type="file"
          accept=".html,.htm,.zip,text/html,application/zip"
          onChange={handleFile}
          className="hidden"
          disabled={uploading}
        />
        {uploading ? (statusText || 'Uploading…') : 'Upload HTML or .zip'}
      </label>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

// ─── Notebook Source Picker ─────────────────────────────────

function NotebookSourcePicker({
  value,
  onChange,
  userId,
}: {
  value: { rnNotebookId?: string; rnSourceId?: string; rnInsightIds?: string[]; rnShowSourceText?: boolean };
  onChange: (updates: { rnNotebookId?: string; rnSourceId?: string; rnInsightIds?: string[]; rnShowSourceText?: boolean }) => void;
  userId: string;
}) {
  const [notebooks, setNotebooks] = useState<RNNotebook[]>([]);
  const [sources, setSources] = useState<RNSource[]>([]);
  const [insights, setInsights] = useState<RNSourceInsight[]>([]);
  const [loading, setLoading] = useState(false);

  // Load notebooks owned by the current user
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'rn_notebooks'), where('createdBy', '==', userId)),
        );
        setNotebooks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RNNotebook)));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // Load sources for the selected notebook
  useEffect(() => {
    if (!value.rnNotebookId) { setSources([]); return; }
    (async () => {
      const snap = await getDocs(
        query(collection(db, 'rn_sources'), where('notebookIds', 'array-contains', value.rnNotebookId)),
      );
      setSources(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RNSource)));
    })();
  }, [value.rnNotebookId]);

  // Load insights for the selected source
  useEffect(() => {
    if (!value.rnSourceId) { setInsights([]); return; }
    (async () => {
      const snap = await getDocs(
        query(collection(db, 'rn_source_insights'), where('sourceId', '==', value.rnSourceId)),
      );
      setInsights(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RNSourceInsight)));
    })();
  }, [value.rnSourceId]);

  const toggleInsight = (id: string) => {
    const current = value.rnInsightIds ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange({ ...value, rnInsightIds: next });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-slate-400 block mb-1">Notebook</label>
        <select
          value={value.rnNotebookId ?? ''}
          onChange={(e) => onChange({ rnNotebookId: e.target.value || undefined, rnSourceId: undefined, rnInsightIds: [] })}
          className="input-base w-full text-sm"
          disabled={loading}
        >
          <option value="">— Select a notebook —</option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>{nb.name}</option>
          ))}
        </select>
      </div>

      {value.rnNotebookId && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">Source</label>
          <select
            value={value.rnSourceId ?? ''}
            onChange={(e) => onChange({ ...value, rnSourceId: e.target.value || undefined, rnInsightIds: [] })}
            className="input-base w-full text-sm"
          >
            <option value="">— Select a source —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}{s.status !== 'ready' ? ` (${s.status})` : ''}
              </option>
            ))}
          </select>
          {sources.length === 0 && (
            <p className="text-xs text-slate-500 mt-1">No sources in this notebook yet.</p>
          )}
        </div>
      )}

      {value.rnSourceId && insights.length > 0 && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">
            Insights to display <span className="text-slate-500">(unchecked = show all)</span>
          </label>
          <div className="space-y-1 max-h-48 overflow-y-auto rounded border border-white/10 p-2">
            {insights.map((i) => (
              <label key={i.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.rnInsightIds?.includes(i.id!) ?? false}
                  onChange={() => i.id && toggleInsight(i.id)}
                  className="rounded border-white/20"
                />
                <span className="truncate">
                  {i.transformationName}
                  <span className="text-slate-500 ml-1">({i.outputType.replace(/_/g, ' ')})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {value.rnSourceId && (
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={value.rnShowSourceText ?? true}
            onChange={(e) => onChange({ ...value, rnShowSourceText: e.target.checked })}
            className="rounded border-white/20"
          />
          Show source text preview above insights
        </label>
      )}
    </div>
  );
}

// ─── Assignment Editor (rubric builder) ─────────────────────

function AssignmentEditor({
  lesson,
  onUpdate,
}: {
  lesson: Lesson;
  onUpdate: (updates: Partial<Pick<Lesson, 'content' | 'completionCriteria'>>) => void;
}) {
  const content = lesson.content ?? {};
  const rubric: Rubric = content.rubric ?? { criteria: [], totalPoints: 0 };

  const addCriterion = () => {
    const newCriterion: RubricCriterion = {
      id: `c_${Date.now()}`,
      name: '',
      description: '',
      maxPoints: 10,
      levels: [
        { label: 'Excellent', points: 10, description: '' },
        { label: 'Good', points: 7, description: '' },
        { label: 'Needs Improvement', points: 4, description: '' },
        { label: 'Unsatisfactory', points: 0, description: '' },
      ],
    };
    const updated = [...rubric.criteria, newCriterion];
    const total = updated.reduce((s, c) => s + c.maxPoints, 0);
    onUpdate({
      content: { ...content, rubric: { criteria: updated, totalPoints: total } },
      completionCriteria: { type: 'manual' as const },
    });
  };

  const updateCriterion = (index: number, patch: Partial<RubricCriterion>) => {
    const updated = rubric.criteria.map((c, i) => i === index ? { ...c, ...patch } : c);
    const total = updated.reduce((s, c) => s + c.maxPoints, 0);
    onUpdate({ content: { ...content, rubric: { criteria: updated, totalPoints: total } } });
  };

  const removeCriterion = (index: number) => {
    const updated = rubric.criteria.filter((_, i) => i !== index);
    const total = updated.reduce((s, c) => s + c.maxPoints, 0);
    onUpdate({ content: { ...content, rubric: { criteria: updated, totalPoints: total } } });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-slate-400 block mb-1">Assignment Prompt</label>
        <MarkdownEditor
          value={content.assignmentPrompt ?? ''}
          onChange={(val) => onUpdate({
            content: { ...content, assignmentPrompt: val },
            completionCriteria: { type: 'manual' as const },
          })}
          rows={6}
          placeholder="Describe the assignment, expectations, and deliverables…"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Assignment Type</label>
          <select
            value={content.assignmentType ?? 'text'}
            onChange={(e) => onUpdate({
              content: { ...content, assignmentType: e.target.value as 'text' | 'case_study' },
            })}
            className="input-base w-full text-sm"
          >
            <option value="text">Written Response</option>
            <option value="case_study">Case Study Analysis</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Max Submissions</label>
          <input
            type="number"
            value={content.maxSubmissions ?? 3}
            onChange={(e) => onUpdate({
              content: { ...content, maxSubmissions: Number(e.target.value) },
            })}
            min={1}
            max={10}
            className="input-base w-full text-sm"
          />
        </div>
      </div>

      {/* Rubric Builder */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-slate-400 font-semibold">
            Rubric ({rubric.totalPoints} points total)
          </label>
          <button
            onClick={addCriterion}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
          >
            <Plus size={12} /> Add Criterion
          </button>
        </div>

        <div className="space-y-2">
          {rubric.criteria.map((criterion, idx) => (
            <div key={criterion.id} className="bg-white/5 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-[1fr_80px_auto] gap-2 items-start">
                <input
                  type="text"
                  value={criterion.name}
                  onChange={(e) => updateCriterion(idx, { name: e.target.value })}
                  placeholder="Criterion name"
                  className="input-base text-sm"
                />
                <input
                  type="number"
                  value={criterion.maxPoints}
                  onChange={(e) => updateCriterion(idx, { maxPoints: Number(e.target.value) })}
                  min={1}
                  className="input-base text-sm"
                />
                <button
                  onClick={() => removeCriterion(idx)}
                  className="p-1.5 rounded text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <input
                type="text"
                value={criterion.description}
                onChange={(e) => updateCriterion(idx, { description: e.target.value })}
                placeholder="Description (optional)"
                className="input-base w-full text-xs"
              />
              {/* Level labels */}
              <div className="text-xs text-slate-500 space-y-1">
                {criterion.levels.map((level, li) => (
                  <div key={li} className="flex items-center gap-2">
                    <input
                      type="number"
                      value={level.points}
                      onChange={(e) => {
                        const levels = [...criterion.levels];
                        levels[li] = { ...levels[li], points: Number(e.target.value) };
                        updateCriterion(idx, { levels });
                      }}
                      className="input-base w-14 text-xs"
                      min={0}
                    />
                    <input
                      type="text"
                      value={level.label}
                      onChange={(e) => {
                        const levels = [...criterion.levels];
                        levels[li] = { ...levels[li], label: e.target.value };
                        updateCriterion(idx, { levels });
                      }}
                      className="input-base flex-1 text-xs"
                      placeholder="Level label"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {rubric.criteria.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-3">
              No rubric criteria yet. Add criteria to define grading standards.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CourseEditor({ courseId }: CourseEditorProps) {
  const { user } = useAuth();
  const router = useRouter();

  const isNew = !courseId;

  // Course fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('intermediate');
  const [estimatedHours, setEstimatedHours] = useState(1);
  const [selfPaced, setSelfPaced] = useState(true);
  const [passingScore, setPassingScore] = useState(70);
  const [enforceSequential, setEnforceSequential] = useState(true);
  const [allowRetakes, setAllowRetakes] = useState(true);
  const [cmeCredits, setCmeCredits] = useState<number | undefined>();

  // Lessons
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);

  // UI
  const [loading, setLoading] = useState(!!courseId);
  const [saving, setSaving] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);

  // Load existing course
  useEffect(() => {
    if (!courseId || !user) return;
    Promise.all([
      getCourse(courseId),
      getCourseLessons(courseId),
    ]).then(([c, l]) => {
      if (c) {
        setCourse(c);
        setTitle(c.title);
        setDescription(c.description);
        setShortDescription(c.shortDescription);
        setCategory(c.category);
        setDifficulty(c.difficulty);
        setEstimatedHours(c.estimatedHours);
        setSelfPaced(c.settings?.selfPaced ?? true);
        setPassingScore(c.settings?.passingScore ?? 70);
        setEnforceSequential(c.settings?.enforceSequentialProgress ?? true);
        setAllowRetakes(c.settings?.allowRetakes ?? true);
        setCmeCredits(c.settings?.cmeCredits);
      }
      setLessons(l);
    }).finally(() => setLoading(false));
  }, [courseId, user]);

  const handleSave = useCallback(async () => {
    if (!user || !title.trim()) return;
    setSaving(true);

    try {
      if (isNew) {
        const id = await createCourse({
          title: title.trim(),
          description: description.trim(),
          shortDescription: shortDescription.trim(),
          category: category.trim(),
          difficulty,
          estimatedHours,
          settings: {
            selfPaced,
            passingScore,
            enforceSequentialProgress: enforceSequential,
            allowRetakes,
            certificateEnabled: false,
            ...(cmeCredits ? { cmeCredits } : {}),
          },
          createdBy: user.uid,
        });
        router.push(`${routeBase}/courses/${id}/edit`);
      } else if (courseId) {
        await updateCourse(courseId, {
          title: title.trim(),
          description: description.trim(),
          shortDescription: shortDescription.trim(),
          category: category.trim(),
          difficulty,
          estimatedHours,
          settings: {
            selfPaced,
            passingScore,
            enforceSequentialProgress: enforceSequential,
            allowRetakes,
            certificateEnabled: false,
            ...(cmeCredits ? { cmeCredits } : {}),
          },
        });
      }
    } finally {
      setSaving(false);
    }
  }, [
    user, title, description, shortDescription, category, difficulty,
    estimatedHours, selfPaced, passingScore, enforceSequential, allowRetakes,
    cmeCredits, isNew, courseId, router,
  ]);

  const handlePublish = async () => {
    if (!courseId) return;
    if (course?.status === 'published') {
      await unpublishCourse(courseId);
    } else {
      await publishCourse(courseId);
    }
    const updated = await getCourse(courseId);
    setCourse(updated);
  };

  const handleDeleteCourse = async () => {
    if (!courseId) return;
    const ok = window.confirm(
      `Delete "${course?.title || 'this course'}"?\n\n` +
      `This will remove the course and all ${lessons.length} lesson(s).\n` +
      `Enrollments and student progress will be kept for audit.\n\n` +
      `This cannot be undone.`,
    );
    if (!ok) return;
    try {
      await deleteCourse(courseId);
      router.push(`${routeBase}/courses`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete course');
    }
  };

  const handleAddLesson = async () => {
    if (!courseId || !user) return;
    const id = await createLesson({
      courseId,
      title: `Lesson ${lessons.length + 1}`,
      description: '',
      type: 'content',
      content: {},
      estimatedMinutes: 15,
      createdBy: user.uid,
    });
    const updated = await getCourseLessons(courseId);
    setLessons(updated);
    setExpandedLesson(id);
  };

  const handleUpdateLesson = async (
    lessonId: string,
    updates: Partial<Pick<Lesson, 'title' | 'description' | 'type' | 'content' | 'completionCriteria' | 'estimatedMinutes' | 'isOptional'>>,
  ) => {
    await updateLesson(lessonId, updates);
    setLessons((prev) => prev.map((l) => (l.id === lessonId ? { ...l, ...updates } : l)));
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!courseId) return;
    await deleteLesson(lessonId, courseId);
    setLessons((prev) => prev.filter((l) => l.id !== lessonId));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-pulse-slow text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href={`${routeBase}/courses`} className="hover:text-white flex items-center gap-1">
            <ArrowLeft size={14} /> Courses
          </Link>
          <span>/</span>
          <span className="text-slate-300">{isNew ? 'New Course' : 'Edit Course'}</span>
        </div>
        <div className="flex items-center gap-2">
          {courseId && (
            <>
              <Link
                href={`${routeBase}/courses/${courseId}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white text-sm"
              >
                <Eye size={14} /> Preview
              </Link>
              <Link
                href={`${routeBase}/courses/${courseId}/grading`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white text-sm"
              >
                <ClipboardList size={14} /> Grade
              </Link>
              <button
                onClick={handlePublish}
                className={`px-3 py-2 rounded-lg text-sm ${
                  course?.status === 'published'
                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                }`}
              >
                {course?.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
              <button
                onClick={handleDeleteCourse}
                title="Delete course"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-sm"
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Course Details */}
      <div className="glass rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Course Details</h2>

        <div>
          <label className="text-sm text-slate-400 block mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Cardiovascular Pharmacology"
            className="input-base w-full"
          />
        </div>

        <div>
          <label className="text-sm text-slate-400 block mb-1">Short Description</label>
          <input
            type="text"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="Brief summary for course cards"
            className="input-base w-full"
          />
        </div>

        <div>
          <label className="text-sm text-slate-400 block mb-1">Full Description</label>
          <MarkdownEditor
            value={description}
            onChange={setDescription}
            rows={4}
            placeholder="Detailed course description…"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-slate-400 block mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Cardiology"
              className="input-base w-full"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
              className="input-base w-full"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Est. Hours</label>
            <input
              type="number"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(Number(e.target.value))}
              min={0.5}
              step={0.5}
              className="input-base w-full"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">CME Credits</label>
            <input
              type="number"
              value={cmeCredits ?? ''}
              onChange={(e) => setCmeCredits(e.target.value ? Number(e.target.value) : undefined)}
              min={0}
              step={0.5}
              placeholder="Optional"
              className="input-base w-full"
            />
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="glass rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={selfPaced}
              onChange={(e) => setSelfPaced(e.target.checked)}
              className="rounded border-white/20"
            />
            Self-paced
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={enforceSequential}
              onChange={(e) => setEnforceSequential(e.target.checked)}
              className="rounded border-white/20"
            />
            Sequential progress
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={allowRetakes}
              onChange={(e) => setAllowRetakes(e.target.checked)}
              className="rounded border-white/20"
            />
            Allow retakes
          </label>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Passing Score (%)</label>
            <input
              type="number"
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
              min={0}
              max={100}
              className="input-base w-full"
            />
          </div>
        </div>
      </div>

      {/* Lessons (only for existing courses) */}
      {courseId && (
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Lessons ({lessons.length})
            </h2>
            <button
              onClick={handleAddLesson}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-sm"
            >
              <Plus size={14} /> Add Lesson
            </button>
          </div>

          <div className="space-y-2">
            {lessons.map((lesson, index) => {
              const isExpanded = expandedLesson === lesson.id;

              return (
                <div key={lesson.id} className="bg-white/5 rounded-lg border border-white/5">
                  {/* Collapsed row */}
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                  >
                    <GripVertical size={14} className="text-slate-500" />
                    <span className="text-sm text-slate-400 w-6">{index + 1}.</span>
                    <span className="flex-1 text-white text-sm truncate">{lesson.title}</span>
                    <span className="text-xs text-slate-500">{lesson.type}</span>
                    <span className="text-xs text-slate-500">{lesson.estimatedMinutes}m</span>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </div>

                  {/* Expanded editor */}
                  {isExpanded && (
                    <div className="p-4 pt-0 space-y-3 border-t border-white/5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Title</label>
                          <input
                            type="text"
                            value={lesson.title}
                            onChange={(e) => handleUpdateLesson(lesson.id, { title: e.target.value })}
                            className="input-base w-full text-sm"
                          />
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-slate-400 block mb-1">Type</label>
                            <select
                              value={lesson.type}
                              onChange={(e) => handleUpdateLesson(lesson.id, { type: e.target.value as LessonType })}
                              className="input-base w-full text-sm"
                            >
                              {LESSON_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-20">
                            <label className="text-xs text-slate-400 block mb-1">Minutes</label>
                            <input
                              type="number"
                              value={lesson.estimatedMinutes}
                              onChange={(e) => handleUpdateLesson(lesson.id, { estimatedMinutes: Number(e.target.value) })}
                              min={1}
                              className="input-base w-full text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Description</label>
                        <input
                          type="text"
                          value={lesson.description ?? ''}
                          onChange={(e) => handleUpdateLesson(lesson.id, { description: e.target.value })}
                          placeholder="Optional lesson description"
                          className="input-base w-full text-sm"
                        />
                      </div>

                      {/* Content fields by type */}
                      {lesson.type === 'content' && (
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Content</label>
                          <MarkdownEditor
                            value={lesson.content?.body ?? ''}
                            onChange={(val) => handleUpdateLesson(lesson.id, {
                              content: { ...lesson.content, body: val },
                            })}
                            rows={10}
                            placeholder="Enter lesson content…"
                          />
                        </div>
                      )}

                      {lesson.type === 'video' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Video URL (embed)</label>
                            <input
                              type="url"
                              value={lesson.content?.videoUrl ?? ''}
                              onChange={(e) => handleUpdateLesson(lesson.id, {
                                content: { ...lesson.content, videoUrl: e.target.value },
                              })}
                              placeholder="https://youtube.com/embed/..."
                              className="input-base w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Duration (min)</label>
                            <input
                              type="number"
                              value={lesson.content?.videoDurationMinutes ?? ''}
                              onChange={(e) => handleUpdateLesson(lesson.id, {
                                content: { ...lesson.content, videoDurationMinutes: Number(e.target.value) },
                              })}
                              className="input-base w-full text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {lesson.type === 'external_link' && (
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">External URL</label>
                          <input
                            type="url"
                            value={lesson.content?.externalUrl ?? ''}
                            onChange={(e) => handleUpdateLesson(lesson.id, {
                              content: { ...lesson.content, externalUrl: e.target.value },
                            })}
                            placeholder="https://..."
                            className="input-base w-full text-sm"
                          />
                        </div>
                      )}

                      {lesson.type === 'mcq_assessment' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">MCQ Set ID</label>
                            <input
                              type="text"
                              value={lesson.content?.mcqSetId ?? ''}
                              onChange={(e) => handleUpdateLesson(lesson.id, {
                                content: { ...lesson.content, mcqSetId: e.target.value },
                                completionCriteria: { type: 'score' as const, minScore: lesson.content?.mcqPassingScore ?? 70 },
                              })}
                              placeholder="Paste MCQ set document ID"
                              className="input-base w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Passing Score (%)</label>
                            <input
                              type="number"
                              value={lesson.content?.mcqPassingScore ?? 70}
                              onChange={(e) => handleUpdateLesson(lesson.id, {
                                content: { ...lesson.content, mcqPassingScore: Number(e.target.value) },
                                completionCriteria: { type: 'score' as const, minScore: Number(e.target.value) },
                              })}
                              min={0}
                              max={100}
                              className="input-base w-full text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {lesson.type === 'oral_practice' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Oral Topic</label>
                            <input
                              type="text"
                              value={lesson.content?.oralTopic ?? ''}
                              onChange={(e) => handleUpdateLesson(lesson.id, {
                                content: { ...lesson.content, oralTopic: e.target.value },
                              })}
                              placeholder="e.g., Cardiac Surgery"
                              className="input-base w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Difficulty</label>
                            <select
                              value={lesson.content?.oralDifficulty ?? 'intermediate'}
                              onChange={(e) => handleUpdateLesson(lesson.id, {
                                content: { ...lesson.content, oralDifficulty: e.target.value },
                              })}
                              className="input-base w-full text-sm"
                            >
                              <option value="beginner">Beginner</option>
                              <option value="intermediate">Intermediate</option>
                              <option value="advanced">Advanced</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {lesson.type === 'presentation' && (
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Presentation ID</label>
                          <input
                            type="text"
                            value={lesson.content?.presentationId ?? ''}
                            onChange={(e) => handleUpdateLesson(lesson.id, {
                              content: { ...lesson.content, presentationId: e.target.value },
                            })}
                            placeholder="Paste presentation document ID"
                            className="input-base w-full text-sm"
                          />
                        </div>
                      )}

                      {lesson.type === 'discussion' && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Discussion Group ID</label>
                            <input
                              type="text"
                              value={lesson.content?.discussionGroupId ?? ''}
                              onChange={(e) => handleUpdateLesson(lesson.id, {
                                content: { ...lesson.content, discussionGroupId: e.target.value },
                              })}
                              placeholder="Paste discussion group document ID"
                              className="input-base w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Discussion Prompt</label>
                            <MarkdownEditor
                              value={lesson.content?.discussionPrompt ?? ''}
                              onChange={(val) => handleUpdateLesson(lesson.id, {
                                content: { ...lesson.content, discussionPrompt: val },
                              })}
                              rows={4}
                              placeholder="Prompt or question for discussion…"
                              minimal
                            />
                          </div>
                        </div>
                      )}

                      {lesson.type === 'assignment' && (
                        <AssignmentEditor
                          lesson={lesson}
                          onUpdate={(updates) => handleUpdateLesson(lesson.id, updates)}
                        />
                      )}

                      {lesson.type === 'html' && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">HTML Body</label>
                            <textarea
                              value={lesson.content?.htmlBody ?? ''}
                              onChange={(e) => handleUpdateLesson(lesson.id, {
                                content: { ...lesson.content, htmlBody: e.target.value },
                              })}
                              rows={10}
                              placeholder="<h2>Lesson title</h2><script>function goUnit(n){...}</script><button onclick='goUnit(1)'>Go</button>"
                              className="input-base w-full text-sm resize-y font-mono"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              Rendered inside a sandboxed iframe — scripts run, CSS is isolated.
                              Paste full HTML documents or fragments. Only curators you trust should edit this.
                            </p>
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Height (px)</label>
                            <input
                              type="number"
                              value={lesson.content?.iframeHeight ?? 800}
                              min={200}
                              max={4000}
                              onChange={(e) => handleUpdateLesson(lesson.id, {
                                content: { ...lesson.content, iframeHeight: parseInt(e.target.value) || 800 },
                              })}
                              className="input-base w-full text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {lesson.type === 'iframe' && (
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-slate-400">Embed URL</label>
                              {user && (
                                <HtmlFileUploader
                                  userId={user.uid}
                                  onUploaded={(url) => handleUpdateLesson(lesson.id, {
                                    content: { ...lesson.content, iframeUrl: url },
                                  })}
                                />
                              )}
                            </div>
                            <input
                              type="url"
                              value={lesson.content?.iframeUrl ?? ''}
                              onChange={(e) => handleUpdateLesson(lesson.id, {
                                content: { ...lesson.content, iframeUrl: e.target.value },
                              })}
                              placeholder="https://example.com/embed or upload an HTML file above"
                              className="input-base w-full text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-slate-400 block mb-1">Height (px)</label>
                              <input
                                type="number"
                                value={lesson.content?.iframeHeight ?? 600}
                                min={200}
                                max={2000}
                                onChange={(e) => handleUpdateLesson(lesson.id, {
                                  content: { ...lesson.content, iframeHeight: parseInt(e.target.value) || 600 },
                                })}
                                className="input-base w-full text-sm"
                              />
                            </div>
                            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer mt-5">
                              <input
                                type="checkbox"
                                checked={lesson.content?.iframeAllowFullscreen ?? true}
                                onChange={(e) => handleUpdateLesson(lesson.id, {
                                  content: { ...lesson.content, iframeAllowFullscreen: e.target.checked },
                                })}
                                className="rounded border-white/20"
                              />
                              Allow fullscreen
                            </label>
                          </div>
                        </div>
                      )}

                      {lesson.type === 'notebook_source' && user && (
                        <NotebookSourcePicker
                          userId={user.uid}
                          value={{
                            rnNotebookId: lesson.content?.rnNotebookId,
                            rnSourceId: lesson.content?.rnSourceId,
                            rnInsightIds: lesson.content?.rnInsightIds,
                            rnShowSourceText: lesson.content?.rnShowSourceText,
                          }}
                          onChange={(updates) => {
                            const merged: LessonContent = { ...lesson.content, ...updates };
                            // Firestore rejects undefined — strip them
                            (Object.keys(merged) as Array<keyof LessonContent>).forEach((k) => {
                              if (merged[k] === undefined) delete merged[k];
                            });
                            handleUpdateLesson(lesson.id, { content: merged });
                          }}
                        />
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lesson.isOptional}
                            onChange={(e) => handleUpdateLesson(lesson.id, { isOptional: e.target.checked })}
                            className="rounded border-white/20"
                          />
                          Optional lesson
                        </label>
                        <button
                          onClick={() => handleDeleteLesson(lesson.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {lessons.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                No lessons yet. Click &quot;Add Lesson&quot; to get started.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
