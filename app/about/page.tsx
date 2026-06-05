import { Pulseline } from '../_components/Pulseline';

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-6 pt-20 pb-8">
      <p className="eyebrow rise d1">About</p>
      <h1 className="display text-[2.6rem] md:text-[3.4rem] text-white mt-4 mb-6 rise d2">Why this exists.</h1>
      <div className="my-8 rise d2"><Pulseline height={42} /></div>
      <div className="space-y-5 text-lg text-slate-300 leading-relaxed rise d3">
        <p>
          AI is already in the exam room. Patients arrive having asked it; clinicians are handed its notes.
          It is confident, often useful, and blind to everything it cannot sense.
        </p>
        <p>
          This is an educational initiative on using medical AI well, taught from every seat in the
          room. There are no subscriptions. Reading is open to everyone;
          an account is needed only to save progress or earn a certificate of completion.
        </p>
        <p className="text-slate-500">
          An educational initiative by John C. Ferguson, MD, FACS.
        </p>
      </div>
    </main>
  );
}
