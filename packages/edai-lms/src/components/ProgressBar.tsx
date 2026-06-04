'use client';

interface ProgressBarProps {
  percent: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function ProgressBar({ percent, showLabel = true, size = 'sm' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-white/10 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${height} rounded-full transition-all duration-500 ${
            clamped >= 100
              ? 'bg-emerald-500'
              : clamped >= 50
                ? 'bg-cyan-500'
                : 'bg-indigo-500'
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-slate-400 w-8 text-right">{Math.round(clamped)}%</span>
      )}
    </div>
  );
}
