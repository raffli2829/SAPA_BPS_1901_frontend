'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { EmptyState, SearchInput, Select } from '@/components/ui';
import { AuditRepo, subscribe } from '@/lib/repository';
import { AuditLog, AuditAction } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { History } from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
  [AuditAction.CREATE]: 'Membuat Data',
  [AuditAction.UPDATE]: 'Memperbarui Data',
  [AuditAction.DELETE]: 'Menghapus Data',
  [AuditAction.STATUS_CHANGE]: 'Mengubah Status',
  [AuditAction.PUBLISH]: 'Mempublikasikan',
  [AuditAction.ARCHIVE]: 'Mengarsipkan',
  [AuditAction.VERIFY_ANOMALY]: 'Verifikasi Data',
};

const FILTER_ACTION_OPTIONS = [
  { value: AuditAction.CREATE, label: 'Membuat Data' },
  { value: AuditAction.UPDATE, label: 'Memperbarui Data' },
  { value: AuditAction.DELETE, label: 'Menghapus Data' },
  { value: AuditAction.STATUS_CHANGE, label: 'Mengubah Status' },
  { value: AuditAction.PUBLISH, label: 'Mempublikasikan' },
  { value: AuditAction.ARCHIVE, label: 'Mengarsipkan' },
  { value: AuditAction.VERIFY_ANOMALY, label: 'Verifikasi Data' },
];

export default function HistoryPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>(() => {
    try {
      return AuditRepo.getAll();
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const loadData = useCallback(() => {
    setLogs(AuditRepo.getAll());
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

  const filtered = logs.filter((log) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !log.entity_name.toLowerCase().includes(q) &&
        !log.user_name.toLowerCase().includes(q)
      )
        return false;
    }
    if (filterAction && log.action !== filterAction) return false;
    return true;
  });

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <PageContent
        logs={filtered}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        filterAction={filterAction}
        onFilterAction={setFilterAction}
      />
    </AppLayout>
  );
}

function PageContent({
  logs,
  search,
  onSearchChange,
  filterAction,
  onFilterAction,
  onMobileMenuOpen,
}: {
  logs: AuditLog[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  filterAction: string;
  onFilterAction: (v: string) => void;
  onMobileMenuOpen?: () => void;
}) {
  return (
    <>
      <Header
        title="Riwayat Audit Perubahan"
        subtitle="Log jejak aktivitas dan modifikasi data statistik"
        onMobileMenuOpen={onMobileMenuOpen || (() => {})}
      />
      <div className="page-content" style={{ maxWidth: 1080 }}>
        {/* Filter bar */}
        <div className="filter-bar">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Cari berdasarkan nama dataset atau operator..."
          />
          <Select
            options={FILTER_ACTION_OPTIONS}
            placeholder="Semua Jenis Tindakan"
            value={filterAction}
            onChange={(e) => onFilterAction(e.target.value)}
          />
        </div>

        {logs.length === 0 ? (
          <div className="section">
            <EmptyState
              icon={<History size={40} />}
              title="Belum Ada Riwayat Audit"
              description={
                search || filterAction
                  ? 'Tidak ada riwayat aktivitas yang sesuai dengan filter pencarian.'
                  : 'Riwayat audit akan terekam secara otomatis ketika ada pembuatan atau perubahan dataset.'
              }
            />
          </div>
        ) : (
          <div className="section">
            <div className="section-body">
              <div className="timeline">
                {logs.map((log) => (
                  <div key={log.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                            }}
                          >
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                          <span className="timeline-user">{log.user_name}</span>
                        </div>
                        <span className="timeline-date">{formatDate(log.created_at)}</span>
                      </div>

                      <div className="timeline-action" style={{ marginTop: 6 }}>
                        <strong style={{ color: '#0f172a' }}>{log.entity_name}</strong>
                        {log.changes.length > 0 && (
                          <div
                            style={{
                              marginTop: 8,
                              background: '#f8fafc',
                              padding: '10px 14px',
                              borderRadius: 6,
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {log.changes.slice(0, 4).map((c, i) => (
                              <div
                                key={i}
                                style={{ fontSize: 12, color: '#475569', marginBottom: 2 }}
                              >
                                <span style={{ fontWeight: 600 }}>{c.field}</span>: {c.old_value !== null ? String(c.old_value) : '(kosong)'}{' '}
                                → <span style={{ color: '#16a34a', fontWeight: 600 }}>{c.new_value !== null ? String(c.new_value) : '(kosong)'}</span>
                              </div>
                            ))}
                            {log.changes.length > 4 && (
                              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                +{log.changes.length - 4} perubahan lainnya
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {log.reason && (
                        <div className="timeline-reason">
                          Alasan: {log.reason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
