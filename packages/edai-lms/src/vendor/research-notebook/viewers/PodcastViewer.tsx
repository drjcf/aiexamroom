'use client';

import { useState } from 'react';
import { Mic, Clock, Copy, Check, Users } from 'lucide-react';
import type { PodcastScriptOutput } from '../types';

interface PodcastViewerProps {
  data: PodcastScriptOutput;
}

const SPEAKER_COLORS: Record<number, { bg: string; border: string; name: string }> = {
  0: { bg: 'bg-emerald-900/40', border: 'border-emerald-700/50', name: 'text-emerald-400' },
  1: { bg: 'bg-cyan-900/40', border: 'border-cyan-700/50', name: 'text-cyan-400' },
  2: { bg: 'bg-purple-900/40', border: 'border-purple-700/50', name: 'text-purple-400' },
  3: { bg: 'bg-amber-900/40', border: 'border-amber-700/50', name: 'text-amber-400' },
  4: { bg: 'bg-rose-900/40', border: 'border-rose-700/50', name: 'text-rose-400' },
};

function getSpeakerColor(speakerIndex: number) {
  return SPEAKER_COLORS[speakerIndex % Object.keys(SPEAKER_COLORS).length] || SPEAKER_COLORS[0];
}

export default function PodcastViewer({ data }: PodcastViewerProps) {
  const [copied, setCopied] = useState(false);

  const speakerIndexMap = new Map<string, number>();
  data.speakers.forEach((s, i) => speakerIndexMap.set(s.name, i));

  const handleCopy = async () => {
    const text = data.segments
      .map((seg) => `[${seg.speaker}]: ${seg.dialogue}`)
      .join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2 text-emerald-400">
          <Mic className="w-4 h-4" />
          <span className="text-sm font-medium">{data.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            ~{data.estimatedMinutes} min
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Script'}
          </button>
        </div>
      </div>

      {/* Speaker List */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700 bg-slate-800/50">
        <Users className="w-3.5 h-3.5 text-slate-500" />
        <div className="flex flex-wrap gap-2">
          {data.speakers.map((speaker, i) => {
            const color = getSpeakerColor(i);
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border ${color.bg} ${color.border}`}
              >
                <span className={`font-medium ${color.name}`}>{speaker.name}</span>
                <span className="text-slate-500">{speaker.role}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Dialogue */}
      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {data.segments.map((segment, i) => {
          const speakerIdx = speakerIndexMap.get(segment.speaker) ?? 0;
          const color = getSpeakerColor(speakerIdx);
          return (
            <div
              key={i}
              className={`rounded-lg border p-3 ${color.bg} ${color.border}`}
            >
              <span className={`text-xs font-semibold ${color.name}`}>
                {segment.speaker}
              </span>
              <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                {segment.dialogue}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
