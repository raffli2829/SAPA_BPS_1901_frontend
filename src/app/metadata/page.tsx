'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { SearchInput, StatusBadge, EmptyState, Button } from '@/components/ui';
import { DatasetRepo, subscribe } from '@/lib/repository';
import { Dataset } from '@/lib/types';
import { ArrowRight, BookOpen, Layers, Building2 } from 'lucide-react';

export default function MetadataPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>(() => {
    try {
      return DatasetRepo.getAll();
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(() => {
    setDatasets(DatasetRepo.getAll());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const unsub = subscribe(loadData);
    return unsub;
  }, [isAuthenticated, isLoading, router, loadData]);

  const filtered = datasets.filter((d) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        (d.definition && d.definition.toLowerCase().includes(q))
      );
    }
    return true;
  });

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <PageContent
        datasets={filtered}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
      />
    </AppLayout>
  );
}

function PageContent({
  datasets,
  search,
  onSearchChange,
  onMobileMenuOpen,
}: {
  datasets: Dataset[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onMobileMenuOpen?: () => void;
}) {
  return (
    <>
      <Header
        title="Kamus Metadata Indikator"
        subtitle="Definisi operasional, metodologi, dan standar data makro BPS"
        onMobileMenuOpen={onMobileMenuOpen || (() => {})}
      />
      <div className="page-content" style={{ maxWidth: 1180 }}>
        <div className="filter-bar">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Cari definisi, indikator, atau kode..."
          />
        </div>

        {datasets.length === 0 ? (
          <div className="section">
            <EmptyState
              icon={<BookOpen size={40} />}
              title={search ? 'Tidak Ada Metadata yang Cocok' : 'Belum Ada Metadata'}
              description={
                search
                  ? 'Coba gunakan kata kunci pencarian yang lain.'
                  : 'Metadata indikator akan otomatis tersedia setelah dataset didaftarkan.'
              }
            />
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 18,
            }}
          >
            {datasets.map((ds) => (
              <div
                key={ds.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--slate-200)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                  boxShadow: 'var(--shadow-subtle)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontFamily: 'monospace',
                      }}
                    >
                      {ds.code}
                    </span>
                    <StatusBadge status={ds.status} size="sm" />
                  </div>

                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#0f172a',
                      margin: '0 0 8px',
                      lineHeight: 1.35,
                    }}
                  >
                    {ds.name}
                  </h3>

                  <p
                    style={{
                      fontSize: 13,
                      color: '#475569',
                      margin: '0 0 14px',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {ds.definition || ds.description || 'Definisi operasional belum ditambahkan.'}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#64748b' }}>
                    <div>
                      <Layers size={12} style={{ display: 'inline', marginRight: 5 }} />
                      Kategori: <strong style={{ color: '#334155' }}>{ds.category}</strong>
                    </div>
                    <div>
                      <Building2 size={12} style={{ display: 'inline', marginRight: 5 }} />
                      Satuan: <strong style={{ color: '#334155' }}>{ds.unit}</strong> • Wilayah: <strong style={{ color: '#334155' }}>{ds.geographic_scope}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--slate-150)', paddingTop: 14 }}>
                  <Link href={`/datasets/${ds.id}`}>
                    <Button variant="ghost" size="sm" icon={<ArrowRight size={13} />} style={{ width: '100%', justifyContent: 'center' }}>
                      Buka Detail Metadata & Data
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
