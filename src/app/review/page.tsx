'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui';
import { CheckCircle2, Database } from 'lucide-react';
import Link from 'next/link';

export default function ReviewPage() {
  const router = useRouter();

  useEffect(() => {
    // Alur review telah dihapus, alihkan otomatis ke Katalog Dataset
    const timer = setTimeout(() => {
      router.replace('/datasets');
    }, 1200);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <AppLayout>
      <Header
        title="Alur Review Terpadu"
        subtitle="Sistem telah disederhanakan: Pengelolaan data kini dapat langsung dipublikasikan oleh seluruh operator"
      />
      <div className="page-content" style={{ maxWidth: 640, textAlign: 'center', margin: '40px auto' }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-xl)',
            padding: '32px 24px',
            boxShadow: 'var(--shadow-subtle)',
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <CheckCircle2 size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: 'var(--slate-900)' }}>
            Halaman Review Telah Disederhanakan
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--slate-600)', lineHeight: 1.5, margin: '0 0 24px' }}>
            Seluruh pengelola data kini memiliki wewenang setara untuk mempublikasikan dataset secara langsung tanpa antrean review terpisah.
          </p>
          <Link href="/datasets">
            <Button variant="primary" size="md" icon={<Database size={15} />}>
              Buka Katalog Dataset
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
