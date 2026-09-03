'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button, StatusBadge, StatCard, TableSkeleton } from '@/components/ui';
import {
  getDashboardSummary,
  DatasetRepo,
  subscribe,
} from '@/lib/repository';
import { Dataset, DashboardSummary } from '@/lib/types';
import { formatDateShort, formatNumber } from '@/lib/utils';
import {
  Plus,
  Database,
  ArrowRight,
  CheckCircle2,
  FileEdit,
  Clock,
  Upload,
  Layers,
  BarChart3,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(() => {
    try {
      return getDashboardSummary();
    } catch {
      return null;
    }
  });
  const [recentDatasets, setRecentDatasets] = useState<Dataset[]>(() => {
    try {
      const all = DatasetRepo.getAll();
      return [...all].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ).slice(0, 6);
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    function loadData() {
      setSummary(getDashboardSummary());
      const all = DatasetRepo.getAll();
      const sorted = [...all].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setRecentDatasets(sorted.slice(0, 6));
      setLoading(false);
    }

    const unsub = subscribe(loadData);
    return unsub;
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <PageContent
        summary={summary}
        recentDatasets={recentDatasets}
        loading={loading}
        userName={user?.name || ''}
      />
    </AppLayout>
  );
}

function PageContent({
  summary,
  recentDatasets,
  loading,
  userName,
  onMobileMenuOpen,
}: {
  summary: DashboardSummary | null;
  recentDatasets: Dataset[];
  loading: boolean;
  userName: string;
  onMobileMenuOpen?: () => void;
}) {
  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Pusat Kendali Data Makro BPS Kabupaten Bangka"
        onMobileMenuOpen={onMobileMenuOpen || (() => {})}
        actions={
          <Link href="/input">
            <Button variant="primary" size="sm" icon={<Plus size={14} />}>
              Input Data
            </Button>
          </Link>
        }
      />

      <div className="page-content">
        {/* Welcome Hero Banner */}
        <div className="welcome-banner">
          <div>
            <div className="welcome-banner-tag">Sistem Manajemen Terpadu</div>
            <h1 className="welcome-banner-title">Selamat datang, {userName}</h1>
            <p className="welcome-banner-desc">
              Kelola, input, validasi, dan pantau publikasi dataset statistik makro Kabupaten Bangka secara akurat dan terstruktur.
            </p>
            <div className="welcome-banner-meta">
              <span>📅 {todayFormatted}</span>
              <span>•</span>
              <span>Kode Wilayah: <strong>1901 (Bangka)</strong></span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/input">
              <Button
                variant="secondary"
                size="md"
                icon={<Plus size={15} />}
                style={{ background: '#ffffff', color: '#1e3a8a', fontWeight: 600 }}
              >
                Tambah Data
              </Button>
            </Link>
            <Link href="/import">
              <Button
                variant="ghost"
                size="md"
                icon={<Upload size={15} />}
                style={{ color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }}
              >
                Import Excel
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <>
            <div className="summary-grid">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="summary-card">
                  <div className="skeleton" style={{ width: '120px', height: '14px' }} />
                  <div className="skeleton" style={{ width: '70px', height: '32px', marginTop: 8 }} />
                </div>
              ))}
            </div>
            <TableSkeleton rows={5} cols={4} />
          </>
        ) : (
          <>
            {/* Metric Summary Cards */}
            {summary && (
              <div className="summary-grid">
                <StatCard
                  label="Total Dataset Aktif"
                  value={summary.total_datasets}
                  icon={<Database size={20} />}
                  iconColor="blue"
                  href="/datasets"
                  footerText="Dataset terdaftar"
                  trendText="Kelola →"
                />
                <StatCard
                  label="Data Terpublikasi"
                  value={formatNumber(summary.published_records)}
                  icon={<CheckCircle2 size={20} />}
                  iconColor="emerald"
                  href="/datasets?status=PUBLISHED"
                  footerText="Telah disetujui & live"
                  trendText="100% Siap"
                />
                <StatCard
                  label="Data Draf (Draft)"
                  value={
                    (summary.draft_datasets || 0) > 0
                      ? `${summary.draft_datasets} Dataset`
                      : formatNumber(summary.draft_records)
                  }
                  icon={<FileEdit size={20} />}
                  iconColor="slate"
                  href="/datasets?status=DRAFT"
                  footerText={
                    summary.draft_records > 0
                      ? `${summary.draft_records} data belum publish`
                      : 'Menunggu kelengkapan data'
                  }
                  trendText="Perlu aksi"
                />
                <StatCard
                  label="Verifikasi Data"
                  value={summary.pending_review > 0 ? `${summary.pending_review} Data` : '0 Data'}
                  icon={<ShieldCheck size={20} />}
                  iconColor="amber"
                  href="/issues"
                  footerText="Perlu verifikasi lapangan"
                  trendText="Verifikasi →"
                />
              </div>
            )}

            {/* Main Content Grid */}
            <div className="section">
              <div className="section-header">
                <div>
                  <h2 className="section-title">
                    <BarChart3 size={18} style={{ color: '#2563eb' }} />
                    Dataset Statistik Terbaru
                  </h2>
                  <p className="section-subtitle">
                    Daftar dataset yang baru saja diperbarui atau ditambahkan ke sistem
                  </p>
                </div>
                <Link href="/datasets">
                  <Button variant="ghost" size="sm" icon={<ArrowRight size={14} />}>
                    Lihat Semua Dataset
                  </Button>
                </Link>
              </div>

              {recentDatasets.length > 0 ? (
                <div className="recent-list">
                  {recentDatasets.map((ds) => (
                    <Link
                      key={ds.id}
                      href={`/datasets/${ds.id}`}
                      className="recent-item"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Layers size={18} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="recent-item-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ds.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                              {ds.code} • {ds.category}
                            </span>
                            <StatusBadge status={ds.status} size="sm" />
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="recent-item-date">
                          Diperbarui {formatDateShort(ds.updated_at)}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginTop: 2 }}>
                          {formatNumber(ds.record_count || 0)} data
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="section-body">
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Database size={36} />
                    </div>
                    <h3 className="empty-state-title">Belum ada dataset aktif</h3>
                    <p className="empty-state-description">
                      Mulai dengan membuat dataset pertama atau lakukan impor data dari file spreadsheet.
                    </p>
                    <div className="empty-state-actions">
                      <Link href="/datasets/new">
                        <Button icon={<Plus size={14} />}>Buat Dataset</Button>
                      </Link>
                      <Link href="/import">
                        <Button variant="secondary" icon={<Upload size={14} />}>Import Data</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
              <Link href="/input">
                <Button variant="primary" icon={<Plus size={14} />}>
                  Tambah Data Cepat
                </Button>
              </Link>
              <Link href="/datasets">
                <Button variant="secondary" icon={<Database size={14} />}>
                  Katalog Dataset
                </Button>
              </Link>
              <Link href="/import">
                <Button variant="secondary" icon={<Upload size={14} />}>
                  Import File Spreadsheet
                </Button>
              </Link>
              <Link href="/review">
                <Button variant="secondary" icon={<Clock size={14} />}>
                  Review Data {summary && summary.pending_review > 0 ? `(${summary.pending_review})` : ''}
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
