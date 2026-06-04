'use client';

import { useState } from 'react';
import { Clock, FileText, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { AudioScriptOutput } from '../types';

interface AudioScriptViewerProps {
  data: AudioScriptOutput;
}

export default function AudioScriptViewer({ data }: AudioScriptViewerProps) {
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = showFull
      ? data.script
      : data.sections.map((s) => `## ${s.heading}\n\n${s.text}`).join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2 text-emerald-400">
          <FileText className="w-4 h-4" />
          <span className="text-sm font-medium">Audio Script</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            ~{data.estimatedMinutes} min read
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

      {/* Toggle */}
      <div className="px-4 pt-3">
        <button
          onClick={() => setShowFull(!showFull)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {showFull ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showFull ? 'Show sections' : 'Show full script'}
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {showFull ? (
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {data.script}
          </div>
        ) : (
          data.sections.map((section, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold text-emerald-400 mb-2">{section.heading}</h3>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {section.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
