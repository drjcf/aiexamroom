import type { Timestamp } from 'firebase/firestore';

// ─── Source Origin Types ─────────────────────────────────────

export type SourceOriginUpload = { type: 'upload'; contentId: string; storagePath?: string; downloadUrl?: string; mimeType?: string };
export type SourceOriginLinkContent = { type: 'link_content'; contentId: string };
export type SourceOriginLinkArticle = { type: 'link_article'; articleId: string };
export type SourceOriginUrl = { type: 'url'; url: string };
export type SourceOriginText = { type: 'text' };
export type SourceOriginInsight = { type: 'insight'; insightId: string; sourceId: string };
export type SourceOriginDiscussion = { type: 'discussion'; groupId: string; threadId?: string };

export type SourceOrigin =
  | SourceOriginUpload
  | SourceOriginLinkContent
  | SourceOriginLinkArticle
  | SourceOriginUrl
  | SourceOriginText
  | SourceOriginInsight
  | SourceOriginDiscussion;

export type SourceStatus = 'processing' | 'ready' | 'error';
export type NoteType = 'human' | 'ai';
export type ChatSessionType = 'notebook' | 'source';

// ─── Core Entities ───────────────────────────────────────────

export interface RNNotebook {
  id?: string;
  name: string;
  description: string;
  archived: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sourceCount: number;
  noteCount: number;
}

export interface RNSource {
  id?: string;
  notebookIds: string[];
  title: string;
  origin: SourceOrigin;
  fullTextPreview: string;
  fullTextLength: number;
  topics: string;
  status: SourceStatus;
  processingError?: string;
  embedded: boolean;
  embeddedChunkCount: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RNSourceChunk {
  id?: string;
  sourceId: string;
  chunkIndex: number;
  text: string;
  embedding?: number[];
  metadata: {
    charStart?: number;
    charEnd?: number;
    page?: number;
    section?: string;
  };
}

export type InsightOutputType =
  | 'text'
  | 'slides'
  | 'audio_script'
  | 'podcast_script'
  | 'mind_map'
  | 'flashcards'
  | 'quiz'
  | 'timeline'
  | 'comparison_table';

export interface RNSourceInsight {
  id?: string;
  sourceId: string;
  transformationId: string;
  transformationName: string;
  content: string;
  outputType: InsightOutputType;
  structuredContent?: any;
  embedding?: number[];
  createdAt: Timestamp;
}

// ─── Structured Output Types ─────────────────────────────────

export interface SlideOutput {
  slides: Array<{
    order: number;
    title: string;
    bullets: string[];
    speakerNotes: string;
    layout: 'title' | 'bullets' | 'two-column' | 'quote';
  }>;
  title: string;
  slideCount: number;
}

export interface AudioScriptOutput {
  script: string;
  estimatedMinutes: number;
  sections: Array<{ heading: string; text: string }>;
}

export interface PodcastScriptOutput {
  title: string;
  estimatedMinutes: number;
  speakers: Array<{ name: string; role: string }>;
  segments: Array<{ speaker: string; dialogue: string }>;
}

export interface MindMapNode {
  label: string;
  children?: MindMapNode[];
}

export interface MindMapOutput {
  root: string;
  branches: MindMapNode[];
}

export interface FlashcardOutput {
  cards: Array<{
    front: string;
    back: string;
    tags: string[];
    difficulty: 'basic' | 'intermediate' | 'advanced';
  }>;
  cardCount: number;
}

export interface QuizOutput {
  questions: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    difficulty: 'basic' | 'intermediate' | 'advanced';
  }>;
  questionCount: number;
}

export interface TimelineOutput {
  title: string;
  events: Array<{
    date: string;
    title: string;
    description: string;
  }>;
}

export interface ComparisonTableOutput {
  title: string;
  columns: string[];
  rows: Array<{
    criterion: string;
    values: string[];
  }>;
}

export interface RNNote {
  id?: string;
  notebookIds: string[];
  title: string;
  content: string;
  noteType: NoteType;
  embedding?: number[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RNChatSession {
  id?: string;
  type: ChatSessionType;
  notebookId?: string;
  sourceId?: string;
  title: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RNChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  contextUsed?: {
    sourceIds: string[];
    noteIds: string[];
    insightIds: string[];
  };
  createdAt: Timestamp;
}

export interface RNTransformation {
  id?: string;
  name: string;
  title: string;
  description: string;
  prompt: string;
  outputType: InsightOutputType;
  applyDefault: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Search & Synthesis ──────────────────────────────────────

export interface SearchResult {
  id: string;
  type: 'source' | 'note' | 'chunk' | 'insight';
  title?: string;
  text: string;
  score?: number;
  sourceId?: string;
}

export interface SynthesisStrategy {
  reasoning: string;
  searches: Array<{
    term: string;
    instructions: string;
  }>;
}

export interface SynthesisResult {
  strategy: SynthesisStrategy;
  subAnswers: Array<{
    term: string;
    answer: string;
  }>;
  finalAnswer: string;
}

// ─── Create/Update Params ────────────────────────────────────

export interface CreateNotebookParams {
  name: string;
  description?: string;
}

export interface UpdateNotebookParams {
  name?: string;
  description?: string;
  archived?: boolean;
}

export interface CreateSourceParams {
  notebookId: string;
  title: string;
  origin: SourceOrigin;
  fullText?: string;
}

export interface LinkContentParams {
  notebookId: string;
  contentId: string;
}

export interface LinkArticleParams {
  notebookId: string;
  articleId: string;
}

export interface CreateNoteParams {
  notebookId: string;
  title: string;
  content: string;
  noteType: NoteType;
}

export interface UpdateNoteParams {
  title?: string;
  content?: string;
}

export interface CreateTransformationParams {
  name: string;
  title: string;
  description: string;
  prompt: string;
  applyDefault: boolean;
}

export interface ExecuteTransformationParams {
  sourceId: string;
  transformationId: string;
}

export interface ChatMessageParams {
  sessionId: string;
  message: string;
}

export interface SearchParams {
  query: string;
  notebookId?: string;
  searchSources?: boolean;
  searchNotes?: boolean;
  limit?: number;
}

export interface SynthesizeParams {
  question: string;
  notebookId?: string;
}

// ─── UI Constants ────────────────────────────────────────────

export const SOURCE_STATUS_CONFIG: Record<SourceStatus, { label: string; color: string }> = {
  processing: { label: 'Processing', color: 'text-yellow-400' },
  ready: { label: 'Ready', color: 'text-green-400' },
  error: { label: 'Error', color: 'text-red-400' },
};

export const DEFAULT_TRANSFORMATIONS = [
  {
    name: 'key_insights',
    title: 'Key Insights',
    description: 'Extract 10-25 surprising, non-obvious insights',
    applyDefault: true,
  },
  {
    name: 'clinical_pearls',
    title: 'Clinical Pearls',
    description: 'Extract clinical teaching points for medical education',
    applyDefault: true,
  },
  {
    name: 'analyze_paper',
    title: 'Analyze Paper',
    description: 'Structured technical paper analysis: purpose, methods, findings, limitations',
    applyDefault: false,
  },
  {
    name: 'dense_summary',
    title: 'Dense Summary',
    description: 'Machine-optimized dense summary (SPR format) for context injection',
    applyDefault: false,
  },
  {
    name: 'exam_relevance',
    title: 'Exam Relevance',
    description: 'Map content to board exam domains and question types',
    applyDefault: false,
  },
  {
    name: 'table_of_contents',
    title: 'Table of Contents',
    description: 'Hierarchical topic breakdown of the source material',
    applyDefault: false,
  },
] as const;
