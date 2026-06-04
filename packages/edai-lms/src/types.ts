import type { Timestamp } from 'firebase/firestore';

// ─── Course ──────────────────────────────────────────────────

export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseVisibility = 'public' | 'invite_only';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'mixed';

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

export const COURSE_STATUS_COLORS: Record<CourseStatus, string> = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  published: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  archived: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  mixed: 'Mixed',
};

export const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  beginner: 'bg-green-500/20 text-green-300 border-green-500/30',
  intermediate: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  advanced: 'bg-red-500/20 text-red-300 border-red-500/30',
  mixed: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

export interface CourseSettings {
  selfPaced: boolean;
  startDate?: Timestamp;
  endDate?: Timestamp;
  passingScore: number;
  certificateEnabled: boolean;
  cmeCredits?: number;
  cmeCategory?: string;
  allowRetakes: boolean;
  maxRetakes?: number;
  enforceSequentialProgress: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  coverImageUrl?: string;
  category: string;
  tags: string[];
  difficulty: DifficultyLevel;
  estimatedHours: number;
  visibility: CourseVisibility;
  status: CourseStatus;
  lessonOrder: string[];
  prerequisiteCourseIds: string[];
  settings: CourseSettings;
  createdBy: string;
  instructorIds: string[];
  enrollmentCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
}

// ─── Lesson ──────────────────────────────────────────────────

export type LessonType =
  | 'content'
  | 'video'
  | 'external_link'
  | 'mcq_assessment'
  | 'oral_practice'
  | 'presentation'
  | 'discussion'
  | 'assignment'
  | 'notebook_source'
  | 'html'
  | 'iframe';

export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  content: 'Reading Material',
  video: 'Video',
  external_link: 'External Link',
  mcq_assessment: 'MCQ Assessment',
  oral_practice: 'Oral Practice',
  presentation: 'Presentation',
  discussion: 'Discussion',
  assignment: 'Assignment',
  notebook_source: 'Research Notebook Source',
  html: 'HTML',
  iframe: 'Embedded iFrame',
};

export const LESSON_TYPE_ICONS: Record<LessonType, string> = {
  content: 'file-text',
  video: 'play-circle',
  external_link: 'external-link',
  mcq_assessment: 'brain',
  oral_practice: 'mic',
  presentation: 'presentation',
  discussion: 'message-square',
  assignment: 'clipboard-list',
  notebook_source: 'book-open',
  html: 'code',
  iframe: 'layout',
};

export type CompletionCriteriaType = 'view' | 'score' | 'duration' | 'manual';

export interface LessonCompletionCriteria {
  type: CompletionCriteriaType;
  minScore?: number;
  minDurationMinutes?: number;
}

export interface LessonContent {
  // type: 'content'
  body?: string;
  contentLibraryIds?: string[];

  // type: 'video'
  videoUrl?: string;
  videoDurationMinutes?: number;

  // type: 'external_link'
  externalUrl?: string;

  // type: 'mcq_assessment'
  mcqSetId?: string;
  mcqSetTitle?: string;
  mcqPassingScore?: number;

  // type: 'oral_practice'
  oralTopic?: string;
  oralDifficulty?: string;
  oralProtocolId?: string;

  // type: 'presentation'
  presentationId?: string;
  presentationTitle?: string;

  // type: 'discussion'
  discussionGroupId?: string;
  discussionPrompt?: string;

  // type: 'assignment'
  assignmentPrompt?: string;
  assignmentType?: AssignmentType;
  rubric?: Rubric;
  maxSubmissions?: number;

  // type: 'notebook_source'
  rnSourceId?: string;        // rn_sources doc ID
  rnNotebookId?: string;      // rn_notebooks doc ID (for picker context)
  rnInsightIds?: string[];    // specific rn_source_insights to show; empty/undefined = show all
  rnShowSourceText?: boolean; // show full-text preview alongside insights (default true)

  // type: 'html'
  htmlBody?: string;          // raw HTML string rendered into the lesson body

  // type: 'iframe'
  iframeUrl?: string;         // URL to embed
  iframeHeight?: number;      // height in px (default 600)
  iframeAllowFullscreen?: boolean;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  type: LessonType;
  position: number;
  content: LessonContent;
  completionCriteria: LessonCompletionCriteria;
  estimatedMinutes: number;
  isOptional: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Enrollment ──────────────────────────────────────────────

export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'dropped';

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  enrolled: 'Enrolled',
  in_progress: 'In Progress',
  completed: 'Completed',
  dropped: 'Dropped',
};

