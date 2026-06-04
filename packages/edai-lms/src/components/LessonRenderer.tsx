'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ExternalLink, FileText, PlayCircle, Brain, Mic, Presentation, MessageSquare,
  CheckCircle, XCircle, ArrowRight, ClipboardList, Send, Save, Star,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Lesson, LessonProgress, Submission, RubricCriterion } from '../types';
import { SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_COLORS } from '../types';
import {
  listUserLessonSubmissions, createSubmission, updateSubmissionContent, submitDraft,
} from '../services/assignment.service';
import NotebookSourceRenderer from './NotebookSourceRenderer';

// ─── MCQ Assessment Renderer ─────────────────────────────────

function MCQAssessmentRenderer({
  lesson,
  progress,
  onComplete,
}: {
  lesson: Lesson;
  progress: LessonProgress | null;
  onComplete: (score: number, passed: boolean, moduleRef: { moduleId: string; referenceId: string }) => void;
}) {
  const mcqSetId = lesson.content?.mcqSetId;
  const passingScore = lesson.content?.mcqPassingScore ?? 70;
  const [mcqSet, setMcqSet] = useState<{ title: string; questionCount: number } | null>(null);
  const [questions, setQuestions] = useState<Array<{
    id: string; question: string; options: Array<{ id: string; text: string; isCorrect: boolean }>; explanation: string;
  }>>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!mcqSetId) return;
    (async () => {
      const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../config');

      const setSnap = await getDoc(doc(db, 'mcq_sets', mcqSetId));
      if (setSnap.exists()) {
        const data = setSnap.data();
        setMcqSet({ title: data.title, questionCount: data.questionCount });
      }

      const q = query(collection(db, 'mcq_questions'), where('setId', '==', mcqSetId));
      const snap = await getDocs(q);
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as typeof questions[0])));
    })();
  }, [mcqSetId]);

  const handleSubmit = useCallback(() => {
    let correct = 0;
    for (const q of questions) {
      const selectedId = answers[q.id];
      const correctOption = q.options.find((o) => o.isCorrect);
      if (correctOption && selectedId === correctOption.id) correct++;
    }
    const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    setScore(pct);
    setSubmitted(true);
    const passed = pct >= passingScore;
    onComplete(pct, passed, { moduleId: 'mcq', referenceId: mcqSetId ?? '' });
  }, [questions, answers, passingScore, onComplete, mcqSetId]);

  if (!mcqSetId) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Brain size={32} className="mx-auto mb-4" />
        <p>No MCQ set has been linked to this lesson.</p>
      </div>
    );
  }

  if (progress?.status === 'completed' && progress.score !== undefined) {
    return (
      <div className="text-center py-8">
        <CheckCircle size={48} className="mx-auto text-emerald-400 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Assessment Completed</h3>
        <p className="text-slate-300">
          Score: <span className={progress.score >= passingScore ? 'text-emerald-400' : 'text-red-400'}>{progress.score}%</span>
          {' '}(passing: {passingScore}%)
        </p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <div className="animate-pulse-slow">Loading questions...</div>
      </div>
    );
  }

  if (submitted) {
    const passed = score >= passingScore;
    return (
      <div className="text-center py-8">
        {passed ? (
          <CheckCircle size={48} className="mx-auto text-emerald-400 mb-4" />
        ) : (
          <XCircle size={48} className="mx-auto text-red-400 mb-4" />
        )}
        <h3 className="text-xl font-bold text-white mb-2">
          {passed ? 'Passed!' : 'Not Passed'}
        </h3>
        <p className="text-slate-300 mb-4">
          Score: <span className={passed ? 'text-emerald-400' : 'text-red-400'}>{score}%</span>
          {' '}(passing: {passingScore}%)
        </p>
      </div>
    );
  }

  const q = questions[currentQ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 text-sm text-slate-400">
        <span>{mcqSet?.title ?? 'MCQ Assessment'}</span>
        <span>Question {currentQ + 1} of {questions.length}</span>
      </div>

      <div className="mb-6">
        <p className="text-white text-lg mb-4">{q.question}</p>
        <div className="space-y-2">
          {q.options.map((option) => (
            <button
              key={option.id}
              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: option.id }))}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                answers[q.id] === option.id
                  ? 'border-indigo-500 bg-indigo-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {option.text}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
          className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white disabled:opacity-30 text-sm"
        >
          Previous
        </button>
        {currentQ === questions.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < questions.length}
            className="btn-primary flex items-center gap-2"
          >
            Submit Assessment
          </button>
        ) : (
          <button
            onClick={() => setCurrentQ(currentQ + 1)}
            className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white text-sm flex items-center gap-1"
          >
            Next <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Oral Practice Renderer ──────────────────────────────────

function OralPracticeRenderer({ lesson }: { lesson: Lesson }) {
  const topic = lesson.content?.oralTopic ?? lesson.title;
  const difficulty = lesson.content?.oralDifficulty ?? 'intermediate';

  return (
    <div className="text-center py-8">
      <Mic size={48} className="mx-auto text-amber-400 mb-4" />
      <h3 className="text-xl font-bold text-white mb-2">Oral Practice Session</h3>
      <p className="text-slate-300 mb-4">
        Topic: <span className="text-white">{topic}</span> | Difficulty: <span className="text-white capitalize">{difficulty}</span>
      </p>
      <p className="text-sm text-slate-400 mb-6">
        Start an oral exam simulation session in the Orals module. Your score will be recorded here when complete.
      </p>
      <Link
        href="/hub/modules/orals/session"
        className="btn-primary inline-flex items-center gap-2"
      >
        <Mic size={16} />
        Start Oral Session
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}

// ─── Presentation Renderer ───────────────────────────────────

function PresentationRenderer({ lesson }: { lesson: Lesson }) {
  const presentationId = lesson.content?.presentationId;
  const [presentation, setPresentation] = useState<{ title: string; slides: Array<{ title: string; bullets: string[]; speakerNotes: string }> } | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!presentationId) return;
    (async () => {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../config');
      const snap = await getDoc(doc(db, 'presentations', presentationId));
      if (snap.exists()) {
        const data = snap.data();
        setPresentation({ title: data.title, slides: data.slides ?? [] });
      }
    })();
  }, [presentationId]);

  if (!presentationId) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Presentation size={32} className="mx-auto mb-4" />
        <p>No presentation has been linked to this lesson.</p>
      </div>
    );
  }

  if (!presentation) {
    return <div className="text-center py-8 animate-pulse-slow text-slate-400">Loading presentation...</div>;
  }

  const slide = presentation.slides[currentSlide];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 text-sm text-slate-400">
        <span>{presentation.title}</span>
        <span>Slide {currentSlide + 1} of {presentation.slides.length}</span>
      </div>

      {slide && (
        <div className="glass rounded-xl p-8 mb-4 min-h-[300px]">
          <h3 className="text-xl font-bold text-white mb-4">{slide.title}</h3>
          <ul className="space-y-2">
            {slide.bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-200">
                <span className="text-cyan-400 mt-1">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          {slide.speakerNotes && (
            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-xs text-slate-500 mb-1">Speaker Notes</p>
              <p className="text-sm text-slate-400">{slide.speakerNotes}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          disabled={currentSlide === 0}
          className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white disabled:opacity-30 text-sm"
        >
          Previous Slide
        </button>
        <button
          onClick={() => setCurrentSlide(Math.min(presentation.slides.length - 1, currentSlide + 1))}
          disabled={currentSlide === presentation.slides.length - 1}
          className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white disabled:opacity-30 text-sm"
        >
          Next Slide
        </button>
      </div>
    </div>
  );
}

// ─── Discussion Renderer ─────────────────────────────────────

function DiscussionRenderer({ lesson }: { lesson: Lesson }) {
  const groupId = lesson.content?.discussionGroupId;
  const prompt = lesson.content?.discussionPrompt;

  return (
    <div className="text-center py-8">
      <MessageSquare size={48} className="mx-auto text-cyan-400 mb-4" />
      <h3 className="text-xl font-bold text-white mb-2">Discussion Activity</h3>
      {prompt && (
        <div className="glass rounded-xl p-4 mb-6 text-left max-w-lg mx-auto">
          <p className="text-xs text-slate-500 mb-1">Discussion Prompt</p>
          <p className="text-slate-200">{prompt}</p>
        </div>
      )}
      {groupId ? (
        <Link
          href={`/hub/modules/discussions/${groupId}`}
          className="btn-primary inline-flex items-center gap-2"
        >
          <MessageSquare size={16} />
          Open Discussion
          <ArrowRight size={14} />
        </Link>
      ) : (
        <p className="text-slate-400">No discussion group has been linked to this lesson.</p>
      )}
    </div>
  );
}

// ─── Content Renderer (plain text / markdown) ────────────────

// Recurring lesson labels -> branded callouts. Host customization (see globals.css).
const CALLOUTS: { test: RegExp; cls: string; label: string }[] = [
  { test: /^what ai got right:?$/i, cls: 'callout-success', label: 'What AI got right' },
  { test: /^what ai missed:?$/i, cls: 'callout-danger', label: 'What AI missed' },
  { test: /^what ai told (her|him|them|the patient):?$/i, cls: 'callout-info', label: 'What AI told them' },
  { test: /^teaching moment:?$/i, cls: 'callout-teal', label: 'Teaching moment' },
  { test: /^your exam findings:?$/i, cls: 'callout-amber', label: 'Your exam findings' },
  { test: /^outcome:?$/i, cls: 'callout-outcome', label: 'Outcome' },
];

function bareLabel(line: string) {
  return line.replace(/^[#>\s*_]+/, '').replace(/[*_:\s]+$/, '').trim();
}

function segmentBody(body: string) {
  const out: { type: 'plain' | 'callout'; cls?: string; label?: string; text: string }[] = [];
  let cur: { type: 'plain' | 'callout'; cls?: string; label?: string; lines: string[] } = { type: 'plain', lines: [] };
  const flush = () => { if (cur.lines.join('').trim()) out.push({ type: cur.type, cls: cur.cls, label: cur.label, text: cur.lines.join('\n').trim() }); };
  for (const line of body.split('\n')) {
    const hit = CALLOUTS.find((c) => c.test.test(bareLabel(line)));
    if (hit) { flush(); cur = { type: 'callout', cls: hit.cls, label: hit.label, lines: [] }; continue; }
    if (/^#{1,6}\s/.test(line.trim()) && cur.type === 'callout') { flush(); cur = { type: 'plain', lines: [] }; }
    cur.lines.push(line);
  }
  flush();
  return out;
}

function ContentRenderer({ lesson }: { lesson: Lesson }) {
  if (!lesson.content?.body) {
    return (
      <div className="text-center py-8 text-slate-400">
        <FileText size={32} className="mx-auto mb-4" />
        <p>No content has been added to this lesson yet.</p>
      </div>
    );
  }

  const segments = segmentBody(lesson.content.body);
  return (
    <div className="prose prose-invert max-w-none">
      {segments.map((seg, i) =>
        seg.type === 'callout' ? (
          <div key={i} className={`callout ${seg.cls}`}>
            <div className="callout-label">{seg.label}</div>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
          </div>
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
        ),
      )}
    </div>
  );
}

// ─── Video Renderer ──────────────────────────────────────────

function VideoRenderer({ lesson }: { lesson: Lesson }) {
  if (!lesson.content?.videoUrl) {
    return (
      <div className="text-center py-8 text-slate-400">
        <PlayCircle size={32} className="mx-auto mb-4" />
        <p>No video has been added to this lesson yet.</p>
      </div>
    );
  }

  return (
    <div className="aspect-video rounded-lg overflow-hidden bg-black">
      <iframe
        src={lesson.content.videoUrl}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation"
      />
    </div>
  );
}

// ─── External Link Renderer ─────────────────────────────────

function ExternalLinkRenderer({ lesson }: { lesson: Lesson }) {
  if (!lesson.content?.externalUrl) {
    return (
      <div className="text-center py-8 text-slate-400">
        <ExternalLink size={32} className="mx-auto mb-4" />
        <p>No external link has been set for this lesson.</p>
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <ExternalLink size={32} className="mx-auto text-slate-400 mb-4" />
      <p className="text-slate-300 mb-4">This lesson links to an external resource.</p>
      <a
        href={lesson.content.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary inline-flex items-center gap-2"
      >
        <ExternalLink size={16} />
        Open External Resource
      </a>
    </div>
  );
}

// ─── Assignment Renderer ────────────────────────────────────

function AssignmentRenderer({
  lesson,
  progress,
  enrollmentId,
  userId,
  courseId,
  onComplete,
}: {
  lesson: Lesson;
  progress: LessonProgress | null;
  enrollmentId?: string;
  userId?: string;
  courseId?: string;
  onComplete: (score: number, passed: boolean, moduleRef: { moduleId: string; referenceId: string }) => void;
}) {
  const prompt = lesson.content?.assignmentPrompt;
  const rubric = lesson.content?.rubric;
  const maxSubmissions = lesson.content?.maxSubmissions ?? 3;

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'write' | 'history' | 'rubric'>('write');
  const [loadingSubs, setLoadingSubs] = useState(true);

  useEffect(() => {
    if (!userId || !enrollmentId) { setLoadingSubs(false); return; }
    listUserLessonSubmissions(userId, enrollmentId, lesson.id)
      .then(setSubmissions)
      .finally(() => setLoadingSubs(false));
  }, [userId, enrollmentId, lesson.id]);

  const latestSubmission = submissions[submissions.length - 1];
  const canSubmit = submissions.length < maxSubmissions
    && (!latestSubmission || latestSubmission.status !== 'draft');
  const hasDraft = latestSubmission?.status === 'draft';

  // If graded, show results
  const gradedSubmission = submissions.find((s) => s.status === 'graded' || s.status === 'returned');

  const handleSaveDraft = async () => {
    if (!enrollmentId || !userId || !courseId) return;
    setSubmitting(true);
    try {
      if (hasDraft && latestSubmission) {
        await updateSubmissionContent(latestSubmission.id, content, false);
        setSubmissions((prev) => prev.map((s) =>
          s.id === latestSubmission.id ? { ...s, content } : s,
        ));
      } else {
        const id = await createSubmission({
          enrollmentId, userId, courseId, lessonId: lesson.id,
          content, isDraft: true,
        });
        setSubmissions((prev) => [...prev, {
          id, enrollmentId, userId, courseId, lessonId: lesson.id,
          content, status: 'draft', attemptNumber: prev.length + 1,
        } as Submission]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!enrollmentId || !userId || !courseId) return;
    setSubmitting(true);
    try {
      if (hasDraft && latestSubmission) {
        await updateSubmissionContent(latestSubmission.id, content, true);
        setSubmissions((prev) => prev.map((s) =>
          s.id === latestSubmission.id ? { ...s, content, status: 'submitted' } : s,
        ));
      } else {
        const id = await createSubmission({
          enrollmentId, userId, courseId, lessonId: lesson.id,
          content, isDraft: false,
        });
        setSubmissions((prev) => [...prev, {
          id, enrollmentId, userId, courseId, lessonId: lesson.id,
          content, status: 'submitted', attemptNumber: prev.length + 1,
        } as Submission]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Load draft content
  useEffect(() => {
    if (hasDraft && latestSubmission) {
      setContent(latestSubmission.content);
    }
  }, [hasDraft, latestSubmission]);

  if (loadingSubs) {
    return <div className="text-center py-8 animate-pulse-slow text-slate-400">Loading...</div>;
  }

  return (
    <div>
      {/* Prompt */}
      {prompt && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-400 mb-2">Assignment Prompt</h3>
          <div className="glass rounded-lg p-4 text-slate-200 whitespace-pre-wrap">{prompt}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/10">
        {(['write', 'rubric', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize transition-colors ${
              activeTab === tab
                ? 'text-white border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab === 'write' ? 'Your Response' : tab === 'rubric' ? 'Rubric' : 'Submissions'}
          </button>
        ))}
      </div>

      {/* Write Tab */}
      {activeTab === 'write' && (
        <div>
          {gradedSubmission?.grade ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle size={24} className="text-emerald-400" />
                <div>
                  <p className="text-white font-semibold">Graded: {gradedSubmission.grade.percentage}%</p>
                  <p className="text-sm text-slate-400">
                    {gradedSubmission.grade.score}/{gradedSubmission.grade.maxScore} points
                  </p>
                </div>
              </div>
              {gradedSubmission.grade.overallFeedback && (
                <div className="glass rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">Instructor Feedback</p>
                  <p className="text-slate-200 whitespace-pre-wrap">{gradedSubmission.grade.overallFeedback}</p>
                </div>
              )}
              {gradedSubmission.grade.rubricScores.length > 0 && rubric && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Rubric Scores</p>
                  {gradedSubmission.grade.rubricScores.map((rs) => {
                    const criterion = rubric.criteria.find((c) => c.id === rs.criterionId);
                    return (
                      <div key={rs.criterionId} className="glass rounded-lg p-3 flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-white">{criterion?.name ?? rs.criterionId}</p>
                          {rs.feedback && <p className="text-xs text-slate-400 mt-1">{rs.feedback}</p>}
                        </div>
                        <span className="text-sm font-semibold text-cyan-400 ml-4">
                          {rs.points}/{criterion?.maxPoints ?? '?'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {submissions.length < maxSubmissions && (
                <p className="text-xs text-slate-500">
                  You can resubmit ({submissions.length}/{maxSubmissions} attempts used).
                </p>
              )}
            </div>
          ) : (
            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="Write your response here..."
                className="input-base w-full resize-y font-mono text-sm"
                disabled={!canSubmit && !hasDraft}
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-slate-500">
                  {hasDraft ? 'Draft saved' : `${submissions.filter((s) => s.status !== 'draft').length}/${maxSubmissions} submissions`}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveDraft}
                    disabled={submitting || !content.trim()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white text-sm disabled:opacity-30"
                  >
                    <Save size={14} /> Save Draft
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !content.trim() || (!canSubmit && !hasDraft)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Send size={14} /> {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
              {latestSubmission?.status === 'submitted' && (
                <div className="mt-4 glass rounded-lg p-3 text-center">
                  <p className="text-sm text-slate-300">Your submission is awaiting review.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rubric Tab */}
      {activeTab === 'rubric' && (
        <div>
          {rubric && rubric.criteria.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Total: {rubric.totalPoints} points</p>
              {rubric.criteria.map((criterion) => (
                <div key={criterion.id} className="glass rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium">{criterion.name}</h4>
                    <span className="text-xs text-cyan-400">{criterion.maxPoints} pts</span>
                  </div>
                  {criterion.description && (
                    <p className="text-sm text-slate-400 mb-3">{criterion.description}</p>
                  )}
                  {criterion.levels.length > 0 && (
                    <div className="grid gap-2">
                      {criterion.levels.map((level, i) => (
                        <div key={i} className="flex items-start gap-3 text-xs">
                          <span className="text-slate-500 font-mono w-8 shrink-0">{level.points}pt</span>
                          <div>
                            <span className="text-slate-300 font-medium">{level.label}</span>
                            {level.description && (
                              <span className="text-slate-500 ml-1">— {level.description}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Star size={32} className="mx-auto mb-4" />
              <p>No rubric has been defined for this assignment.</p>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          {submissions.length > 0 ? (
            <div className="space-y-3">
              {submissions.map((sub) => (
                <div key={sub.id} className="glass rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white">Attempt #{sub.attemptNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${SUBMISSION_STATUS_COLORS[sub.status]}`}>
                      {SUBMISSION_STATUS_LABELS[sub.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-3">{sub.content}</p>
                  {sub.grade && (
                    <p className="text-xs text-cyan-400 mt-2">
                      Score: {sub.grade.score}/{sub.grade.maxScore} ({sub.grade.percentage}%)
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <ClipboardList size={32} className="mx-auto mb-4" />
              <p>No submissions yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Renderer ───────────────────────────────────────────

// ─── HTML Renderer ───────────────────────────────────────────
// Renders via srcDoc iframe so <script> tags execute and CSS is isolated
// from the host app. Height defaults to 800px; editor can override via
// lesson.content.iframeHeight.

function HtmlRenderer({ lesson }: { lesson: Lesson }) {
  const html = lesson.content?.htmlBody ?? '';
  const height = lesson.content?.iframeHeight ?? 800;

  if (!html) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        <p>No HTML content set for this lesson.</p>
      </div>
    );
  }

  // Wrap bare HTML fragments in a minimal document shell if the author
  // didn't supply <html>/<body>. This keeps <script>, <style>, and relative
  // paths behaving as expected.
  const hasDocShell = /<html[\s>]/i.test(html) || /<!doctype/i.test(html);
  const srcDoc = hasDocShell
    ? html
    : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;padding:16px;color:#1e293b;background:#fff;}</style></head><body>${html}</body></html>`;

  return (
    <iframe
      title={lesson.title}
      srcDoc={srcDoc}
      className="w-full rounded-lg border border-slate-700 bg-white block"
      style={{ height: `${height}px` }}
      sandbox="allow-scripts allow-forms allow-popups allow-presentation allow-same-origin"
    />
  );
}

// ─── iFrame Renderer ─────────────────────────────────────────

function IframeRenderer({ lesson }: { lesson: Lesson }) {
  const url = lesson.content?.iframeUrl ?? '';
  const height = lesson.content?.iframeHeight ?? 600;
  const allowFullscreen = lesson.content?.iframeAllowFullscreen ?? true;

  if (!url) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        <p>No embed URL set for this lesson.</p>
      </div>
    );
  }
  return (
    <iframe
      src={url}
      title={lesson.title}
      className="w-full rounded-lg border border-slate-700 bg-white block"
      style={{ height: `${height}px` }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
      allow={allowFullscreen ? 'fullscreen' : undefined}
    />
  );
}

interface LessonRendererProps {
  lesson: Lesson;
  progress: LessonProgress | null;
  enrollmentId?: string;
  userId?: string;
  courseId?: string;
  onAssessmentComplete?: (score: number, passed: boolean, moduleRef: { moduleId: string; referenceId: string }) => void;
}

export default function LessonRenderer({ lesson, progress, enrollmentId, userId, courseId, onAssessmentComplete }: LessonRendererProps) {
  const handleComplete = useCallback(
    (score: number, passed: boolean, moduleRef: { moduleId: string; referenceId: string }) => {
      onAssessmentComplete?.(score, passed, moduleRef);
    },
    [onAssessmentComplete],
  );

  switch (lesson.type) {
    case 'content':
      return <ContentRenderer lesson={lesson} />;
    case 'video':
      return <VideoRenderer lesson={lesson} />;
    case 'external_link':
      return <ExternalLinkRenderer lesson={lesson} />;
    case 'mcq_assessment':
      return <MCQAssessmentRenderer lesson={lesson} progress={progress} onComplete={handleComplete} />;
    case 'oral_practice':
      return <OralPracticeRenderer lesson={lesson} />;
    case 'presentation':
      return <PresentationRenderer lesson={lesson} />;
    case 'discussion':
      return <DiscussionRenderer lesson={lesson} />;
    case 'assignment':
      return (
        <AssignmentRenderer
          lesson={lesson}
          progress={progress}
          enrollmentId={enrollmentId}
          userId={userId}
          courseId={courseId}
          onComplete={handleComplete}
        />
      );
    case 'notebook_source':
      return <NotebookSourceRenderer lesson={lesson} />;
    case 'html':
      return <HtmlRenderer lesson={lesson} />;
    case 'iframe':
      return <IframeRenderer lesson={lesson} />;
    default:
      return (
        <div className="text-center py-8 text-slate-400">
          <p>Unsupported lesson type.</p>
        </div>
      );
  }
}
