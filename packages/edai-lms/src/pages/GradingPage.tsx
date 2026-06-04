'use client';

import { routeBase } from '../config';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle, ClipboardList, ChevronDown, ChevronUp,
  Send, Sparkles, User,
} from 'lucide-react';
import { useAuth } from '../context';
import { getCourse } from '../services/course.service';
import { getCourseLessons } from '../services/lesson.service';
import {
  listLessonSubmissions, gradeSubmission, saveAiSuggestedGrade,
} from '../services/assignment.service';
import type {
  Course, Lesson, Submission, RubricCriterion, RubricScore, Grade,
} from '../types';
import { SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_COLORS } from '../types';

interface GradingPageProps {
  courseId: string;
}

export default function GradingPage({ courseId }: GradingPageProps) {
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [assignmentLessons, setAssignmentLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  // Grading state
  const [rubricScores, setRubricScores] = useState<Record<string, RubricScore>>({});
  const [overallFeedback, setOverallFeedback] = useState('');
  const [gradingSub, setGradingSub] = useState<string | null>(null);
  const [requestingAi, setRequestingAi] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    Promise.all([getCourse(courseId), getCourseLessons(courseId)])
      .then(([c, lessons]) => {
        setCourse(c);
        const assignments = lessons.filter((l) => l.type === 'assignment');
        setAssignmentLessons(assignments);
        if (assignments.length > 0) setSelectedLesson(assignments[0]);
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    if (!selectedLesson) return;
    setLoadingSubs(true);
    listLessonSubmissions(courseId, selectedLesson.id)
      .then(setSubmissions)
      .finally(() => setLoadingSubs(false));
  }, [selectedLesson, courseId]);

  const rubric = selectedLesson?.content?.rubric;

  const openGrading = (sub: Submission) => {
    setExpandedSub(sub.id);
    // Pre-fill from existing grade or AI suggestion
    const grade = sub.grade ?? sub.aiSuggestedGrade;
    if (grade) {
      const scores: Record<string, RubricScore> = {};
      for (const rs of grade.rubricScores) scores[rs.criterionId] = rs;
      setRubricScores(scores);
      setOverallFeedback(grade.overallFeedback);
    } else {
      setRubricScores({});
      setOverallFeedback('');
    }
  };

  const handleSetScore = (criterionId: string, points: number, feedback?: string) => {
    setRubricScores((prev) => ({
      ...prev,
      [criterionId]: {
        criterionId,
        points,
        feedback: feedback ?? prev[criterionId]?.feedback ?? '',
      },
    }));
  };

  const handleSetCriterionFeedback = (criterionId: string, feedback: string) => {
    setRubricScores((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        criterionId,
        points: prev[criterionId]?.points ?? 0,
        feedback,
      },
    }));
  };

  const calculateTotal = useCallback(() => {
    const score = Object.values(rubricScores).reduce((s, rs) => s + rs.points, 0);
    const maxScore = rubric?.totalPoints ?? 100;
    return { score, maxScore, percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0 };
  }, [rubricScores, rubric]);

  const handleGrade = async (submissionId: string) => {
    if (!user) return;
    setGradingSub(submissionId);
    const { score, maxScore, percentage } = calculateTotal();
    const grade: Omit<Grade, 'gradedAt'> = {
      score,
      maxScore,
      percentage,
      rubricScores: Object.values(rubricScores),
      overallFeedback,
      gradedBy: user.uid,
      isAiSuggested: false,
    };
    await gradeSubmission(submissionId, grade);
    setSubmissions((prev) => prev.map((s) =>
      s.id === submissionId ? { ...s, status: 'graded', grade: grade as Grade } : s,
    ));
    setExpandedSub(null);
    setGradingSub(null);
  };

  const handleRequestAiFeedback = async (sub: Submission) => {
    if (!rubric || !selectedLesson) return;
    setRequestingAi(sub.id);

    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../config');
      const callable = httpsCallable(functions, 'gradeAssignmentWithAI');
      const result = await callable({
        submissionContent: sub.content,
        assignmentPrompt: selectedLesson.content?.assignmentPrompt ?? '',
        rubricCriteria: rubric.criteria,
        assignmentType: selectedLesson.content?.assignmentType ?? 'text',
      });

      const aiResult = result.data as {
        rubricScores: RubricScore[];
        overallFeedback: string;
        score: number;
        maxScore: number;
        percentage: number;
      };

      // Save AI suggestion to submission
      const aiGrade: Omit<Grade, 'gradedAt'> = {
        ...aiResult,
        gradedBy: 'ai',
        isAiSuggested: true,
      };
      await saveAiSuggestedGrade(sub.id, aiGrade);

      // Pre-fill the grading form
      const scores: Record<string, RubricScore> = {};
      for (const rs of aiResult.rubricScores) scores[rs.criterionId] = rs;
      setRubricScores(scores);
      setOverallFeedback(aiResult.overallFeedback);

      setSubmissions((prev) => prev.map((s) =>
        s.id === sub.id ? { ...s, aiSuggestedGrade: aiGrade as Grade, status: 'grading' } : s,
      ));
    } catch (err) {
      console.error('AI grading failed:', err);
    } finally {
      setRequestingAi(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-pulse-slow text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-6 text-center text-slate-400">Course not found.</div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href={`${routeBase}/courses/${courseId}/edit`} className="hover:text-white flex items-center gap-1">
          <ArrowLeft size={14} /> {course.title}
        </Link>
        <span>/</span>
        <span className="text-slate-300">Grading</span>
      </div>

      <h1 className="text-2xl font-bold text-white flex items-center gap-3">
        <ClipboardList size={24} className="text-emerald-400" />
        Assignment Grading
      </h1>

      {assignmentLessons.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <ClipboardList size={48} className="mx-auto text-slate-500 mb-4" />
          <p className="text-slate-400">This course has no assignment lessons.</p>
        </div>
      ) : (
        <>
          {/* Lesson Selector */}
          <div className="flex gap-2 flex-wrap">
            {assignmentLessons.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => setSelectedLesson(lesson)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  selectedLesson?.id === lesson.id
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {lesson.title}
              </button>
            ))}
          </div>

          {/* Submissions List */}
          {loadingSubs ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-pulse-slow text-slate-400">Loading submissions...</div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-slate-400">
              No submissions yet for this assignment.
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub) => {
                const isExpanded = expandedSub === sub.id;

                return (
                  <div key={sub.id} className="glass rounded-xl overflow-hidden">
                    {/* Header Row */}
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/5"
                      onClick={() => isExpanded ? setExpandedSub(null) : openGrading(sub)}
                    >
                      <User size={16} className="text-slate-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">
                          User: <span className="text-slate-300 font-mono text-xs">{sub.userId.slice(0, 12)}...</span>
                        </p>
                        <p className="text-xs text-slate-500">Attempt #{sub.attemptNumber}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${SUBMISSION_STATUS_COLORS[sub.status]}`}>
                        {SUBMISSION_STATUS_LABELS[sub.status]}
                      </span>
                      {sub.grade && (
                        <span className="text-sm font-semibold text-cyan-400">
                          {sub.grade.percentage}%
                        </span>
                      )}
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>

                    {/* Expanded Grading Panel */}
                    {isExpanded && (
                      <div className="border-t border-white/10 p-4 space-y-4">
                        {/* Submission Content */}
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Submission</p>
                          <div className="bg-white/5 rounded-lg p-4 text-sm text-slate-200 whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {sub.content}
                          </div>
                        </div>

                        {/* AI Feedback Button */}
                        {rubric && rubric.criteria.length > 0 && sub.status === 'submitted' && (
                          <button
                            onClick={() => handleRequestAiFeedback(sub)}
                            disabled={requestingAi === sub.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-sm"
                          >
                            <Sparkles size={14} />
                            {requestingAi === sub.id ? 'AI is reviewing...' : 'Get AI Feedback'}
                          </button>
                        )}

                        {sub.aiSuggestedGrade && (
                          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                            <p className="text-xs text-purple-300 mb-1 flex items-center gap-1">
                              <Sparkles size={12} /> AI Suggested Score: {sub.aiSuggestedGrade.percentage}%
                            </p>
                            <p className="text-xs text-slate-400">
                              Review and adjust the scores below before finalizing.
                            </p>
                          </div>
                        )}

                        {/* Rubric Grading */}
                        {rubric && rubric.criteria.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs text-slate-400 font-semibold">Rubric Scores</p>
                            {rubric.criteria.map((criterion) => (
                              <div key={criterion.id} className="bg-white/5 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-white">{criterion.name}</span>
                                  <span className="text-xs text-slate-500">/ {criterion.maxPoints}</span>
                                </div>
                                {criterion.description && (
                                  <p className="text-xs text-slate-500">{criterion.description}</p>
                                )}
                                <div className="flex gap-1 flex-wrap">
                                  {criterion.levels.map((level) => (
                                    <button
                                      key={level.points}
                                      onClick={() => handleSetScore(criterion.id, level.points)}
                                      className={`px-2 py-1 rounded text-xs transition-colors ${
                                        rubricScores[criterion.id]?.points === level.points
                                          ? 'bg-indigo-500 text-white'
                                          : 'bg-white/5 text-slate-400 hover:text-white'
                                      }`}
                                      title={level.description}
                                    >
                                      {level.label} ({level.points})
                                    </button>
                                  ))}
                                  <input
                                    type="number"
                                    value={rubricScores[criterion.id]?.points ?? ''}
                                    onChange={(e) => handleSetScore(criterion.id, Number(e.target.value))}
                                    min={0}
                                    max={criterion.maxPoints}
                                    className="input-base w-16 text-xs"
                                    placeholder="pts"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={rubricScores[criterion.id]?.feedback ?? ''}
                                  onChange={(e) => handleSetCriterionFeedback(criterion.id, e.target.value)}
                                  placeholder="Feedback for this criterion..."
                                  className="input-base w-full text-xs"
                                />
                              </div>
                            ))}

                            <div className="flex items-center justify-between pt-2 border-t border-white/10">
                              <span className="text-sm text-slate-400">Total</span>
                              <span className="text-lg font-bold text-white">
                                {calculateTotal().score}/{calculateTotal().maxScore}
                                <span className="text-sm text-slate-400 ml-2">({calculateTotal().percentage}%)</span>
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Overall Feedback */}
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Overall Feedback</label>
                          <textarea
                            value={overallFeedback}
                            onChange={(e) => setOverallFeedback(e.target.value)}
                            rows={4}
                            placeholder="Write feedback for the student..."
                            className="input-base w-full text-sm resize-y"
                          />
                        </div>

                        {/* Submit Grade */}
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setExpandedSub(null)}
                            className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleGrade(sub.id)}
                            disabled={gradingSub === sub.id}
                            className="btn-primary flex items-center gap-2"
                          >
                            <CheckCircle size={14} />
                            {gradingSub === sub.id ? 'Saving...' : 'Submit Grade'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
