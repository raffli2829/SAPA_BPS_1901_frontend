'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import {
  Button,
  StatusBadge,
  Tabs,
  Modal,
  EmptyState,
  Toast,
  TableSkeleton,
} from '@/components/ui';
import EditDatasetModal from '@/components/datasets/EditDatasetModal';
import {
  DatasetRepo,
  RecordRepo,
  ReviewRepo,
  AuditRepo,
  subscribe,
} from '@/lib/repository';
import {
  Dataset,
  DataRecord,
  DataStatus,
  AuditLog,
  AuditAction,
  TabValue,
} from '@/lib/types';
import { formatDate, formatDateShort, formatNumber } from '@/lib/utils';
import {
  Plus,
  Send,
  CheckCircle,
  XCircle,
  Archive,
  ArrowLeft,
  Trash2,
  RotateCcw,
  Database,
  Layers,
  MapPin,
  Calendar,
  Building2,
  Sparkles,
  Pencil,
  AlertCircle,
} from 'lucide-react';

interface ConfirmAction {
  title: string;
  description: string;
  action: () => void;
  variant: 'default' | 'danger';
  confirmLabel: string;
}

export default function DatasetDetailPage() {
  const { isAuthenticated, isLoading, user, isReviewer } = useAuth();
  const router = useRouter();
  const params = useParams();
  const datasetId = params.id as string;

  const [dataset, setDataset] = useState<Dataset | null>(() => {
    try {
      return DatasetRepo.getById(datasetId) || null;
    } catch {
      return null;
    }
  });
  const [records, setRecords] = useState<DataRecord[]>(() => {
    try {
      return RecordRepo.getByDataset(datasetId);
    } catch {
      return [];
    }
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      return AuditRepo.getByDataset(datasetId);
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('data');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [isEditingDataset, setIsEditingDataset] = useState(false);

  const loadData = useCallback(() => {
    const ds = DatasetRepo.getById(datasetId);
    setDataset(ds || null);
    setRecords(RecordRepo.getByDataset(datasetId));
    setAuditLogs(AuditRepo.getByDataset(datasetId));
    setLoading(false);
  }, [datasetId]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const unsub = subscribe(loadData);
    return unsub;
  }, [isAuthenticated, isLoading, router, loadData]);

  const handleStatusChange = (newStatus: DataStatus, reason?: string) => {
    if (!user || !dataset) return;

    if (newStatus === DataStatus.REVIEW) {
      ReviewRepo.create({
        dataset_id: dataset.id,
        dataset_name: dataset.name,
        record_ids: records.map((r) => r.id),
        description: `Pengajuan review dataset ${dataset.name}`,
        submitted_by: user.id,
        submitted_by_name: user.name,
      });
      setToast({ msg: 'Dataset berhasil diajukan untuk review.', type: 'success' });
    } else if (newStatus === DataStatus.PUBLISHED) {
      DatasetRepo.updateStatus(dataset.id, DataStatus.PUBLISHED, user.id, user.name);
      setToast({ msg: 'Dataset berhasil dipublikasikan.', type: 'success' });
    } else if (newStatus === DataStatus.ARCHIVED) {
      DatasetRepo.updateStatus(dataset.id, DataStatus.ARCHIVED, user.id, user.name);
      setToast({ msg: 'Dataset berhasil diarsipkan.', type: 'success' });
    } else if (newStatus === DataStatus.DRAFT) {
      DatasetRepo.updateStatus(dataset.id, DataStatus.DRAFT, user.id, user.name, reason);
      setToast({ msg: 'Dataset dikembalikan ke draft.', type: 'success' });
    }

    setConfirmAction(null);
  };

  const handleDeleteRecord = (recordId: string) => {
    if (!user) return;
    RecordRepo.delete(recordId, user.id, user.name);
    setToast({ msg: 'Data berhasil dihapus.', type: 'success' });
  };

  const handleSaveEditRecord = (
    data: { period: string; value: number | null; notes: string },
    reason: string
  ) => {
    if (!user || !editingRecord) return;
    RecordRepo.update(
      editingRecord.id,
      {
        period: data.period,
        value: data.value,
        notes: data.notes,
      },
      user.id,
      user.name,
      reason
    );
    setToast({
      msg: `Data ${editingRecord.indicator} (${data.period}) berhasil dikoreksi!`,
      type: 'success',
    });
    setEditingRecord(null);
  };

  const handleDeleteDataset = () => {
    if (!user || !dataset) return;
    try {
      DatasetRepo.delete(dataset.id, user.id, user.name);
      router.push('/datasets');
    } catch {
      setToast({ msg: 'Gagal menghapus dataset.', type: 'error' });
    }
  };

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <PageContent
        dataset={dataset}
        records={records}
        auditLogs={auditLogs}
        loading={loading}
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as TabValue)}
        isReviewer={isReviewer}
        onStatusChange={handleStatusChange}
        onDeleteRecord={handleDeleteRecord}
        onEditRecord={(rec) => setEditingRecord(rec)}
        onEditDataset={() => setIsEditingDataset(true)}
        confirmAction={confirmAction}
        setConfirmAction={setConfirmAction}
        onDeleteDataset={handleDeleteDataset}
      />
      {isEditingDataset && dataset && (
        <EditDatasetModal
          dataset={dataset}
          open={isEditingDataset}
          onClose={() => setIsEditingDataset(false)}
          onSuccess={(updated) => {
            setDataset(updated);
            setToast({
              msg: `Dataset "${updated.name}" berhasil diperbarui.`,
              type: 'success',
            });
            loadData();
          }}
        />
      )}
      {editingRecord && dataset && (
        <EditRecordModal
          record={editingRecord}
          dataset={dataset}
          onClose={() => setEditingRecord(null)}
          onSave={handleSaveEditRecord}
        />
      )}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {confirmAction && (
        <Modal
          open={true}
          onClose={() => setConfirmAction(null)}
          title={confirmAction.title}
          description={confirmAction.description}
          variant={confirmAction.variant}
          actions={
            <>
              <Button variant="secondary" onClick={() => setConfirmAction(null)}>
                Batal
              </Button>
              <Button
                variant={confirmAction.variant === 'danger' ? 'danger' : 'primary'}
                onClick={confirmAction.action}
              >
                {confirmAction.confirmLabel}
              </Button>
            </>
          }
        />
      )}
    </AppLayout>
  );
}

