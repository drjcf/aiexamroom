'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Presentation, StickyNote, ChevronDown, ChevronUp } from 'lucide-react';
import type { SlideOutput } from '../types';

interface SlideViewerProps {
  data: SlideOutput;
}

export default function SlideViewer({ data }: SlideViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);

  const slides = data.slides;
  const current = slides[currentIndex];

  const goNext = () => setCurrentIndex((i) => Math.min(i + 1, slides.length - 1));
  const goPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0));

  const renderSlideContent = () => {
    if (!current) return null;

    switch (current.layout) {
      case 'title':
        return (
          <div className="flex flex-col items-center justify-center h-full min-h-[280px] text-center px-8">
            <h2 className="text-3xl font-bold text-slate-50 mb-4">{current.title}</h2>
            {current.bullets.length > 0 && (
              <p className="text-lg text-slate-400">{current.bullets[0]}</p>
            )}
          </div>
        );

      case 'quote':
        return (
          <div className="flex flex-col items-center justify-center h-full min-h-[280px] px-12">
            <div className="border-l-4 border-emerald-500 pl-6 py-2">
              <p className="text-xl italic text-slate-200 leading-relaxed">
                {current.bullets[0] || current.title}
              </p>
            </div>
            {current.bullets.length > 1 && (
              <p className="mt-4 text-sm text-slate-400">{current.bullets[1]}</p>
            )}
          </div>
        );

      case 'two-column':
        const mid = Math.ceil(current.bullets.length / 2);
        const leftCol = current.bullets.slice(0, mid);
        const rightCol = current.bullets.slice(mid);
        return (
          <div className="p-6 min-h-[280px]">
            <h3 className="text-xl font-semibold text-slate-50 mb-5">{current.title}</h3>
            <div className="grid grid-cols-2 gap-6">
              <ul className="space-y-2">
                {leftCol.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              <ul className="space-y-2">
                {rightCol.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );

      case 'bullets':
      default:
        return (
          <div className="p-6 min-h-[280px]">
            <h3 className="text-xl font-semibold text-slate-50 mb-5">{current.title}</h3>
            <ul className="space-y-3">
              {current.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-300">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2 text-emerald-400">
          <Presentation className="w-4 h-4" />
          <span className="text-sm font-medium">{data.title}</span>
        </div>
        <span className="text-xs text-slate-400">
          {currentIndex + 1} / {slides.length}
        </span>
      </div>

      {/* Main Slide Area */}
      <div className="bg-slate-800/50">{renderSlideContent()}</div>

      {/* Speaker Notes (collapsible) */}
      {current?.speakerNotes && (
        <div className="border-t border-slate-700">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <StickyNote className="w-3.5 h-3.5" />
            Speaker Notes
            {showNotes ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {showNotes && (
            <div className="px-4 pb-3 text-sm text-slate-400 leading-relaxed">
              {current.speakerNotes}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-800">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <button
          onClick={() => setShowThumbnails(!showThumbnails)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {showThumbnails ? 'Hide' : 'Show'} thumbnails
        </button>
        <button
          onClick={goNext}
          disabled={currentIndex === slides.length - 1}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Thumbnails Strip */}
      {showThumbnails && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto border-t border-slate-700 bg-slate-900">
          {slides.map((slide, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`shrink-0 w-28 h-16 rounded border text-left p-2 transition-colors ${
                i === currentIndex
                  ? 'border-emerald-500 bg-slate-800'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
              }`}
            >
              <p className="text-[10px] font-medium text-slate-300 truncate">{slide.title}</p>
              <p className="text-[9px] text-slate-500 truncate mt-0.5">
                {slide.bullets[0] || ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
