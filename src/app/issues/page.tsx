'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button, Toast, EmptyState } from '@/components/ui';
import { DatasetRepo, RecordRepo, subscribe } from '@/lib/repository';
import { Dataset, DataRecord, DataStatus } from '@/lib/types';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Search,
  Filter,
  ShieldAlert,
  Database,
  Info,
  ExternalLink,
} from 'lucide-react';

interface AnomalyItem {
  id: string;
  recordId: string;
  datasetId: string;
  datasetName: string;
  datasetCode: string;
  indicator: string;
  region: string;
  period: string;
  prevPeriod: string;
  currentValue: number;
  prevValue: number;
  unit: string;
  changePercent: number;
  isConfirmed: boolean;
  notes: string;
  type: 'SPIKE_HIGH' | 'DROP_LOW' | 'DUPLICATE';
}

export default function AnomalyPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  const [datasets, setDatasets] = useState<Dataset[]>(() => {
    try {
      return DatasetRepo.getAll().filter((d) => d.status !== DataStatus.ARCHIVED);
    } catch {
      return [];
    }
  });

  const [allRecords, setAllRecords] = useState<DataRecord[]>(() => {
    try {
      return RecordRepo.getAll().filter((r) => !r.is_deleted);
    } catch {
      return [];
    }
  });

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'CONFIRMED'>('ALL');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Modal Note for approval
  const [approveTarget, setApproveTarget] = useState<AnomalyItem | null>(null);
  const [approvalNote, setApprovalNote] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    function loadData() {
      setDatasets(DatasetRepo.getAll().filter((d) => d.status !== DataStatus.ARCHIVED));
      setAllRecords(RecordRepo.getAll().filter((r) => !r.is_deleted));
    }

    const unsub = subscribe(loadData);
    return unsub;
  }, [isAuthenticated, isLoading, router]);

  // Comprehensive anomaly detection logic
  const anomalies = useMemo(() => {
    const list: AnomalyItem[] = [];

    datasets.forEach((ds) => {
      const dsRecords = allRecords
        .filter((r) => r.dataset_id === ds.id && r.value !== null && !isNaN(r.value))
        .sort((a, b) => a.period.localeCompare(b.period));

      // Group records by indicator & region
      const groups = new Map<string, DataRecord[]>();
      dsRecords.forEach((r) => {
        const key = `${r.indicator}|${r.region}`;
        const existing = groups.get(key) || [];
        existing.push(r);
        groups.set(key, existing);
      });

      groups.forEach((groupRecords) => {
        for (let i = 1; i < groupRecords.length; i++) {
          const prev = groupRecords[i - 1];
          const curr = groupRecords[i];

          if (prev.value !== null && curr.value !== null && prev.value !== 0) {
            const diff = curr.value - prev.value;
            const changePercent = (diff / Math.abs(prev.value)) * 100;

            // Threshold: Fluktuasi signifikan > 25%
            if (Math.abs(changePercent) >= 25) {
              const isConfirmed = curr.notes?.includes('[Dikonfirmasi Valid]') || false;
              list.push({
                id: `anomaly-${curr.id}`,
                recordId: curr.id,
                datasetId: ds.id,
                datasetName: ds.name,
                datasetCode: ds.code,
                indicator: curr.indicator,
                region: curr.region,
                period: curr.period,
                prevPeriod: prev.period,
                currentValue: curr.value,
                prevValue: prev.value,
                unit: curr.unit || ds.unit,
                changePercent,
                isConfirmed,
                notes: curr.notes || '',
                type: changePercent > 0 ? 'SPIKE_HIGH' : 'DROP_LOW',
              });
            }
          }
        }
      });
    });

    return list.sort((a, b) => (a.isConfirmed === b.isConfirmed ? Math.abs(b.changePercent) - Math.abs(a.changePercent) : a.isConfirmed ? 1 : -1));
  }, [datasets, allRecords]);

  // Filtered anomalies
  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((item) => {
      const matchSearch =
        item.datasetName.toLowerCase().includes(search.toLowerCase()) ||
        item.indicator.toLowerCase().includes(search.toLowerCase()) ||
        item.datasetCode.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filterStatus === 'ALL' ||
        (filterStatus === 'PENDING' && !item.isConfirmed) ||
        (filterStatus === 'CONFIRMED' && item.isConfirmed);
      return matchSearch && matchFilter;
    });
  }, [anomalies, search, filterStatus]);

  // Action: Setujui Verifikasi Data
  const handleApprove = (item: AnomalyItem) => {
    setApproveTarget(item);
    setApprovalNote('Data riil terverifikasi sesuai hasil pendataan lapangan resmi BPS');
  };

  const submitApprove = () => {
    if (!approveTarget || !user) return;
    try {
      RecordRepo.confirmAnomaly(approveTarget.recordId, user.id, user.name, approvalNote);
      setToast({
        msg: `Data periode ${approveTarget.period} berhasil diverifikasi sebagai data valid.`,
        type: 'success',
      });
      setApproveTarget(null);
    } catch {
      setToast({ msg: 'Gagal memverifikasi data.', type: 'error' });
    }
  };

  // Action: Hapus Data Bug/Salah Input
  const handleDelete = (item: AnomalyItem) => {
    if (
      confirm(
        `HAPUS DATA VERIFIKASI?\n\nIndikator: ${item.indicator} (${item.period})\nNilai: ${item.currentValue.toLocaleString('id-ID')} ${item.unit}\n\nData ini akan dihapus permanen dari dataset jika memang salah input.`
      )
    ) {
      if (!user) return;
      try {
        RecordRepo.delete(item.recordId, user.id, user.name);
        setToast({ msg: `Data periode ${item.period} berhasil dihapus dari sistem.`, type: 'success' });
      } catch {
        setToast({ msg: 'Gagal menghapus data.', type: 'error' });
      }
    }
  };

  const pendingCount = anomalies.filter((a) => !a.isConfirmed).length;
  const confirmedCount = anomalies.filter((a) => a.isConfirmed).length;

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <Header
        title="Verifikasi Data"
        subtitle="Pemeriksaan dan persetujuan data statistik lapangan yang mengalami fluktuasi signifikan"
      />

      <div className="page-content" style={{ maxWidth: 1180 }}>
        {/* Top Metric Overview */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-xl)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Total Perlu Verifikasi
              </p>
              <h3 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 0', color: 'var(--slate-900)' }}>
                {anomalies.length} Data
              </h3>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: '#fff7ed',
                color: '#c2410c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldAlert size={22} />
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-xl)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Perlu Konfirmasi / Aksi
              </p>
              <h3 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 0', color: pendingCount > 0 ? '#b91c1c' : '#059669' }}>
                {pendingCount} Peringatan
              </h3>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: pendingCount > 0 ? '#fef2f2' : '#ecfdf5',
                color: pendingCount > 0 ? '#b91c1c' : '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={22} />
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-xl)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Dikonfirmasi Valid Lapangan
              </p>
              <h3 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 0', color: '#059669' }}>
                {confirmedCount} Disetujui
              </h3>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>

        {/* Section List Verifikasi Data */}
        <div className="section">
          <div className="section-header" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 className="section-title">
                <ShieldCheck size={18} style={{ color: 'var(--primary-600)' }} />
                Daftar Verifikasi Data Statistik
              </h2>
              <p className="section-subtitle">
                Data dengan fluktuasi signifikan (&gt; 25%) ditampilkan untuk diverifikasi keabsahannya sesuai data riil lapangan
              </p>
            </div>

            {/* Filter Tabs & Search */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 220 }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }}
                />
                <input
                  type="text"
                  className="text-input"
                  placeholder="Cari dataset / indikator..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 32, height: 36, fontSize: 12.5 }}
                />
              </div>

              <div style={{ display: 'flex', background: 'var(--slate-100)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                <button
                  type="button"
                  onClick={() => setFilterStatus('ALL')}
                  style={{
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: filterStatus === 'ALL' ? '#ffffff' : 'transparent',
                    color: filterStatus === 'ALL' ? 'var(--primary-700)' : 'var(--slate-600)',
                    boxShadow: filterStatus === 'ALL' ? 'var(--shadow-subtle)' : 'none',
                  }}
                >
                  Semua ({anomalies.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('PENDING')}
                  style={{
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: filterStatus === 'PENDING' ? '#ffffff' : 'transparent',
                    color: filterStatus === 'PENDING' ? '#b91c1c' : 'var(--slate-600)',
                    boxShadow: filterStatus === 'PENDING' ? 'var(--shadow-subtle)' : 'none',
                  }}
                >
                  Perlu Aksi ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('CONFIRMED')}
                  style={{
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: filterStatus === 'CONFIRMED' ? '#ffffff' : 'transparent',
                    color: filterStatus === 'CONFIRMED' ? '#059669' : 'var(--slate-600)',
                    boxShadow: filterStatus === 'CONFIRMED' ? 'var(--shadow-subtle)' : 'none',
                  }}
                >
                  Disetujui ({confirmedCount})
                </button>
              </div>
            </div>
          </div>

          <div className="section-body">
            {filteredAnomalies.length === 0 ? (
              <EmptyState
                title="Semua Data Terverifikasi"
                description={
                  search
                    ? `Tidak ada data yang cocok dengan pencarian "${search}".`
                    : 'Seluruh data statistik telah terverifikasi dan berjalan normal tanpa fluktuasi ekstrem.'
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredAnomalies.map((item) => {
                  const isPositive = item.changePercent > 0;

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: '#ffffff',
                        border: item.isConfirmed
                          ? '1px solid var(--slate-200)'
                          : isPositive
                          ? '1px solid #fecaca'
                          : '1px solid #fed7aa',
                        borderRadius: 'var(--radius-xl)',
                        padding: '20px',
                        boxShadow: 'var(--shadow-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                      }}
                    >
                      {/* Top Header: Dataset Info & Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                background: 'var(--primary-50)',
                                color: 'var(--primary-700)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--primary-100)',
                              }}
                            >
                              {item.datasetCode}
                            </span>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>
                              {item.datasetName}
                            </h4>
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--slate-600)' }}>
                            Indikator: <strong>{item.indicator}</strong> • Wilayah: {item.region}
                          </p>
                        </div>

                        <div>
                          {item.isConfirmed ? (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#047857',
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                padding: '4px 10px',
                                borderRadius: 999,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <CheckCircle2 size={13} /> Dikonfirmasi Valid Lapangan
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#b45309',
                                background: '#fffbeb',
                                border: '1px solid #fde68a',
                                padding: '4px 10px',
                                borderRadius: 999,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <AlertTriangle size={13} /> Peringatan: Perlu Konfirmasi
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Comparison Metric Box */}
                      <div
                        style={{
                          background: item.isConfirmed ? '#f8fafc' : '#fffbf7',
                          border: '1px solid var(--slate-150)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '16px',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: 16,
                          alignItems: 'center',
                        }}
                      >
                        {/* Nilai Sebelumnya */}
                        <div>
                          <span style={{ fontSize: 11.5, color: 'var(--slate-500)', fontWeight: 500 }}>
                            Periode {item.prevPeriod} (Sebelumnya)
                          </span>
                          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--slate-700)', marginTop: 2 }}>
                            {item.prevValue.toLocaleString('id-ID')} <span style={{ fontSize: 13, fontWeight: 500 }}>{item.unit}</span>
                          </div>
                        </div>

                        {/* Indikator Lonjakan / Perubahan */}
                        <div style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: isPositive ? '#b91c1c' : '#c2410c',
                              background: isPositive ? '#fef2f2' : '#fff7ed',
                              border: isPositive ? '1px solid #fecaca' : '1px solid #fed7aa',
                              padding: '6px 14px',
                              borderRadius: 999,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            {isPositive ? '+' : ''}
                            {item.changePercent.toFixed(1)}% ({isPositive ? 'Lonjakan' : 'Penurunan'} Signifikan)
                          </span>
                        </div>

                        {/* Nilai Terkini (Perlu Verifikasi) */}
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 11.5, color: 'var(--slate-500)', fontWeight: 500 }}>
                            Periode {item.period} (Terkini)
                          </span>
                          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--slate-900)', marginTop: 2 }}>
                            {item.currentValue.toLocaleString('id-ID')} <span style={{ fontSize: 13, fontWeight: 500 }}>{item.unit}</span>
                          </div>
                        </div>
                      </div>

                      {/* Catatan / Alasan jika ada */}
                      {item.notes && (
                        <div style={{ fontSize: 12, color: 'var(--slate-600)', background: 'var(--slate-50)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                          <strong>Catatan Data:</strong> {item.notes}
                        </div>
                      )}

                      {/* Interactive Actions: Setujui Data vs Hapus Data */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10,
                          borderTop: '1px solid var(--slate-150)',
                          paddingTop: 14,
                        }}
                      >
                        <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>
                          {item.isConfirmed ? (
                            <span style={{ color: '#059669', fontWeight: 500 }}>
                              ✓ Data telah diverifikasi dan dipastikan bukan kesalahan input.
                            </span>
                          ) : (
                            <span style={{ color: '#b45309' }}>
                              ⚠️ Fluktuasi nilai signifikan terdeteksi. Silakan periksa atau setujui jika data valid.
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Link href={`/datasets/${item.datasetId}`}>
                            <Button variant="ghost" size="sm" icon={<ExternalLink size={13} />}>
                              Lihat Dataset
                            </Button>
                          </Link>

                          {!item.isConfirmed && (
                            <Button
                              variant="success"
                              size="sm"
                              icon={<CheckCircle2 size={13} />}
                              onClick={() => handleApprove(item)}
                            >
                              Setujui Data (Valid)
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Verifikasi Data */}
      {approveTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 16,
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setApproveTarget(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 500,
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--slate-900)' }}>
                  Konfirmasi Verifikasi Data Lapangan
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--slate-500)' }}>
                  Menyatakan angka periode {approveTarget.period} adalah data riil resmi BPS
                </p>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 13, lineHeight: 1.5 }}>
              <div><strong>Dataset:</strong> {approveTarget.datasetName}</div>
              <div><strong>Indikator:</strong> {approveTarget.indicator} ({approveTarget.period})</div>
              <div><strong>Nilai:</strong> {approveTarget.currentValue.toLocaleString('id-ID')} {approveTarget.unit} ({approveTarget.changePercent > 0 ? '+' : ''}{approveTarget.changePercent.toFixed(1)}%)</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="input-label" htmlFor="appnote">
                Keterangan / Catatan Verifikasi Resmi BPS
              </label>
              <textarea
                id="appnote"
                rows={3}
                className="textarea-input"
                placeholder="Misal: Peningkatan tajam terjadi karena pembukaan sektor tambang/industri baru pada tahun bersangkutan..."
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
              />
            </div>

            <div className="form-actions" style={{ margin: 0, paddingTop: 16 }}>
              <Button variant="secondary" size="md" onClick={() => setApproveTarget(null)}>
                Batal
              </Button>
              <Button variant="success" size="md" icon={<CheckCircle2 size={14} />} onClick={submitApprove}>
                Ya, Setujui Data Valid
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AppLayout>
  );
}
