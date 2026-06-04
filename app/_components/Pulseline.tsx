export function Pulseline({ className = '', height = 64 }: { className?: string; height?: number }) {
  const beat = '0,40 70,40 84,40 92,30 100,40 150,40 162,40 170,8 182,72 192,40 232,40 250,40 262,33 274,40 320,40';
  const points = [0, 320, 640, 960].map((dx) =>
    beat.split(' ').map((p) => { const [x, y] = p.split(','); return `${Number(x) + dx},${y}`; }).join(' '),
  ).join(' ');
  return (
    <svg className={className} viewBox="0 0 1280 80" width="100%" height={height} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <polyline points={points} fill="none" stroke="var(--brand-teal-light)" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" pathLength={100} className="ecg-path" />
    </svg>
  );
}
