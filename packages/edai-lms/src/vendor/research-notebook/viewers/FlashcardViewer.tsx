'use client';

import { useState, useCallback } from 'react';
import { Layers, ChevronLeft, ChevronRight, Shuffle, RotateCcw } from 'lucide-react';
import type { FlashcardOutput } from '../types';

interface FlashcardViewerProps {
  data: FlashcardOutput;
}

const DIFFICULTY_STYLES = {
  basic: 'bg-green-900/50 text-green-400 border-green-700/50',
  intermediate: 'bg-amber-900/50 text-amber-400 border-amber-700/50',
  advanced: 'bg-red-900/50 text-red-400 border-red-700/50',
};

export default function FlashcardViewer({ data }: FlashcardViewerProps) {
  const [cards, setCards] = useState(data.cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const current = cards[currentIndex];

  const goNext = () => {
    setFlipped(false);
    setCurrentIndex((i) => Math.min(i + 1, cards.length - 1));
  };

  const goPrev = () => {
    setFlipped(false);
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  const handleShuffle = useCallback(() => {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setCards(shuffled);
    setCurrentIndex(0);
    setFlipped(false);
  }, [cards]);

  const handleReset = useCallback(() => {
    setCards(data.cards);
    setCurrentIndex(0);
    setFlipped(false);
  }, [data.cards]);

  if (!current) return null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2 text-emerald-400">
          <Layers className="w-4 h-4" />
          <span className="text-sm font-medium">Flashcards</span>
          <span className="text-xs text-slate-500">({data.cardCount} cards)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShuffle}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" /> Shuffle
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Card */}
      <div className="p-6">
        <div
          onClick={() => setFlipped(!flipped)}
          className="min-h-[200px] flex flex-col items-center justify-center p-8 rounded-lg border border-slate-700 bg-slate-800 cursor-pointer hover:border-slate-600 transition-colors select-none"
        >
          {!flipped ? (
            <>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Question</p>
              <p className="text-lg text-slate-50 text-center leading-relaxed">{current.front}</p>
              <p className="mt-4 text-xs text-slate-600">Click to reveal answer</p>
            </>
          ) : (
            <>
              <p className="text-xs text-emerald-500 uppercase tracking-wider mb-3">Answer</p>
              <p className="text-lg text-slate-50 text-center leading-relaxed">{current.back}</p>
            </>
          )}
        </div>

        {/* Difficulty + Tags */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs border ${DIFFICULTY_STYLES[current.difficulty]}`}
          >
            {current.difficulty}
          </span>
          {current.tags.map((tag, i) => (
            <span
              key={i}
              className="inline-block px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400 border border-slate-700"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-800">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className="text-xs text-slate-400">
          {currentIndex + 1} / {cards.length}
        </span>
        <button
          onClick={goNext}
          disabled={currentIndex === cards.length - 1}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
