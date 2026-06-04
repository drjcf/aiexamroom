'use client';

import { Calendar } from 'lucide-react';
import type { TimelineOutput } from '../types';

interface TimelineViewerProps {
  data: TimelineOutput;
}

export default function TimelineViewer({ data }: TimelineViewerProps) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-slate-800">
        <Calendar className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-medium text-emerald-400">{data.title}</span>
      </div>

      {/* Timeline */}
      <div className="p-4">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-700" />

          <div className="space-y-0">
            {data.events.map((event, i) => (
              <div
                key={i}
                className={`relative flex gap-4 py-3 px-3 rounded-lg ${
                  i % 2 === 0 ? 'bg-slate-800/30' : ''
                }`}
              >
                {/* Dot */}
                <div className="relative z-10 mt-1 shrink-0">
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-emerald-500 bg-slate-900" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/50 text-emerald-400 border border-emerald-700/50 mb-1.5">
                    {event.date}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-50">{event.title}</h4>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                    {event.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
