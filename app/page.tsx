import Link from 'next/link';
import { Pulseline } from './_components/Pulseline';

const SEATS = [
  { href: '/patients', label: 'Patients', stake: 'Bring AI findings to your visit so they help — and know when to stop reading and get seen.' },
  { href: '/caregivers', label: 'Caregivers', stake: 'Advocate well when the app and the care team disagree about someone you love.' },
  { href: '/physicians', label: 'Physicians', stake: 'Receive the AI-informed patient: validate what it got right, correct what it missed, document the difference.' },
  { href: '/nurses', label: 'Nurses', stake: 'Triage, reconcile, and educate at the bedside when AI is already in the room.' },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-4">
        <p className="eyebrow rise d1">Free &middot; non-commercial</p>
        <h1 className="display text-[3rem] leading-[1.02] md:text-[5rem] text-white mt-5 rise d2">
          What AI can&rsquo;t see<br />in the exam room.
        </h1>
        <p className="mt-7 text-lg md:text-xl text-slate-300 max-w-2xl leading-relaxed rise d3">
          It gives confident answers. It can&rsquo;t read the pallor, hear the tremor, or feel what&rsquo;s firm under the skin.
          A free curriculum on using medical AI well &mdash; taught from every seat in the room.
        </p>
        <div className="mt-9 flex flex-wrap gap-3 rise d4">
          <Link href="/learn" className="btn-primary">Start learning &rarr;</Link>
          <Link href="#seats" className="btn-ghost">Find your seat</Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 mt-10 mb-24 opacity-90">
        <Pulseline height={72} />
      </div>

      {/* Seats */}
      <section id="seats" className="mx-auto max-w-4xl px-6 py-6">
        <p className="eyebrow">Four seats &middot; one encounter</p>
        <h2 className="display text-3xl md:text-4xl text-white mt-3 mb-10">
          The same case, taught from where you sit.
        </h2>
        <div>
          {SEATS.map((s, i) => (
            <Link key={s.href} href={s.href} className="role-row block py-6">
              <div className="flex items-baseline gap-5">
                <span className="role-num text-xl md:text-2xl">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="display text-2xl md:text-3xl text-white">{s.label}</span>
                    <span className="text-slate-500 text-xl">&rarr;</span>
                  </div>
                  <p className="text-slate-400 mt-1 max-w-2xl leading-relaxed">{s.stake}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Specimen — what a lesson looks like */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <p className="eyebrow">Inside a lesson</p>
        <h2 className="display text-3xl md:text-4xl text-white mt-3 mb-3">
          Every case, from both sides of the screen.
        </h2>
        <p className="text-slate-400 max-w-2xl leading-relaxed mb-10">
          A 45-year-old arrives fatigued, having already asked an AI. It suggested a thyroid workup.
          Here is the part of the lesson where the encounter turns.
        </p>
        <div className="glass rounded-xl p-6 md:p-8">
          <div className="callout callout-success">
            <div className="callout-label">What AI got right</div>
            <p className="text-slate-200 m-0">Fatigue can signal thyroid disease, and a TSH is a reasonable first test.</p>
          </div>
          <div className="callout callout-danger">
            <div className="callout-label">What AI missed</div>
            <p className="text-slate-200 m-0">It never saw the pale conjunctivae, never asked about six months of heavy periods. The anemia in front of you outranks the algorithm&rsquo;s differential.</p>
          </div>
          <div className="callout callout-teal">
            <div className="callout-label">Teaching moment</div>
            <p className="text-slate-200 m-0">AI generates lists. Physicians see patients. The pallor took two seconds to observe and reframed the entire workup.</p>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-4xl px-6 pb-8">
        <blockquote className="display text-3xl md:text-5xl text-white leading-tight">
          &ldquo;Optimize the clinician.<br />You can&rsquo;t replace them.&rdquo;
        </blockquote>
        <p className="mt-8 text-slate-400 max-w-2xl leading-relaxed">
          Written by a practicing, board-certified surgeon. Free to read, with no account required.
          Sign in only if you want to track progress or earn a certificate of completion.
        </p>
        <div className="mt-9">
          <Link href="/learn" className="btn-primary">Start with your seat &rarr;</Link>
        </div>
      </section>
    </main>
  );
}