export const ENROLLMENT_STATUS_COLORS: Record<EnrollmentStatus, string> = {
  enrolled: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  in_progress: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  dropped: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

export interface EnrollmentProgress {
  completedLessons: number;
  totalLessons: number;
  percentComplete: number;
  currentLessonId?: string;
  lastAccessedAt: Timestamp;
}

export interface EnrollmentGrades {
  assessmentScores: Record<string, number>;
  overallScore?: number;
  passed?: boolean;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  status: EnrollmentStatus;
  progress: EnrollmentProgress;
  grades: EnrollmentGrades;
  cmeActivityId?: string;
  enrolledAt: Timestamp;
  completedAt?: Timestamp;
  droppedAt?: Timestamp;
}

// ─── Lesson Progress ─────────────────────────────────────────

export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface LinkedModuleData {
  moduleId: string;
  referenceId: string;
  completedInModule: boolean;
}

export interface LessonProgress {
  id: string;
  enrollmentId: string;
  userId: string;
  courseId: string;
  lessonId: string;
  status: LessonProgressStatus;
  timeSpentMinutes: number;
  score?: number;
  passed?: boolean;
  linkedModuleData?: LinkedModuleData;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  updatedAt: Timestamp;
}

// ─── Announcement ────────────────────────────────────────────

export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export interface Announcement {
  id: string;
  courseId: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  pinned: boolean;
  createdBy: string;
  createdAt: Timestamp;
}

// ─── Assignment & Grading ────────────────────────────────────

export type AssignmentType = 'text' | 'case_study';

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  text: 'Written Response',
  case_study: 'Case Study Analysis',
};

export interface RubricLevel {
  label: string;
  points: number;
  description: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
  levels: RubricLevel[];
}

export interface Rubric {
  criteria: RubricCriterion[];
  totalPoints: number;
}

export type SubmissionStatus = 'draft' | 'submitted' | 'grading' | 'graded' | 'returned';

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  grading: 'Under Review',
  graded: 'Graded',
  returned: 'Returned',
};

export const SUBMISSION_STATUS_COLORS: Record<SubmissionStatus, string> = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  submitted: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  grading: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  graded: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  returned: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

export interface RubricScore {
  criterionId: string;
  points: number;
  feedback: string;
}

export interface Grade {
  score: number;
  maxScore: number;
  percentage: number;
  rubricScores: RubricScore[];
  overallFeedback: string;
  gradedBy: string;
  gradedByName?: string;
  isAiSuggested: boolean;
  gradedAt: Timestamp;
}

export interface Submission {
  id: string;
  enrollmentId: string;
  userId: string;
  courseId: string;
  lessonId: string;
  content: string;
  status: SubmissionStatus;
  attemptNumber: number;
  grade?: Grade;
  aiSuggestedGrade?: Grade;
  submittedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Curriculum (Learning Path) ──────────────────────────────

export type CurriculumStatus = 'draft' | 'published' | 'archived';

export interface CurriculumCourse {
  courseId: string;
  courseTitle: string;
  position: number;
  isRequired: boolean;
  prerequisiteCourseIds: string[];
}

export interface Curriculum {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  category: string;
  difficulty: DifficultyLevel;
  status: CurriculumStatus;
  courses: CurriculumCourse[];
  estimatedHours: number;
  certificateEnabled: boolean;
  cmeCredits?: number;
  enrollmentCount: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
}

export type CurriculumEnrollmentStatus = 'enrolled' | 'in_progress' | 'completed';

export interface CurriculumEnrollment {
  id: string;
  userId: string;
  curriculumId: string;
  curriculumTitle: string;
  status: CurriculumEnrollmentStatus;
  completedCourseIds: string[];
  totalCourses: number;
  percentComplete: number;
  enrolledAt: Timestamp;
  completedAt?: Timestamp;
}

// ─── Certificate ─────────────────────────────────────────────

export interface Certificate {
  id: string;
  userId: string;
  userName: string;
  type: 'course' | 'curriculum';
  referenceId: string;
  referenceTitle: string;
  score?: number;
  cmeCredits?: number;
  issuedAt: Timestamp;
  verificationCode: string;
}

// ─── Computed Helpers ────────────────────────────────────────

export interface CourseWithEnrollment {
  course: Course;
  enrollment?: Enrollment;
}
