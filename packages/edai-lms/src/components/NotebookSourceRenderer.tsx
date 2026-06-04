'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config';
import { BookOpen, AlertTriangle } from 'lucide-react';
import SlideViewer from '../vendor/research-notebook/viewers/SlideViewer';
import PodcastViewer from '../vendor/research-notebook/viewers/PodcastViewer';
import AudioScriptViewer from '../vendor/research-notebook/viewers/AudioScriptViewer';
import FlashcardViewer from '../vendor/research-notebook/viewers/FlashcardViewer';
import QuizViewer from '../vendor/research-notebook/viewers/QuizViewer';
import TimelineViewer from '../vendor/research-notebook/viewers/TimelineViewer';
import MindMapViewer from '../vendor/research-notebook/viewers/MindMapViewer';
import ComparisonTableViewer from '../vendor/research-notebook/viewers/ComparisonTableViewer';
import type { RNSource, RNSourceInsight } from '../vendor/research-notebook/types';
import type { Lesson } from '../types';

interface Props {
  lesson: Lesson;
}

export default function NotebookSourceRenderer({ lesson }: Props) {
  const { rnSourceId, rnInsightIds, rnShowSourceText = true } = lesson.content ?? {};
  const [source, setSource] = useState<RNSource | null>(null);
  const [insights, setInsights] = useState<RNSourceInsight[]>([]);
  const [totalInsightsFound, setTotalInsightsFound] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rnSourceId) {
      setError('No source linked to this lesson.');
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const sourceSnap = await getDoc(doc(db, 'rn_sources', rnSourceId));
        if (cancelled) return;
        if (!sourceSnap.exists()) {
          setError('Source not found. It may have been deleted from the notebook.');
          setLoading(false);
          return;
        }
        setSource({ id: sourceSnap.id, ...sourceSnap.data() } as RNSource);

        const insightsSnap = await getDocs(
          query(collection(db, 'rn_source_insights'), where('sourceId', '==', rnSourceId)),
        );
        if (cancelled) return;
        const allInsights = insightsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as RNSourceInsight));
        setTotalInsightsFound(allInsights.length);
        console.log('[NotebookSourceRenderer]', {
          rnSourceId,
          totalInsights: allInsights.length,
          filterIds: rnInsightIds,
          insightIds: allInsights.map((i) => i.id),
        });
        let list = allInsights;
        if (rnInsightIds && rnInsightIds.length > 0) {
          const allowed = new Set(rnInsightIds);
          list = list.filter((i) => i.id && allowed.has(i.id));
        }
        list.sort((a, b) => (a.outputType ?? '').localeCompare(b.outputType ?? ''));
        setInsights(list);
      } catch (err) {
        console.error('[NotebookSourceRenderer] load failed', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load source.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [rnSourceId, rnInsightIds]);

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-sm">Loading source…</div>;
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center gap-2 text-center text-amber-300 text-sm">
        <AlertTriangle size={24} />
        <p>{error}</p>
      </div>
    );
  }

  if (!source) return null;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center flex-shrink-0">
          <BookOpen size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-white truncate">{source.title}</h2>
          {source.topics && (
            <p className="text-xs text-slate-400 mt-0.5">{source.topics}</p>
          )}
        </div>
      </header>

      {rnShowSourceText && source.fullTextPreview && (
        <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Source Preview</h3>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300 max-h-96 overflow-y-auto">
            {source.fullTextPreview}
          </div>
        </section>
      )}

      {insights.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-slate-300">Insights</h3>
          {insights.map((insight) => (
            <InsightBlock key={insight.id} insight={insight} />
          ))}
        </section>
      )}

      {insights.length === 0 && (
        <p className="text-sm text-slate-500 italic">
          {totalInsightsFound === 0
            ? 'No insights attached to this source yet. Run transformations in the notebook to generate slides, podcasts, summaries, etc.'
            : `Source has ${totalInsightsFound} insight(s), but none match the IDs selected for this lesson. Re-edit the lesson and adjust the insight filter.`}
        </p>
      )}
    </div>
  );
}

function InsightBlock({ insight }: { insight: RNSourceInsight }) {
  const { outputType, structuredContent, content, transformationName } = insight;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60">
      <div className="border-b border-slate-700 px-4 py-2">
        <h4 className="text-sm font-semibold text-slate-200">{transformationName}</h4>
        <p className="text-xs text-slate-500 mt-0.5 capitalize">{outputType.replace(/_/g, ' ')}</p>
      </div>
      <div className="p-4">
        {renderInsightBody(outputType, structuredContent, content)}
      </div>
    </div>
  );
}

function renderInsightBody(
  outputType: string,
  structured: unknown,
  text: string,
) {
  if (structured) {
    switch (outputType) {
      case 'slides':          return <SlideViewer data={structured as any} />;
      case 'podcast_script':  return <PodcastViewer data={structured as any} />;
      case 'audio_script':    return <AudioScriptViewer data={structured as any} />;
      case 'flashcards':      return <FlashcardViewer data={structured as any} />;
      case 'quiz':            return <QuizViewer data={structured as any} />;
      case 'timeline':        return <TimelineViewer data={structured as any} />;
      case 'mind_map':        return <MindMapViewer data={structured as any} />;
      case 'comparison_table':return <ComparisonTableViewer data={structured as any} />;
    }
  }
  // Fall back to plain text for 'text' outputs or when structured parsing failed
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{text}</div>
  );
}
