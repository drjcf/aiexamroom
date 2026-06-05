import Link from 'next/link';

const NAV = [
  { href: '/patients', label: 'Patients' },
  { href: '/caregivers', label: 'Caregivers' },
  { href: '/physicians', label: 'Physicians' },
  { href: '/nurses', label: 'Nurses' },
  { href: '/resources.html', label: 'Resources', external: true }, // static file, not an app route
  { href: '/about', label: 'About' },
];

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="1,12 7,12 10,5 14,19 17,12 23,12" fill="none"
        stroke="var(--brand-teal-light)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur" style={{ backgroundColor: 'rgba(7,11,20,0.85)' }}>
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="display text-[1.05rem] text-white" style={{ letterSpacing: '-0.01em' }}>AI in the Exam Room</span>
        </Link>
        <nav className="flex items-center gap-6 text-[0.9rem] text-slate-400">
          {NAV.map((n) => n.external
            ? <a   key={n.href} href={n.href} className="hidden sm:inline hover:text-white transition-colors">{n.label}</a>
            : <Link key={n.href} href={n.href} className="hidden sm:inline hover:text-white transition-colors">{n.label}</Link>
          )}
          <Link href="/signin" className="hover:text-white transition-colors">Sign in</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 mt-28">
      <div className="mx-auto max-w-6xl px-6 py-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-md">
          <div className="display text-lg text-white mb-2">AI in the Exam Room</div>
          <p className="text-sm text-slate-500 leading-relaxed">
            An educational initiative by John C. Ferguson, MD, FACS.
          </p>
        </div>
        <div className="flex gap-6 text-sm text-slate-400">
          <Link href="/about" className="hover:text-white">About</Link>
          <Link href="/learn/courses" className="hover:text-white">Courses</Link>
          <Link href="/resources.html">Resources</Link>
          <Link href="/learn/certificates" className="hover:text-white">Verify a certificate</Link>
        </div>
      </div>
    </footer>
  );
}
