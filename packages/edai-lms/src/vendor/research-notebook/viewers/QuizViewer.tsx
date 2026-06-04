'use client';

import { useState } from 'react';
import { HelpCircle, ChevronRight, Trophy, RotateCcw } from 'lucide-react';
import type { QuizOutput } from '../types';

interface QuizViewerProps {
  data: QuizOutput;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function QuizViewer({ data }: QuizViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const questions = data.questions;
  const current = questions[currentIndex];
  const isAnswered = selectedOption !== null;
  const isCorrect = selectedOption === current?.correctIndex;

  const handleSelect = (optionIndex: number) => {
    if (isAnswered) return;
    setSelectedOption(optionIndex);
    setAnswered((a) => a + 1);
    if (optionIndex === current.correctIndex) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex >= questions.length - 1) {
      setShowResults(true);
      return;
    }
    setSelectedOption(null);
    setCurrentIndex((i) => i + 1);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setScore(0);
    setAnswered(0);
    setShowResults(false);
  };

  const getOptionStyle = (optionIndex: number) => {
    if (!isAnswered) {
      return 'border-slate-700 bg-slate-800 hover:border-slate-500 hover:bg-slate-700/50 cursor-pointer';
    }
    if (optionIndex === current.correctIndex) {
      return 'border-green-600 bg-green-900/30 text-green-300';
    }
    if (optionIndex === selectedOption && !isCorrect) {
      return 'border-red-600 bg-red-900/30 text-red-300';
    }
    return 'border-slate-700/50 bg-slate-800/50 opacity-50';
  };

  if (showResults) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center gap-2 text-emerald-400">
            <Trophy className="w-4 h-4" />
            <span className="text-sm font-medium">Quiz Results</span>
          </div>
        </div>
        <div className="p-8 text-center">
          <div className="text-5xl font-bold text-emerald-400 mb-2">{pct}%</div>
          <p className="text-lg text-slate-300 mb-1">
            {score} / {questions.length} correct
          </p>
          <p className="text-sm text-slate-500 mb-6">
            {pct >= 80
              ? 'Excellent work!'
              : pct >= 60
              ? 'Good job, keep studying!'
              : 'Keep reviewing the material.'}
          </p>
          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-700 text-emerald-100 hover:bg-emerald-600 transition-colors text-sm"
          >
            <RotateCcw className="w-4 h-4" /> Retry Quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2 text-emerald-400">
          <HelpCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Quiz</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>
            Question {currentIndex + 1} / {questions.length}
          </span>
          <span className="text-emerald-400 font-medium">
            Score: {score}/{answered}
          </span>
        </div>
      </div>

      {/* Question */}
      <div className="p-5">
        <p className="text-base text-slate-50 font-medium mb-5 leading-relaxed">
          {current.question}
        </p>

        {/* Options */}
        <div className="space-y-2.5">
          {current.options.map((option, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={isAnswered}
              className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border text-left text-sm transition-colors ${getOptionStyle(i)}`}
            >
              <span className="shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-medium mt-0.5">
                {OPTION_LABELS[i]}
              </span>
              <span className="text-slate-300">{option}</span>
            </button>
          ))}
        </div>

        {/* Explanation */}
        {isAnswered && (
          <div
            className={`mt-4 p-3 rounded-lg border text-sm ${
              isCorrect
                ? 'bg-green-900/20 border-green-700/50 text-green-300'
                : 'bg-red-900/20 border-red-700/50 text-red-300'
            }`}
          >
            <p className="font-medium mb-1">{isCorrect ? 'Correct!' : 'Incorrect'}</p>
            <p className="text-slate-400">{current.explanation}</p>
          </div>
        )}
      </div>

      {/* Next */}
      {isAnswered && (
        <div className="px-4 pb-4">
          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 ml-auto px-4 py-2 text-sm rounded bg-emerald-700 text-emerald-100 hover:bg-emerald-600 transition-colors"
          >
            {currentIndex >= questions.length - 1 ? 'View Results' : 'Next Question'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
