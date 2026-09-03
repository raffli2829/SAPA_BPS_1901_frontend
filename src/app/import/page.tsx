'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import {
  Button,
  Select,
  Toast,
  EmptyState,
} from '@/components/ui';
import { DatasetRepo, RecordRepo, subscribe } from '@/lib/repository';
import { Dataset, DataStatus, ColumnMapping } from '@/lib/types';
import {
  FileSpreadsheet,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  FileUp,
  Sparkles,
  Layers,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'done';

const TARGET_FIELDS = [
  { value: '', label: '— Abaikan Kolom Ini —' },
  { value: 'indicator', label: 'Indikator Statistik' },
  { value: 'region', label: 'Wilayah (Kabupaten/Kecamatan)' },
  { value: 'period', label: 'Periode / Tahun' },
  { value: 'value', label: 'Nilai Angka' },
  { value: 'unit', label: 'Satuan' },
  { value: 'notes', label: 'Catatan Metodologi' },
  { value: 'source', label: 'Sumber Data' },
];

const AUTO_MAP: Record<string, string> = {
  tahun: 'period',
  year: 'period',
  periode: 'period',
  wilayah: 'region',
  kabupaten: 'region',
  region: 'region',
  nilai: 'value',
  value: 'value',
  jumlah: 'value',
  angka: 'value',
  satuan: 'unit',
  unit: 'unit',
  indikator: 'indicator',
  indicator: 'indicator',
  catatan: 'notes',
  notes: 'notes',
  sumber: 'source',
  source: 'source',
};

export default function ImportPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [step, setStep] = useState<ImportStep>('upload');
  const [rawData, setRawData] = useState<Record<string, string | number>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [fileName, setFileName] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    function loadData() {
      setDatasets(DatasetRepo.getAll().filter((d) => d.status !== DataStatus.ARCHIVED));
    }
    loadData();
    const unsub = subscribe(loadData);
    return unsub;
  }, [isAuthenticated, isLoading, router]);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  const handleFileSelect = (file: File) => {
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length > 0) {
            const cols = Object.keys(results.data[0] as Record<string, unknown>);
            setSourceColumns(cols);
            setRawData(results.data as Record<string, string | number>[]);
            autoMap(cols);
            setStep('mapping');
          }
        },
        error: () => {
          setToast({ msg: 'Gagal membaca file CSV. Pastikan format file benar.', type: 'error' });
        },
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, string | number>>(firstSheet);

          if (json.length > 0) {
            const cols = Object.keys(json[0]);
            setSourceColumns(cols);
            setRawData(json);
            autoMap(cols);
            setStep('mapping');
          }
        } catch {
          setToast({ msg: 'Gagal membaca file Excel. Pastikan format file benar.', type: 'error' });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setToast({ msg: 'Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv.', type: 'error' });
    }
  };

  const autoMap = (cols: string[]) => {
    const mapped: ColumnMapping[] = cols.map((col) => {
      const lower = col.toLowerCase().trim();
      const match = Object.entries(AUTO_MAP).find(([key]) =>
        lower.includes(key)
      );
      return {
        source_column: col,
        target_field: (match ? match[1] : '') as ColumnMapping['target_field'],
      };
    });
    setMappings(mapped);
  };

  const updateMapping = (index: number, target: string) => {
    setMappings((prev) =>
      prev.map((m, i) =>
        i === index ? { ...m, target_field: target as ColumnMapping['target_field'] } : m
      )
    );
  };

  const getMappedData = () => {
    return rawData.map((row) => {
      const mapped: Record<string, string | number> = {};
      mappings.forEach((m) => {
        if (m.target_field) {
          mapped[m.target_field] = row[m.source_column];
        }
      });
      return mapped;
    });
  };

  const handleSave = () => {
    if (!user || !selectedDataset) return;
    setSaving(true);

    try {
      const mapped = getMappedData();
      const records = mapped.map((row) => ({
        dataset_id: selectedDataset.id,
        indicator: String(row.indicator || selectedDataset.name),
        region: String(row.region || selectedDataset.geographic_scope),
        period: String(row.period || ''),
        value: row.value !== undefined ? parseFloat(String(row.value).replace(/\./g, '').replace(',', '.')) : null,
        unit: String(row.unit || selectedDataset.unit),
        notes: String(row.notes || ''),
        source: String(row.source || selectedDataset.source),
        status: DataStatus.DRAFT,
        created_by: user.id,
        updated_by: user.id,
      }));

      const valid = records.filter((r) => r.period && !isNaN(r.value as number));
      RecordRepo.createBulk(valid, user.name);
      setSavedCount(valid.length);
      setStep('done');
      setToast({ msg: `${valid.length} data berhasil diimport ke dataset.`, type: 'success' });
    } catch {
      setToast({ msg: 'Gagal mengimport data. Coba lagi.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const reset = () => {
    setStep('upload');
    setRawData([]);
    setSourceColumns([]);
    setMappings([]);
    setFileName('');
    setSavedCount(0);
  };

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <PageContent
        datasets={datasets}
        selectedDatasetId={selectedDatasetId}
        selectedDataset={selectedDataset || null}
        onSelectDataset={setSelectedDatasetId}
        step={step}
        setStep={setStep}
        rawData={rawData}
        sourceColumns={sourceColumns}
        mappings={mappings}
        onUpdateMapping={updateMapping}
        getMappedData={getMappedData}
        fileName={fileName}
        fileRef={fileRef}
        onFileSelect={handleFileSelect}
        onDrop={handleDrop}
        onSave={handleSave}
        saving={saving}
        savedCount={savedCount}
        onReset={reset}
      />
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AppLayout>
  );
}

function PageContent({
  datasets,
  selectedDatasetId,
  selectedDataset,
  onSelectDataset,
  step,
  setStep,
  rawData,
  sourceColumns: _sourceColumns,
  mappings,
  onUpdateMapping,
  getMappedData,
  fileName,
  fileRef,
  onFileSelect,
  onDrop,
  onSave,
  saving,
  savedCount,
  onReset,
  onMobileMenuOpen,
}: {
  datasets: Dataset[];
  selectedDatasetId: string;
  selectedDataset: Dataset | null;
  onSelectDataset: (id: string) => void;
  step: ImportStep;
  setStep: (s: ImportStep) => void;
  rawData: Record<string, string | number>[];
  sourceColumns: string[];
  mappings: ColumnMapping[];
  onUpdateMapping: (i: number, target: string) => void;
  getMappedData: () => Record<string, string | number>[];
  fileName: string;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (f: File) => void;
  onDrop: (e: React.DragEvent) => void;
  onSave: () => void;
  saving: boolean;
  savedCount: number;
  onReset: () => void;
  onMobileMenuOpen?: () => void;
}) {
  return (
    <>
      <Header
        title="Import Data Excel / CSV"
        subtitle="Panduan 4 langkah memasukkan data massal dari file spreadsheet"
        onMobileMenuOpen={onMobileMenuOpen || (() => {})}
      />
      <div className="page-content" style={{ maxWidth: 960 }}>
        {/* Dataset selector */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px 24px',
            marginBottom: 24,
            boxShadow: 'var(--shadow-subtle)',
          }}
        >
          <Select
            label="Pilih Dataset Tujuan Import"
            options={datasets.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
            placeholder="-- Pilih dataset tujuan import --"
            value={selectedDatasetId}
            onChange={(e) => onSelectDataset(e.target.value)}
          />
        </div>

        {!selectedDataset ? (
          <div className="section">
            <EmptyState
              icon={<Layers size={40} />}
              title="Pilih Dataset Terlebih Dahulu"
              description="Pilih salah satu dataset di atas untuk mengarahkan data import."
            />
          </div>
        ) : (
          <>
            {/* Step indicator */}
            <div className="step-indicator">
              <div className={`step ${step === 'upload' ? 'step-active' : 'step-done'}`}>
                <div className="step-number">1</div>
                <span>Unggah File</span>
              </div>
              <div className="step-line" />
              <div className={`step ${step === 'mapping' ? 'step-active' : (step === 'preview' || step === 'done') ? 'step-done' : ''}`}>
                <div className="step-number">2</div>
                <span>Petakan Kolom</span>
              </div>
              <div className="step-line" />
              <div className={`step ${step === 'preview' ? 'step-active' : step === 'done' ? 'step-done' : ''}`}>
                <div className="step-number">3</div>
                <span>Pratinjau Data</span>
              </div>
              <div className="step-line" />
              <div className={`step ${step === 'done' ? 'step-active' : ''}`}>
                <div className="step-number">4</div>
                <span>Selesai</span>
              </div>
            </div>

            {/* Step: Upload */}
            {step === 'upload' && (
              <div
                className="upload-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <div className="upload-zone-icon">
                  <FileUp size={28} />
                </div>
                <p className="upload-zone-text">
                  Klik atau seret file spreadsheet ke area ini
                </p>
                <p className="upload-zone-hint">
                  Mendukung format <strong>.xlsx</strong>, <strong>.xls</strong>, atau <strong>.csv</strong>
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFileSelect(file);
                  }}
                />
              </div>
            )}

            {/* Step: Mapping */}
            {step === 'mapping' && (
              <div className="section">
                <div className="section-header">
                  <div>
                    <h3 className="section-title">
                      <FileSpreadsheet size={16} style={{ color: '#2563eb' }} />
                      Pemetaan Kolom — {fileName}
                    </h3>
                    <p className="section-subtitle">
                      Sesuaikan kolom file dengan struktur database ({rawData.length} baris data ditemukan)
                    </p>
                  </div>
                </div>
                <div className="section-body">
                  <div className="data-table-wrapper">
                    <table className="mapping-table">
                      <thead>
                        <tr>
                          <th>Kolom dalam File</th>
                          <th className="mapping-arrow">→</th>
                          <th>Field Target Sistem</th>
                          <th>Contoh Nilai Data Baris 1</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map((m, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600, color: '#1e293b' }}>{m.source_column}</td>
                            <td className="mapping-arrow">→</td>
                            <td>
                              <select
                                className="select-input"
                                value={m.target_field}
                                onChange={(e) => onUpdateMapping(i, e.target.value)}
                                style={{ width: '100%', height: 36 }}
                              >
                                {TARGET_FIELDS.map((f) => (
                                  <option key={f.value} value={f.value}>
                                    {f.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
                              {rawData[0] ? String(rawData[0][m.source_column] ?? '-') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="form-actions">
                    <Button variant="secondary" onClick={onReset} icon={<ArrowLeft size={14} />}>
                      Ganti File
                    </Button>
                    <Button
                      onClick={() => setStep('preview')}
                      icon={<ArrowRight size={14} />}
                    >
                      Lanjut ke Pratinjau
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step: Preview */}
            {step === 'preview' && (
              <div className="section">
                <div className="section-header">
                  <div>
                    <h3 className="section-title">Pratinjau Hasil Import</h3>
                    <p className="section-subtitle">
                      Menampilkan sampel baris data yang akan dimasukkan ke dataset <strong>{selectedDataset?.name}</strong>
                    </p>
                  </div>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    Total: {rawData.length} baris
                  </span>
                </div>
                <div className="section-body">
                  <div className="data-table-wrapper" style={{ maxHeight: 380 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          {TARGET_FIELDS.filter((f) => f.value && mappings.some((m) => m.target_field === f.value)).map((f) => (
                            <th key={f.value}>{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getMappedData()
                          .slice(0, 15)
                          .map((row, i) => (
                            <tr key={i}>
                              <td style={{ color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                              {TARGET_FIELDS.filter(
                                (f) =>
                                  f.value &&
                                  mappings.some((m) => m.target_field === f.value)
                              ).map((f) => (
                                <td key={f.value} style={{ fontWeight: f.value === 'period' || f.value === 'value' ? 600 : 400 }}>
                                  {row[f.value] !== undefined ? String(row[f.value]) : '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {rawData.length > 15 && (
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                      Menampilkan 15 dari {rawData.length} baris data.
                    </p>
                  )}

                  <div className="validation-msg validation-success">
                    <CheckCircle size={15} />
                    <span>Sebanyak <strong>{rawData.length} baris</strong> data siap dimasukkan dengan status draf.</span>
                  </div>

                  <div className="form-actions">
                    <Button variant="secondary" onClick={() => setStep('mapping')} icon={<ArrowLeft size={14} />}>
                      Kembali ke Mapping
                    </Button>
                    <Button onClick={onSave} loading={saving} icon={<Sparkles size={14} />}>
                      Konfirmasi & Simpan {rawData.length} Data
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step: Done */}
            {step === 'done' && (
              <div className="section">
                <div className="section-body" style={{ textAlign: 'center', padding: '54px 24px' }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: '#ecfdf5',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <CheckCircle size={36} />
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                    Import Data Berhasil!
                  </h3>
                  <p style={{ fontSize: 14, color: '#64748b', marginBottom: 28, maxWidth: 440, margin: '0 auto 28px' }}>
                    Sebanyak <strong>{savedCount} baris data statistik</strong> berhasil dimasukkan ke dataset{' '}
                    <strong>{selectedDataset?.name}</strong>.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <Button variant="secondary" onClick={onReset}>
                      Import File Lain
                    </Button>
                    {selectedDataset && (
                      <Link href={`/datasets/${selectedDataset.id}`}>
                        <Button icon={<ArrowRight size={14} />}>Lihat Dataset</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
