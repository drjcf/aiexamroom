import type { Metadata } from 'next';
import { Fraunces, Hanken_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { SiteHeader, SiteFooter } from './_components/SiteChrome';

const display = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-display', display: 'swap' });
const body = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: 'AI in the Exam Room',
  description: 'A free, non-commercial curriculum on using medical AI safely — taught from every seat in the exam room.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} dark`}>
      <body>
        <Providers>
          <SiteHeader />
          <div className="min-h-[60vh]">{children}</div>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
