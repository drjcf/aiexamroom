'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Award, Shield, Calendar, BookOpen, Route, Search } from 'lucide-react';
import { ModuleNav } from '../context';
import { lmsTabs } from '../routes';
import { useAuth } from '../context';
import { useSessionTracker } from '../context';
import { listUserCertificates, getCertificate, verifyCertificate } from '../services/certificate.service';
import type { Certificate } from '../types';

function formatDate(ts: { seconds: number } | undefined): string {
  if (!ts) return '';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function CertificateCard({ cert, expanded }: { cert: Certificate; expanded?: boolean }) {
  return (
    <div className={`glass rounded-xl overflow-hidden ${expanded ? 'border border-emerald-500/30' : ''}`}>
      {/* Certificate Display */}
      <div className={`${expanded ? 'p-8' : 'p-5'} text-center bg-gradient-to-b from-emerald-900/20 to-transparent`}>
        <Award size={expanded ? 56 : 32} className="mx-auto text-emerald-400 mb-3" />
        <p className="text-xs text-emerald-400 uppercase tracking-widest mb-1">Certificate of Completion</p>
        <h3 className={`${expanded ? 'text-2xl' : 'text-lg'} font-bold text-white mb-2`}>{cert.referenceTitle}</h3>
        <p className="text-slate-300">{cert.userName}</p>
        {cert.score !== undefined && (
          <p className="text-sm text-slate-400 mt-1">Score: {cert.score}%</p>
        )}
        {cert.cmeCredits !== undefined && (
          <p className="text-sm text-cyan-400 mt-1">{cert.cmeCredits} CME Credits</p>
        )}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Calendar size={12} /> {formatDate(cert.issuedAt as { seconds: number })}
          </span>
          <span className="flex items-center gap-1">
            {cert.type === 'course' ? <BookOpen size={12} /> : <Route size={12} />}
            {cert.type === 'course' ? 'Course' : 'Learning Path'}
          </span>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-slate-500">Verification Code</p>
          <p className="text-sm font-mono text-slate-300 tracking-wider">{cert.verificationCode}</p>
        </div>
      </div>
    </div>
  );
}

export default function CertificatesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  useSessionTracker('lms');

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyResult, setVerifyResult] = useState<Certificate | null | 'not_found'>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const certs = await listUserCertificates(user.uid);
      setCertificates(certs);

      // Check for ?id= parameter
      const certId = searchParams.get('id');
      if (certId) {
        const cert = certs.find((c) => c.id === certId) ?? await getCertificate(certId);
        if (cert) setSelectedCert(cert);
      }
    })().finally(() => setLoading(false));
  }, [user, searchParams]);

  const handleVerify = async () => {
    if (!verifyCode.trim()) return;
    setVerifying(true);
    const cert = await verifyCertificate(verifyCode.trim().toUpperCase());
    setVerifyResult(cert ?? 'not_found');
    setVerifying(false);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-3">
        <Award size={24} className="text-emerald-400" />
        Certificates
      </h1>

      <ModuleNav tabs={lmsTabs()} />

      {/* Verify Section */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Shield size={16} className="text-slate-400" />
          <span className="text-sm text-slate-400">Verify a certificate:</span>
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={verifyCode}
              onChange={(e) => { setVerifyCode(e.target.value); setVerifyResult(null); }}
              placeholder="Enter verification code"
              className="input-base w-full text-sm font-mono pl-9"
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            onClick={handleVerify}
            disabled={verifying || !verifyCode.trim()}
            className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:text-white text-sm disabled:opacity-30"
          >
            {verifying ? 'Checking...' : 'Verify'}
          </button>
        </div>
        {verifyResult === 'not_found' && (
          <p className="text-sm text-red-400 mt-2 ml-7">Certificate not found.</p>
        )}
        {verifyResult && verifyResult !== 'not_found' && (
          <div className="mt-3 ml-7">
            <p className="text-sm text-emerald-400 mb-2">Valid certificate found:</p>
            <CertificateCard cert={verifyResult} />
          </div>
        )}
      </div>

      {/* Selected Certificate (full view) */}
      {selectedCert && (
        <div>
          <button
            onClick={() => setSelectedCert(null)}
            className="text-sm text-slate-400 hover:text-white mb-3"
          >
            &larr; Back to all certificates
          </button>
          <CertificateCard cert={selectedCert} expanded />
        </div>
      )}

      {/* Certificate List */}
      {!selectedCert && (
        loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse-slow text-slate-400">Loading...</div>
          </div>
        ) : certificates.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Award size={48} className="mx-auto text-slate-500 mb-4" />
            <p className="text-slate-400">No certificates earned yet.</p>
            <p className="text-sm text-slate-500 mt-1">Complete courses with certificates enabled to earn them.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map((cert) => (
              <button key={cert.id} onClick={() => setSelectedCert(cert)} className="text-left">
                <CertificateCard cert={cert} />
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
