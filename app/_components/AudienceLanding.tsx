import Link from 'next/link';
import { Pulseline } from './Pulseline';

export interface AudienceProps {
  kicker: string;
  title: string;
  lede: string;
  points: string[];
  courseId: string;
  cta: string;
}

export function AudienceLanding({ kicker, title, lede, points, courseId, cta }: AudienceProps) {
  return (
    <main className="mx-auto max-w-4xl px-6 pt-20 pb-10">
      <p className="eyebrow rise d1">{kicker}</p>
      <h1 className="display text-[2.6rem] md:text-[3.4rem] text-white mt-4 mb-6 rise d2">{title}</h1>
      <p className="text-lg md:text-xl text-slate-300 max-w-2xl leading-relaxed rise d3">{lede}</p>
      <div className="my-10 rise d3"><Pulseline height={46} /></div>
      <ul className="space-y-4 mb-12 rise d4">
        {points.map((p, i) => (
          <li key={i} className="flex gap-4">
            <span className="role-num text-sm pt-1" style={{ minWidth: '1.5rem' }}>{String(i + 1).padStart(2, '0')}</span>
            <span className="text-slate-300 text-lg leading-relaxed">{p}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3 rise d5">
        <Link href={`/learn/courses/${courseId}`} className="btn-primary">{cta} &rarr;</Link>
        <Link href="/learn/courses" className="btn-ghost">Browse all courses</Link>
      </div>
    </main>
  );
}
