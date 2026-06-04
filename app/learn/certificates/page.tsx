import { Suspense } from 'react';
import { CertificatesPage } from '@edai/lms';
export default function Page() {
  return (
    <Suspense fallback={null}>
      <CertificatesPage />
    </Suspense>
  );
}