function PageContent({
  dataset,
  records,
  auditLogs,
  loading,
  activeTab,
  onTabChange,
  isReviewer,
  onStatusChange,
  onDeleteRecord,
  onEditRecord,
  onEditDataset,
  confirmAction,
  setConfirmAction,
  onDeleteDataset,
  onMobileMenuOpen,
}: {
  dataset: Dataset | null;
  records: DataRecord[];
  auditLogs: AuditLog[];
  loading: boolean;
  activeTab: TabValue;
  onTabChange: (tab: string) => void;
  isReviewer: boolean;
  onStatusChange: (status: DataStatus, reason?: string) => void;
  onDeleteRecord: (id: string) => void;
  onEditRecord: (rec: DataRecord) => void;
  onEditDataset: () => void;
  confirmAction: ConfirmAction | null;
  setConfirmAction: (action: ConfirmAction | null) => void;
  onDeleteDataset: () => void;
  onMobileMenuOpen?: () => void;
}) {
  if (loading) {
    return (
      <>
        <Header
          title="Memuat dataset..."
          onMobileMenuOpen={onMobileMenuOpen || (() => {})}
        />
        <div className="page-content">
          <TableSkeleton rows={6} cols={5} />
        </div>
      </>
    );
  }

  if (!dataset) {
    return (
      <>
        <Header
          title="Dataset tidak ditemukan"
          onMobileMenuOpen={onMobileMenuOpen || (() => {})}
        />
        <div className="page-content">
          <EmptyState
            icon={<Database size={40} />}
            title="Dataset Tidak Ditemukan"
            description="Dataset yang Anda cari tidak tersedia atau mungkin telah dihapus."
            actions={
              <Link href="/datasets">
                <Button variant="secondary" icon={<ArrowLeft size={14} />}>
                  Kembali ke Katalog
                </Button>
              </Link>
            }
          />
        </div>
      </>
    );
  }

  const actionButtons = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {/* Tombol Edit Dataset selalu dapat diakses untuk mengubah metadata/spesifikasi */}
      <Button
        variant="secondary"
        size="sm"
        icon={<Pencil size={14} />}
        onClick={onEditDataset}
        title="Ubah spesifikasi, nama, atau kategori dataset"
      >
        Edit Dataset
      </Button>

      {dataset.status === DataStatus.DRAFT && (
        <>
          <Link href={`/input?dataset=${dataset.id}`}>
            <Button variant="secondary" size="sm" icon={<Plus size={14} />}>
              Tambah Data
            </Button>
          </Link>
          <Button
            variant="success"
            size="sm"
            icon={<CheckCircle size={14} />}
            onClick={() =>
              setConfirmAction({
                title: 'Publikasikan Dataset Sekarang?',
                description:
                  'Dataset ini akan langsung dipublikasikan secara resmi ke sistem data makro BPS dan tersinkronisasi ke chatbot WhatsApp.',
                action: () => onStatusChange(DataStatus.PUBLISHED),
                variant: 'default',
                confirmLabel: 'Publikasikan Sekarang',
              })
            }
          >
            Publikasikan Dataset
          </Button>
        </>
      )}
      {dataset.status === DataStatus.REVIEW && (
        <>
          <Button
            variant="success"
            size="sm"
            icon={<CheckCircle size={14} />}
            onClick={() =>
              setConfirmAction({
                title: 'Setujui & Publikasikan?',
                description:
                  'Dataset ini akan dipublikasikan secara resmi ke sistem data makro BPS Kabupaten Bangka.',
                action: () => onStatusChange(DataStatus.PUBLISHED),
                variant: 'default',
                confirmLabel: 'Setujui & Publikasikan',
              })
            }
          >
            Setujui & Publikasikan
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<XCircle size={14} />}
            onClick={() =>
              setConfirmAction({
                title: 'Kembalikan ke Draf?',
                description: 'Dataset akan dikembalikan ke status draf untuk diperbaiki.',
                action: () => onStatusChange(DataStatus.DRAFT, 'Perlu perbaikan data'),
                variant: 'danger',
                confirmLabel: 'Kembalikan ke Draf',
              })
            }
          >
            Kembalikan ke Draf
          </Button>
        </>
      )}
      {dataset.status === DataStatus.PUBLISHED && (
        <>
          <Link href={`/input?dataset=${dataset.id}`}>
            <Button variant="secondary" size="sm" icon={<Plus size={14} />}>
              Tambah Baris Data Baru
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            icon={<Archive size={14} />}
            onClick={() =>
              setConfirmAction({
                title: 'Arsipkan Dataset Ini?',
                description:
                  'Dataset ini akan dipindahkan ke arsip dan tidak lagi berstatus aktif.',
                action: () => onStatusChange(DataStatus.ARCHIVED),
                variant: 'danger',
                confirmLabel: 'Arsipkan',
              })
            }
          >
            Arsipkan
          </Button>
        </>
      )}

      {/* Jika status saat ini adalah DIARSIPKAN (ARCHIVED), sediakan opsi Publikasikan Ulang & Pulihkan ke Draf */}
      {dataset.status === DataStatus.ARCHIVED && (
        <>
          <Button
            variant="primary"
            size="sm"
            icon={<CheckCircle size={14} />}
            onClick={() =>
              setConfirmAction({
                title: 'Publikasikan Ulang Dataset?',
                description:
                  'Dataset ini akan diaktifkan kembali dari arsip dan langsung dipublikasikan ke katalog serta layanan chatbot SAPA BPS.',
                action: () => onStatusChange(DataStatus.PUBLISHED),
                variant: 'default',
                confirmLabel: 'Publikasikan Ulang',
              })
            }
          >
            Publikasikan Ulang
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCcw size={14} />}
            onClick={() =>
              setConfirmAction({
                title: 'Pulihkan ke Status Draf?',
                description:
                  'Dataset akan dikembalikan ke status draf sehingga Anda dapat memperbarui data atau mengeditnya terlebih dahulu sebelum dipublikasikan.',
                action: () => onStatusChange(DataStatus.DRAFT, 'Dipulihkan dari arsip'),
                variant: 'default',
                confirmLabel: 'Pulihkan ke Draf',
              })
            }
          >
            Pulihkan ke Draf
          </Button>
        </>
      )}

      {/* Opsi Hapus Dataset jika salah buat */}
      <Button
        variant="danger"
        size="sm"
        icon={<Trash2 size={14} />}
        onClick={() =>
          setConfirmAction({
            title: `Hapus Dataset "${dataset.name}"?`,
            description:
              'Dataset ini beserta seluruh baris datanya akan dihapus dari sistem. Gunakan opsi ini jika Anda salah membuat dataset.',
            action: onDeleteDataset,
            variant: 'danger',
            confirmLabel: 'Hapus Dataset',
          })
        }
      >
        Hapus Dataset
      </Button>
    </div>
  );

  return (
    <>
      <Header
        title={dataset.name}
        subtitle={`${dataset.code} • ${dataset.category}`}
        backHref="/datasets"
        onMobileMenuOpen={onMobileMenuOpen || (() => {})}
        actions={actionButtons}
      />
      <div className="page-content">
        {/* Detail Hero Header */}
        <div className="detail-header">
          <div className="detail-top-row">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#f1f5f9',
                    color: '#1e293b',
                    fontFamily: 'monospace',
                  }}
                >
                  {dataset.code}
                </span>
                <StatusBadge status={dataset.status} />
              </div>
              <h1 className="detail-title">{dataset.name}</h1>
              {dataset.description && (
                <p className="detail-subtitle">{dataset.description}</p>
              )}
            </div>
          </div>

          <div className="detail-meta">
            <div className="detail-meta-item">
              <span className="detail-meta-label">
                <Layers size={12} style={{ display: 'inline', marginRight: 4 }} />
                Kategori
              </span>
              <span className="detail-meta-value">{dataset.category}</span>
            </div>
            <div className="detail-meta-item">
              <span className="detail-meta-label">
                <Building2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                Sumber Data
              </span>
              <span className="detail-meta-value">{dataset.source}</span>
            </div>
            <div className="detail-meta-item">
              <span className="detail-meta-label">
                <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} />
                Satuan Ukuran
              </span>
              <span className="detail-meta-value">{dataset.unit}</span>
            </div>
            <div className="detail-meta-item">
              <span className="detail-meta-label">
                <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                Wilayah
              </span>
              <span className="detail-meta-value">{dataset.geographic_scope}</span>
            </div>
            <div className="detail-meta-item">
              <span className="detail-meta-label">
                <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                Terakhir Update
              </span>
              <span className="detail-meta-value">
                {formatDateShort(dataset.updated_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          tabs={[
            { value: 'data', label: 'Tabel Data Statistik', count: records.length },
            { value: 'metadata', label: 'Informasi Metadata' },
            { value: 'history', label: 'Riwayat Audit Perubahan', count: auditLogs.length },
          ]}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />

        <div>
          {activeTab === 'data' && (
            <DataTab
              records={records}
              dataset={dataset}
              onDeleteRecord={onDeleteRecord}
              onEditRecord={onEditRecord}
              setConfirmAction={setConfirmAction}
            />
          )}
          {activeTab === 'metadata' && (
            <MetadataTab dataset={dataset} onOpenEditDataset={onEditDataset} />
          )}
          {activeTab === 'history' && <HistoryTab logs={auditLogs} />}
        </div>
      </div>
    </>
  );
}

// --- Data Tab ---
function DataTab({
  records,
  dataset,
  onDeleteRecord,
  onEditRecord,
  setConfirmAction,
}: {
  records: DataRecord[];
  dataset: Dataset;
  onDeleteRecord: (id: string) => void;
  onEditRecord: (rec: DataRecord) => void;
  setConfirmAction: (action: ConfirmAction | null) => void;
}) {
  if (records.length === 0) {
    return (
      <div className="section">
        <EmptyState
          icon={<Database size={36} />}
          title="Belum ada baris data"
          description="Dataset ini belum memiliki data. Masukkan data statistik melalui formulir atau salin-tempel spreadsheet."
          actions={
            <Link href={`/input?dataset=${dataset.id}`}>
              <Button icon={<Plus size={14} />}>Tambah Data Pertama</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="data-table-wrapper">
      <table className="data-table data-table-sticky">
        <thead>
          <tr>
            <th>Indikator</th>
            <th>Wilayah</th>
            <th>Periode</th>
            <th className="cell-numeric">Nilai ({dataset.unit})</th>
            <th>Catatan Metodologi</th>
            <th style={{ width: 88, textAlign: 'center' }}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {records.map((rec) => (
            <tr key={rec.id}>
              <td style={{ fontWeight: 600, color: '#0f172a' }}>{rec.indicator}</td>
              <td>{rec.region}</td>
              <td>
                <span
                  style={{
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: '#f1f5f9',
                    fontSize: 12,
                  }}
                >
                  {rec.period}
                </span>
              </td>
              <td className="cell-numeric">
                <span style={{ fontWeight: 700, color: '#1d4ed8', fontSize: 13.5 }}>
                  {formatNumber(rec.value)}
                </span>
              </td>
              <td style={{ fontSize: 12, color: '#64748b' }}>
                {rec.notes || '—'}
              </td>
              <td className="cell-actions" style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="spreadsheet-delete-btn"
                    style={{ color: '#2563eb', background: '#eff6ff' }}
                    title="Koreksi Nilai / Perbaiki Typo"
                    onClick={() => onEditRecord(rec)}
                  >
                    <Pencil size={13} />
                  </button>
                  {dataset.status === DataStatus.DRAFT && (
                    <button
                      type="button"
                      className="spreadsheet-delete-btn"
                      title="Hapus baris data"
                      onClick={() =>
                        setConfirmAction({
                          title: 'Hapus data ini?',
                          description: `Data "${rec.indicator}" untuk periode ${rec.period} akan dihapus dari dataset.`,
                          action: () => onDeleteRecord(rec.id),
                          variant: 'danger',
                          confirmLabel: 'Hapus Data',
                        })
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Metadata Tab ---
function MetadataTab({
  dataset,
  onOpenEditDataset,
}: {
  dataset: Dataset;
  onOpenEditDataset?: () => void;
}) {
  return (
    <div className="section">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--slate-200)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
            Spesifikasi & Informasi Metadata
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
            Detail teknis, definisi operasional, dan parameter statistik data makro
          </p>
        </div>
        {onOpenEditDataset && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Pencil size={13} />}
            onClick={onOpenEditDataset}
          >
            Edit Metadata
          </Button>
        )}
      </div>
      <div className="section-body">
        <div className="metadata-grid">
          <div className="metadata-item">
            <span className="metadata-label">Kode Indikator</span>
            <span className="metadata-value font-mono" style={{ fontWeight: 600 }}>{dataset.code}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Nama Indikator</span>
            <span className="metadata-value">{dataset.name}</span>
          </div>
          <div className="metadata-item" style={{ gridColumn: '1 / -1' }}>
            <span className="metadata-label">Definisi Konsep</span>
            <span className="metadata-value">{dataset.definition || 'Tidak ada catatan definisi operasional.'}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Kategori</span>
            <span className="metadata-value">{dataset.category}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Satuan Nilai</span>
            <span className="metadata-value">{dataset.unit}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Cakupan Wilayah</span>
            <span className="metadata-value">{dataset.geographic_scope}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Tipe Frekuensi Periode</span>
            <span className="metadata-value">
              {dataset.period_type === 'YEARLY'
                ? 'Tahunan (Yearly)'
                : dataset.period_type === 'QUARTERLY'
                ? 'Triwulanan (Quarterly)'
                : 'Bulanan (Monthly)'}
            </span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Sumber Data</span>
            <span className="metadata-value">{dataset.source}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Tanggal Dibuat</span>
            <span className="metadata-value">{formatDate(dataset.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- History Tab ---
function HistoryTab({ logs }: { logs: AuditLog[] }) {
  const actionLabels: Record<AuditAction, string> = {
    [AuditAction.CREATE]: 'Membuat',
    [AuditAction.UPDATE]: 'Memperbarui',
    [AuditAction.DELETE]: 'Menghapus',
    [AuditAction.STATUS_CHANGE]: 'Mengubah Status',
    [AuditAction.SUBMIT_REVIEW]: 'Mengajukan Review',
    [AuditAction.APPROVE]: 'Menyetujui',
    [AuditAction.REJECT]: 'Menolak',
    [AuditAction.PUBLISH]: 'Mempublikasikan',
    [AuditAction.ARCHIVE]: 'Mengarsipkan',
    [AuditAction.VERIFY_ANOMALY]: 'Verifikasi Data',
  };

  if (logs.length === 0) {
    return (
      <div className="section">
        <EmptyState
          title="Belum ada riwayat audit"
          description="Log aktivitas perubahan akan tercatat otomatis saat dataset dimodifikasi."
        />
      </div>
    );
  }

  return (
    <div className="section">
      <div className="section-body">
        <div className="timeline">
          {logs.map((log) => (
            <div key={log.id} className="timeline-item">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-date">{formatDate(log.created_at)}</div>
                <div className="timeline-user">{log.user_name}</div>
                <div className="timeline-action">
                  <strong>{actionLabels[log.action] || log.action}</strong>: {log.entity_name}
                  {log.changes.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {log.changes.map((c, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#64748b' }}>
                          <span style={{ fontWeight: 600 }}>{c.field}</span>: {c.old_value !== null ? String(c.old_value) : '(kosong)'}{' '}
                          → <span style={{ color: '#16a34a', fontWeight: 600 }}>{c.new_value !== null ? String(c.new_value) : '(kosong)'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {log.reason && (
                  <div className="timeline-reason">Alasan: {log.reason}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Edit Record Modal (Koreksi Typo Data Terbit / Draf) ---
function EditRecordModal({
  record,
  dataset,
  onClose,
  onSave,
}: {
  record: DataRecord;
  dataset: Dataset;
  onClose: () => void;
  onSave: (data: { period: string; value: number | null; notes: string }, reason: string) => void;
}) {
  const [period, setPeriod] = useState(record.period);
  const [value, setValue] = useState(record.value !== null && record.value !== undefined ? String(record.value) : '');
  const [notes, setNotes] = useState(record.notes || '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!period.trim()) {
      setError('Periode wajib diisi');
      return;
    }
    const numVal = value.trim() === '' ? null : Number(value.replace(',', '.'));
    if (value.trim() !== '' && isNaN(numVal!)) {
      setError('Nilai angka tidak valid. Gunakan tanda titik untuk desimal.');
      return;
    }
    if (dataset.status === DataStatus.PUBLISHED && !reason.trim()) {
      setError('Alasan koreksi data terbit wajib diisi untuk catatan audit trail.');
      return;
    }

    onSave(
      {
        period: period.trim(),
        value: numVal,
        notes: notes.trim(),
      },
      reason.trim() || 'Koreksi perbaikan data'
    );
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Koreksi Data Statistik"
      description={`Koreksi angka atau catatan untuk ${record.indicator} (${record.region}).`}
    >
      <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
        {dataset.status === DataStatus.PUBLISHED && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              color: '#1e40af',
              marginBottom: 14,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              lineHeight: 1.5,
            }}
          >
            <AlertCircle size={15} style={{ marginTop: 2, flexShrink: 0, color: '#2563eb' }} />
            <div>
              <strong>Perhatian:</strong> Dataset ini berstatus <strong>PUBLISHED</strong>.
              Setiap perbaikan angka (koreksi typo) akan langsung ter-update di website, tersinkronisasi ke chatbot WhatsApp, dan dicatat pada riwayat audit.
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              Wilayah
            </label>
            <input
              type="text"
              value={record.region}
              disabled
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#64748b',
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              Satuan
            </label>
            <input
              type="text"
              value={record.unit}
              disabled
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#64748b',
                fontSize: 13,
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              Periode / Tahun <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="Contoh: 2025"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              Nilai Angka <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Contoh: 75.38"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                outline: 'none',
                fontWeight: 700,
                color: '#1d4ed8',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
            Catatan Metodologi
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Keterangan tambahan (opsional)"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
            Alasan Koreksi / Perbaikan Typo {dataset.status === DataStatus.PUBLISHED && <span style={{ color: '#ef4444' }}>*</span>}
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Perbaikan salah ketik digit desimal / revisi angka resmi BPS"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, fontWeight: 500 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="secondary" type="button" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" type="submit">
            Simpan Koreksi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
