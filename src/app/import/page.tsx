'use client';

import { useEffect, useState, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import {
  Button,
  Select,
  Toast,
  EmptyState,
  Modal,
  InputField,
  SearchInput,
} from '@/components/ui';
import { DatasetRepo, RecordRepo, CategoryRepo, subscribe } from '@/lib/repository';
import { Dataset, DataStatus, PeriodType, ColumnMapping } from '@/lib/types';
import {
  autoMapColumn,
  cleanHeader,
  parseNumberValue,
  cleanPeriodValue,
  detectMatrixFormat,
  unpivotMatrixData,
  matchDatasetFromFile,
  downloadSampleTemplate,
} from '@/lib/importUtils';
import {
  FileSpreadsheet,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  FileUp,
  Sparkles,
  Layers,
  Search,
  Filter,
  Download,
  AlertCircle,
  AlertTriangle,
  Plus,
  Table,
  ExternalLink,
  Check,
  Info,
  RefreshCw,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'done';

const TARGET_FIELDS = [
  { value: '', label: '— Abaikan Kolom Ini —' },
  { value: 'period', label: '★ Periode / Tahun (Wajib)' },
  { value: 'value', label: '★ Nilai Angka (Wajib)' },
  { value: 'region', label: 'Wilayah (Kabupaten/Kecamatan)' },
  { value: 'indicator', label: 'Indikator / Variabel Statistik' },
  { value: 'unit', label: 'Satuan Nilai' },
  { value: 'notes', label: 'Catatan Metodologi' },
  { value: 'source', label: 'Sumber Data' },
];

function ImportPageInner() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramDatasetId = searchParams.get('dataset');

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(paramDatasetId || '');
  const [step, setStep] = useState<ImportStep>('upload');
  
  // File & Raw Data State
  const [fileName, setFileName] = useState('');
  const [rawWorkbook, setRawWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  
  // Dataset Search & Category Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  
  // Smart Recommendation State
  const [smartRecommendation, setSmartRecommendation] = useState<{
    dataset: Dataset;
    score: number;
    reason: string;
  } | null>(null);

  // Table Format Mode: 'standard' (vertical rows) vs 'matrix' (years in columns)
  const [tableFormat, setTableFormat] = useState<'standard' | 'matrix'>('standard');
  const [matrixInfo, setMatrixInfo] = useState<{
    yearColumns: string[];
    nonYearColumns: string[];
  }>({ yearColumns: [], nonYearColumns: [] });
  const [matrixRegionCol, setMatrixRegionCol] = useState('');
  const [matrixIndicatorCol, setMatrixIndicatorCol] = useState('');

  // Standard Mapping & Default Fallbacks
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [defaultPeriod, setDefaultPeriod] = useState('');
  const [defaultRegion, setDefaultRegion] = useState('');
  const [defaultIndicator, setDefaultIndicator] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('');
  const [defaultSource, setDefaultSource] = useState('');

  // Modals & UI states
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [showCreateDatasetModal, setShowCreateDatasetModal] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);

  // New Dataset Form State
  const [newDsForm, setNewDsForm] = useState({
    name: '',
    code: '',
    category: '',
    geographic_scope: 'Kabupaten Bangka',
    unit: 'Jiwa',
    source: 'BPS Kabupaten Bangka',
    period_type: PeriodType.YEARLY,
  });

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    function loadData() {
      const active = DatasetRepo.getAll().filter((d) => d.status !== DataStatus.ARCHIVED);
      setDatasets(active);
    }

    loadData();
    const unsub = subscribe(loadData);
    return unsub;
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (paramDatasetId && datasets.length > 0) {
      const found = datasets.find((d) => d.id === paramDatasetId);
      if (found) {
        setSelectedDatasetId(found.id);
      }
    }
  }, [paramDatasetId, datasets]);

  const selectedDataset = useMemo(() => {
    return datasets.find((d) => d.id === selectedDatasetId) || null;
  }, [datasets, selectedDatasetId]);

  // Distinct categories for filtering
  const distinctCategories = useMemo(() => {
    const cats = Array.from(new Set(datasets.map((d) => d.category?.trim()).filter(Boolean)));
    return cats.sort((a, b) => a.localeCompare('id'));
  }, [datasets]);

  // Filtered dataset list for selection
  const filteredDatasets = useMemo(() => {
    let list = datasets;
    if (selectedCategoryFilter !== 'ALL') {
      list = list.filter((d) => d.category.trim().toLowerCase() === selectedCategoryFilter.trim().toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          d.geographic_scope.toLowerCase().includes(q)
      );
    }
    return list;
  }, [datasets, selectedCategoryFilter, searchQuery]);

  // When selectedDataset changes, update default fallbacks
  useEffect(() => {
    if (selectedDataset) {
      setDefaultRegion(selectedDataset.geographic_scope);
      setDefaultIndicator(selectedDataset.name);
      setDefaultUnit(selectedDataset.unit);
      setDefaultSource(selectedDataset.source);
    }
  }, [selectedDataset]);

  // Process rows and columns when raw data is ready
  const processLoadedData = (cols: string[], rows: Record<string, unknown>[], fileObjName: string, sheets: string[]) => {
    setFileName(fileObjName);
    const cleanedCols = cols.map(cleanHeader).filter(Boolean);
    setSourceColumns(cleanedCols);
    setRawData(rows);

    // Deteksi Format Matriks (Tahun sebagai kolom)
    const mat = detectMatrixFormat(cleanedCols);
    if (mat.isMatrix) {
      setTableFormat('matrix');
      setMatrixInfo({
        yearColumns: mat.yearColumns,
        nonYearColumns: mat.nonYearColumns,
      });
      // Otomatis pilih kolom Wilayah pertama
      const foundRegion = mat.nonYearColumns.find((c) =>
        /wilayah|kecamatan|kabupaten|daerah|region/i.test(c)
      );
      setMatrixRegionCol(foundRegion || mat.nonYearColumns[0] || '');

      const foundInd = mat.nonYearColumns.find((c) =>
        /indikator|variabel|keterangan/i.test(c)
      );
      setMatrixIndicatorCol(foundInd || '');
    } else {
      setTableFormat('standard');
    }

    // Auto-mapping kolom untuk mode standar
    const autoMapped: ColumnMapping[] = cleanedCols.map((col) => {
      const mappedField = autoMapColumn(col);
      return {
        source_column: col,
        target_field: (mappedField || '') as ColumnMapping['target_field'],
      };
    });
    setMappings(autoMapped);

    // Jalankan Algoritma Rekomendasi Dataset Cerdas
    const match = matchDatasetFromFile(fileObjName, sheets, cleanedCols, rows, datasets);
    if (match.bestMatch) {
      setSmartRecommendation({
        dataset: match.bestMatch,
        score: match.score,
        reason: match.reason,
      });
      // Jika belum memilih dataset, arahkan ke rekomendasi cerdas ini
      if (!selectedDatasetId) {
        setSelectedDatasetId(match.bestMatch.id);
      }
    } else {
      setSmartRecommendation(null);
    }

    // Prefill nama form dataset baru dari nama file jika nanti pengguna ingin membuat baru
    const cleanFileName = fileObjName.replace(/\.[^/.]+$/, '').replace(/[_\\-]/g, ' ');
    setNewDsForm((prev) => ({
      ...prev,
      name: prev.name || cleanFileName,
    }));

    setToast({
      msg: `File "${fileObjName}" berhasil dimuat (${rows.length} baris). Silakan verifikasi dataset tujuan di bawah sebelum melanjutkan.`,
      type: 'success',
    });
  };

  // Handle Sheet Selection for Multi-Sheet Excel
  const handleSheetSelect = (sheetName: string) => {
    if (!rawWorkbook) return;
    try {
      const sheet = rawWorkbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (json.length === 0) {
        setToast({ msg: `Lembar "${sheetName}" tidak memiliki data baris.`, type: 'warning' });
        return;
      }
      const cols = Object.keys(json[0] || {});
      setSelectedSheet(sheetName);
      setShowSheetModal(false);
      processLoadedData(cols, json, fileName, rawWorkbook.SheetNames);
    } catch {
      setToast({ msg: 'Gagal membaca sheet terpilih.', type: 'error' });
    }
  };

  const handleFileSelect = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => cleanHeader(h),
        complete: (results) => {
          const data = (results.data as Record<string, unknown>[]).filter((row) =>
            Object.values(row).some((v) => v !== null && v !== undefined && String(v).trim() !== '')
          );

          if (data.length > 0) {
            const cols = Object.keys(data[0] || {});
            processLoadedData(cols, data, file.name, ['CSV_Data']);
          } else {
            setToast({ msg: 'File CSV kosong atau tidak memiliki data yang valid.', type: 'error' });
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
          const buffer = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(buffer, { type: 'array' });
          setRawWorkbook(workbook);
          setAvailableSheets(workbook.SheetNames);

          if (workbook.SheetNames.length > 1) {
            setFileName(file.name);
            setSelectedSheet(workbook.SheetNames[0]);
            setShowSheetModal(true);
          } else {
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
            if (json.length > 0) {
              const cols = Object.keys(json[0] || {});
              processLoadedData(cols, json, file.name, workbook.SheetNames);
            } else {
              setToast({ msg: 'File Excel kosong atau sheet pertama tidak memiliki baris data.', type: 'error' });
            }
          }
        } catch {
          setToast({ msg: 'Gagal membaca file Excel. Pastikan file tidak terkunci atau rusak.', type: 'error' });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setToast({ msg: 'Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv.', type: 'error' });
    }
  };

  const updateMapping = (index: number, target: string) => {
    setMappings((prev) =>
      prev.map((m, i) =>
        i === index ? { ...m, target_field: target as ColumnMapping['target_field'] } : m
      )
    );
  };

  // Transformasi Data ke Record Statistik
  const getTransformedRecords = () => {
    if (!selectedDataset) return [];

    let rawList: Record<string, unknown>[] = [];

    if (tableFormat === 'matrix') {
      // Unpivot mode
      rawList = unpivotMatrixData(rawData, matrixInfo.yearColumns, matrixRegionCol, matrixIndicatorCol);
      return rawList.map((row) => {
        const periodStr = cleanPeriodValue(row.period || defaultPeriod);
        const val = parseNumberValue(row.value);
        return {
          dataset_id: selectedDataset.id,
          indicator: String(row.indicator || defaultIndicator || selectedDataset.name),
          region: String(row.region || defaultRegion || selectedDataset.geographic_scope),
          period: periodStr,
          value: val,
          unit: defaultUnit || selectedDataset.unit,
          notes: String(row.notes || ''),
          source: defaultSource || selectedDataset.source,
          status: DataStatus.DRAFT,
          created_by: user?.id || 'system',
          updated_by: user?.id || 'system',
        };
      });
    }

    // Standard Mode
    return rawData.map((row) => {
      const mapped: Record<string, unknown> = {};
      mappings.forEach((m) => {
        if (m.target_field) {
          mapped[m.target_field] = row[m.source_column];
        }
      });

      const periodStr = cleanPeriodValue(mapped.period || defaultPeriod);
      const val = parseNumberValue(mapped.value);

      return {
        dataset_id: selectedDataset.id,
        indicator: String(mapped.indicator || defaultIndicator || selectedDataset.name),
        region: String(mapped.region || defaultRegion || selectedDataset.geographic_scope),
        period: periodStr,
        value: val,
        unit: String(mapped.unit || defaultUnit || selectedDataset.unit),
        notes: String(mapped.notes || ''),
        source: String(mapped.source || defaultSource || selectedDataset.source),
        status: DataStatus.DRAFT,
        created_by: user?.id || 'system',
        updated_by: user?.id || 'system',
      };
    });
  };

  const handleSave = () => {
    if (!user || !selectedDataset) return;
    setSaving(true);

    try {
      const records = getTransformedRecords();
      // Validasi: Harus memiliki periode (tahun) dan nilai angka yang valid
      const valid = records.filter(
        (r) => r.period && r.period.trim() !== '' && r.value !== null && !isNaN(r.value)
      );

      if (valid.length === 0) {
        setToast({
          msg: 'Tidak ada baris data valid untuk disimpan. Periksa kembali pemetaan kolom Periode dan Nilai.',
          type: 'error',
        });
        setSaving(false);
        return;
      }

      RecordRepo.createBulk(valid, user.name);
      setSavedCount(valid.length);
      setStep('done');
      setToast({ msg: `${valid.length} data statistik berhasil diimport ke dataset.`, type: 'success' });
    } catch {
      setToast({ msg: 'Gagal mengimport data statistik. Silakan coba lagi.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDataset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newDsForm.name.trim() || !newDsForm.category.trim()) {
      setToast({ msg: 'Nama dan kategori dataset wajib diisi.', type: 'error' });
      return;
    }

    const code =
      newDsForm.code.trim() ||
      newDsForm.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 4) + '-001';

    try {
      const created = DatasetRepo.create(
        {
          name: newDsForm.name.trim(),
          code: code.toUpperCase(),
          category: newDsForm.category.trim(),
          description: `Dataset dibuat otomatis dari alur import data`,
          definition: `Dataset ${newDsForm.name}`,
          geographic_scope: newDsForm.geographic_scope.trim(),
          unit: newDsForm.unit.trim(),
          source: newDsForm.source.trim(),
          period_type: newDsForm.period_type,
          status: DataStatus.DRAFT,
        },
        user.id,
        user.name
      );

      setSelectedDatasetId(created.id);
      setShowCreateDatasetModal(false);
      setToast({ msg: `Dataset "${created.name}" berhasil dibuat dan dipilih!`, type: 'success' });
    } catch {
      setToast({ msg: 'Gagal membuat dataset baru.', type: 'error' });
    }
  };

  const reset = () => {
    setStep('upload');
    setRawData([]);
    setSourceColumns([]);
    setMappings([]);
    setFileName('');
    setSavedCount(0);
    setSmartRecommendation(null);
    setRawWorkbook(null);
    setAvailableSheets([]);
    setSelectedSheet('');
  };

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <Header
        title="Import Data Excel / CSV"
        subtitle="Panduan 4 langkah memasukkan data statistik massal dari file spreadsheet"
      />

      <div className="page-content" style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Step indicator */}
        <div className="step-indicator">
          <div className={`step ${step === 'upload' ? 'step-active' : 'step-done'}`}>
            <div className="step-number">1</div>
            <span>Unggah & Pilih Dataset</span>
          </div>
          <div className="step-line" />
          <div
            className={`step ${
              step === 'mapping' ? 'step-active' : step === 'preview' || step === 'done' ? 'step-done' : ''
            }`}
          >
            <div className="step-number">2</div>
            <span>Petakan Variabel</span>
          </div>
          <div className="step-line" />
          <div className={`step ${step === 'preview' ? 'step-active' : step === 'done' ? 'step-done' : ''}`}>
            <div className="step-number">3</div>
            <span>Pratinjau & Validasi</span>
          </div>
          <div className="step-line" />
          <div className={`step ${step === 'done' ? 'step-active' : ''}`}>
            <div className="step-number">4</div>
            <span>Selesai</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* STEP 1: UPLOAD & DATASET SELECTION                           */}
        {/* ============================================================ */}
        {step === 'upload' && (
          <div>
            {/* Template Download Bar */}
            <div className="template-download-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Download size={16} style={{ color: '#2563eb' }} />
                <span>
                  <strong>Unduh Template Data:</strong> Butuh contoh format spreadsheet yang langsung cocok?
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => downloadSampleTemplate('standard', 'xlsx')}
                >
                  Template Standar (.xlsx)
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => downloadSampleTemplate('matrix', 'xlsx')}
                >
                  Template Matriks Tahunan (.xlsx)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadSampleTemplate('standard', 'csv')}
                >
                  CSV Standar
                </Button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* KONDISI 1: FILE SUDAH DIUNGGAH (TAHAP VERIFIKASI DATASET)    */}
            {/* ============================================================ */}
            {fileName && rawData.length > 0 ? (
              <div>
                {/* 1. Informasi File yang Diunggah */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 20px',
                    marginBottom: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: '#dbeafe',
                        color: '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileSpreadsheet size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>
                          File Berhasil Dimuat: {fileName}
                        </span>
                        {selectedSheet && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              background: '#e0e7ff',
                              color: '#3730a3',
                              padding: '2px 8px',
                              borderRadius: 4,
                            }}
                          >
                            Sheet: {selectedSheet}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                        <strong>{rawData.length} baris data</strong> • {sourceColumns.length} kolom terdeteksi • Format:{' '}
                        <strong>{tableFormat === 'matrix' ? 'Matriks Tahunan BPS' : 'Tabel Baris Standar'}</strong>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => fileRef.current?.click()}
                      icon={<FileUp size={14} />}
                    >
                      Ganti File
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={reset}
                      icon={<X size={14} />}
                      style={{ color: '#ef4444' }}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>

                {/* 2. Kartu Konfirmasi Dataset Tujuan */}
                {selectedDataset ? (
                  <div
                    style={{
                      background: '#ffffff',
                      border: '2px solid #3b82f6',
                      borderRadius: 'var(--radius-lg)',
                      padding: '22px 24px',
                      marginBottom: 20,
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Dataset Tujuan Import:
                      </div>
                      {smartRecommendation && smartRecommendation.dataset.id === selectedDataset.id ? (
                        <span
                          style={{
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #86efac',
                            padding: '3px 12px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Sparkles size={13} />
                          Rekomendasi Cerdas BPS ({Math.min(99, smartRecommendation.score)}% Cocok)
                        </span>
                      ) : (
                        <span
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                            padding: '3px 12px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          ✓ Dataset Terpilih
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          background: '#dbeafe',
                          color: '#1d4ed8',
                          padding: '3px 10px',
                          borderRadius: 6,
                        }}
                      >
                        {selectedDataset.code}
                      </span>
                      <span style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                        {selectedDataset.name}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                      <span>Kategori: <strong>{selectedDataset.category}</strong></span>
                      <span>Wilayah: <strong>{selectedDataset.geographic_scope}</strong></span>
                      <span>Satuan: <strong>{selectedDataset.unit}</strong></span>
                      <span>Sumber: <strong>{selectedDataset.source}</strong></span>
                    </div>

                    {/* Catatan Alasan Rekomendasi */}
                    {smartRecommendation && smartRecommendation.dataset.id === selectedDataset.id && (
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '10px 14px',
                          fontSize: 12.5,
                          color: '#334155',
                          marginBottom: 16,
                        }}
                      >
                        💡 <strong>Alasan Rekomendasi:</strong> {smartRecommendation.reason}. Data dari file &ldquo;{fileName}&rdquo; akan dipetakan ke dataset ini.
                      </div>
                    )}

                    {/* Peringatan jika pengguna memilih dataset yang berbeda dari rekomendasi file */}
                    {smartRecommendation && smartRecommendation.dataset.id !== selectedDataset.id && (
                      <div
                        style={{
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: 8,
                          padding: '12px 16px',
                          fontSize: 12.5,
                          color: '#92400e',
                          marginBottom: 16,
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>
                          ⚠️ Perhatian Kecocokan File:
                        </div>
                        <div>
                          Anda memilih dataset <strong>{selectedDataset.name}</strong>, namun isi file Anda terdeteksi lebih mirip dengan dataset{' '}
                          <strong>{smartRecommendation.dataset.name}</strong> ({smartRecommendation.score}% cocok).
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedDatasetId(smartRecommendation.dataset.id)}
                            icon={<Check size={14} />}
                            style={{ borderColor: '#d97706', color: '#92400e' }}
                          >
                            Gunakan Rekomendasi ({smartRecommendation.dataset.name})
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Tombol Aksi Konfirmasi Utama */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', paddingTop: 6 }}>
                      <Button
                        size="md"
                        variant="primary"
                        onClick={() => setStep('mapping')}
                        icon={<ArrowRight size={16} />}
                        style={{ fontWeight: 700, padding: '10px 22px', fontSize: 13.5 }}
                      >
                        Ya, Sudah Sesuai — Lanjut ke Pemetaan Kolom →
                      </Button>
                      <Button
                        size="md"
                        variant="secondary"
                        onClick={() => setSelectedDatasetId('')}
                        icon={<RefreshCw size={14} />}
                        style={{ border: '1.5px solid #2563eb', color: '#1d4ed8', fontWeight: 600, background: '#ffffff' }}
                      >
                        Bukan Ini? Ganti Dataset Lain
                      </Button>
                      <Button
                        size="md"
                        variant="secondary"
                        onClick={() => setShowCreateDatasetModal(true)}
                        icon={<Plus size={14} />}
                        style={{ border: '1.5px solid #cbd5e1', color: '#334155', fontWeight: 600, background: '#ffffff' }}
                      >
                        Dataset Belum Ada? Buat Baru
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Jika Belum Ada Dataset Terpilih */
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1.5px solid #f59e0b',
                      borderRadius: 'var(--radius-lg)',
                      padding: '20px 24px',
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <AlertTriangle size={22} style={{ color: '#d97706' }} />
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#92400e' }}>
                        Dataset Tujuan Belum Ditentukan
                      </h4>
                    </div>
                    <p style={{ margin: '0 0 14px', fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
                      File spreadsheet <strong>&ldquo;{fileName}&rdquo;</strong> berhasil dibaca ({rawData.length} baris data), namun belum ada dataset tujuan yang sesuai. Bisa jadi dataset yang Anda inginkan belum ada di sistem atau nama file tidak terdeteksi otomatis.
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setShowCreateDatasetModal(true)}
                        icon={<Plus size={14} />}
                        style={{ background: '#d97706', borderColor: '#d97706' }}
                      >
                        + Buat Dataset Baru untuk File Ini
                      </Button>
                      <span style={{ fontSize: 12.5, color: '#92400e', fontWeight: 600 }}>
                        atau pilih salah satu dataset yang sudah ada di bawah:
                      </span>
                    </div>
                  </div>
                )}

                {/* Katalog Pemilihan Dataset (Jika belum ada dataset terpilih) */}
                {!selectedDataset && (
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--slate-200)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '20px 24px',
                      marginBottom: 20,
                      boxShadow: 'var(--shadow-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div>
                        <h4 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          Pilih Dataset yang Sesuai untuk File &ldquo;{fileName}&rdquo;
                        </h4>
                        <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0' }}>
                          Gunakan filter kategori atau pencarian untuk menemukan wadah dataset
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowCreateDatasetModal(true)}
                        icon={<Plus size={14} />}
                      >
                        Buat Dataset Baru
                      </Button>
                    </div>

                    {/* Filter Kategori Dropdown & Search Input */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(220px, 1fr) minmax(280px, 1.6fr)',
                        gap: 12,
                        marginBottom: 14,
                        alignItems: 'flex-end',
                      }}
                    >
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Filter Kategori:
                        </label>
                        <select
                          className="select-input"
                          value={selectedCategoryFilter}
                          onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                          style={{ height: 38, fontSize: 13, fontWeight: 500 }}
                        >
                          <option value="ALL">Semua Kategori ({datasets.length})</option>
                          {distinctCategories.map((cat) => {
                            const count = datasets.filter((d) => d.category.trim() === cat).length;
                            return (
                              <option key={cat} value={cat}>
                                {cat} ({count})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Cari Dataset:
                        </label>
                        <SearchInput
                          value={searchQuery}
                          onChange={setSearchQuery}
                          placeholder="Cari nama dataset, kode (misal: POP-001), atau kata kunci..."
                        />
                      </div>
                    </div>

                    {/* Dataset Select List */}
                    <div className="dataset-select-list">
                      {filteredDatasets.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                          Tidak ada dataset yang cocok dengan kriteria pencarian.
                          <div style={{ marginTop: 8 }}>
                            <Button size="sm" variant="secondary" onClick={() => setShowCreateDatasetModal(true)} icon={<Plus size={14} />}>
                              Buat Dataset Baru Sekarang
                            </Button>
                          </div>
                        </div>
                      ) : (
                        filteredDatasets.map((ds) => (
                          <div
                            key={ds.id}
                            className="dataset-select-item"
                            onClick={() => setSelectedDatasetId(ds.id)}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    background: '#e2e8f0',
                                    color: '#334155',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    display: 'inline-block',
                                  }}
                                >
                                  {ds.code}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                                  {ds.name}
                                </span>
                              </div>
                              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                                {ds.category} • Cakupan: {ds.geographic_scope} • Satuan: {ds.unit}
                              </div>
                            </div>
                            <Button size="sm" variant="secondary">
                              Pilih Dataset Ini
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ============================================================ */
              /* KONDISI 2: BELUM ADA FILE (UNGGAH FILE ATAU PILIH DATASET)   */
              /* ============================================================ */
              <div>
                {/* File Upload Zone - Tampil di Atas */}
                <div
                  className="upload-zone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileSelect(file);
                  }}
                  onClick={() => fileRef.current?.click()}
                  style={{ marginBottom: 24 }}
                >
                  <div className="upload-zone-icon">
                    <FileUp size={32} />
                  </div>
                  <p className="upload-zone-text" style={{ fontSize: 15, fontWeight: 600 }}>
                    Unggah File Spreadsheet (.xlsx, .xls, .csv)
                  </p>
                  <p className="upload-zone-hint">
                    Klik atau seret file ke sini. Sistem akan menganalisis nama dan isi file untuk menemukan dataset yang tepat sebelum masuk ke form pemetaan.
                  </p>
                  <p style={{ fontSize: 11.5, color: '#94a3b8', margin: '4px 0 0' }}>
                    Mendukung tabel baris standar maupun tabel matriks tahunan BPS. Delimiter koma (,) atau titik koma (;) otomatis terdeteksi.
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                </div>

                {/* Dataset Target Selector Card (Pilihan Awal Sebelum Upload) */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--slate-200)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px 24px',
                    marginBottom: 20,
                    boxShadow: 'var(--shadow-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        Pilih Dataset Tujuan (Opsional — Bisa Ditentukan Sekarang atau Setelah Upload)
                      </h3>
                      <p style={{ fontSize: 12.5, color: '#64748b', margin: '3px 0 0' }}>
                        Pilih dataset makro BPS terlebih dahulu jika Anda sudah tahu pasti wadah datanya
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowCreateDatasetModal(true)}
                      icon={<Plus size={14} />}
                    >
                      Buat Dataset Baru
                    </Button>
                  </div>

                  {/* Selected Dataset Summary Card */}
                  {selectedDataset ? (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1.5px solid #3b82f6',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#dbeafe',
                              color: '#1d4ed8',
                              padding: '2px 8px',
                              borderRadius: 4,
                            }}
                          >
                            {selectedDataset.code}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                            {selectedDataset.name}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <span>Kategori: <strong>{selectedDataset.category}</strong></span>
                          <span>Wilayah: <strong>{selectedDataset.geographic_scope}</strong></span>
                          <span>Satuan: <strong>{selectedDataset.unit}</strong></span>
                          <span>Sumber: <strong>{selectedDataset.source}</strong></span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedDatasetId('')}
                        icon={<RefreshCw size={14} />}
                        style={{
                          border: '1.5px solid #2563eb',
                          color: '#1d4ed8',
                          backgroundColor: '#ffffff',
                          fontWeight: 600,
                          boxShadow: '0 1px 3px rgba(37, 99, 235, 0.12)',
                          padding: '6px 14px',
                        }}
                      >
                        Ganti Dataset
                      </Button>
                    </div>
                  ) : (
                    <div>
                      {/* Filter Kategori Dropdown & Search Input */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(220px, 1fr) minmax(280px, 1.6fr)',
                          gap: 12,
                          marginBottom: 14,
                          alignItems: 'flex-end',
                        }}
                      >
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Filter Kategori:
                          </label>
                          <select
                            className="select-input"
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            style={{ height: 38, fontSize: 13, fontWeight: 500 }}
                          >
                            <option value="ALL">Semua Kategori ({datasets.length})</option>
                            {distinctCategories.map((cat) => {
                              const count = datasets.filter((d) => d.category.trim() === cat).length;
                              return (
                                <option key={cat} value={cat}>
                                  {cat} ({count})
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Cari Dataset:
                          </label>
                          <SearchInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Cari nama dataset, kode (misal: POP-001), atau kata kunci..."
                          />
                        </div>
                      </div>

                      {/* Dataset Select List */}
                      <div className="dataset-select-list">
                        {filteredDatasets.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                            Tidak ada dataset yang cocok dengan kriteria pencarian.
                          </div>
                        ) : (
                          filteredDatasets.map((ds) => (
                            <div
                              key={ds.id}
                              className="dataset-select-item"
                              onClick={() => setSelectedDatasetId(ds.id)}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      background: '#e2e8f0',
                                      color: '#334155',
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                      display: 'inline-block',
                                    }}
                                  >
                                    {ds.code}
                                  </span>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                                    {ds.name}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11.5, color: '#64748b' }}>
                                  {ds.category} • Cakupan: {ds.geographic_scope} • Satuan: {ds.unit}
                                </div>
                              </div>
                              <Button size="sm" variant="secondary">
                                Pilih
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: MAPPING VARIABEL                                     */}
        {/* ============================================================ */}
        {step === 'mapping' && (
          <div className="section">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="section-title">
                  <FileSpreadsheet size={18} style={{ color: '#2563eb' }} />
                  Pemetaan Variabel — {fileName} {selectedSheet && `(Sheet: ${selectedSheet})`}
                </h3>
                <p className="section-subtitle">
                  File terdeteksi memiliki <strong>{rawData.length} baris</strong> data. Arahkan kolom file ke variabel sistem untuk dataset{' '}
                  <strong>{selectedDataset?.name}</strong>.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                Ganti File / Mulai Ulang
              </Button>
            </div>

            <div className="section-body">
              {/* Format Switcher: Standard vs Matrix */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--slate-200)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Table size={16} style={{ color: '#2563eb' }} />
                  Metode Format Tabel Spreadsheet
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      cursor: 'pointer',
                      background: tableFormat === 'standard' ? '#eff6ff' : '#ffffff',
                      border: `1px solid ${tableFormat === 'standard' ? '#3b82f6' : 'var(--slate-300)'}`,
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <input
                      type="radio"
                      name="tableFormat"
                      checked={tableFormat === 'standard'}
                      onChange={() => setTableFormat('standard')}
                    />
                    <div>
                      <strong>Format Standar (Tabel Baris)</strong>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Kolom berisi nama variabel, nilai, dan tahun di baris</div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      cursor: 'pointer',
                      background: tableFormat === 'matrix' ? '#eff6ff' : '#ffffff',
                      border: `1px solid ${tableFormat === 'matrix' ? '#3b82f6' : 'var(--slate-300)'}`,
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <input
                      type="radio"
                      name="tableFormat"
                      checked={tableFormat === 'matrix'}
                      onChange={() => setTableFormat('matrix')}
                    />
                    <div>
                      <strong>Format Matriks Tahunan (Kolom adalah Tahun)</strong>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        Tabel pivot di mana kolom berupa tahun (misal: 2020, 2021, 2022) di-unpivot otomatis
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* MATRIX FORMAT CONFIGURATION */}
              {tableFormat === 'matrix' ? (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--slate-200)',
                    borderRadius: 'var(--radius-md)',
                    padding: '18px 20px',
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: '#0f172a', fontWeight: 600, fontSize: 14 }}>
                    <Sparkles size={16} style={{ color: '#f59e0b' }} />
                    Konfigurasi Transformasi Matriks Tahunan
                  </div>
                  <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 16 }}>
                    Sistem mendeteksi <strong>{matrixInfo.yearColumns.length} kolom tahun</strong>:{' '}
                    <span style={{ fontFamily: 'monospace', color: '#1d4ed8' }}>
                      {matrixInfo.yearColumns.join(', ')}
                    </span>
                    . Setiap baris wilayah akan dipecah otomatis menjadi baris periode statistik.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
                    <div>
                      <label className="input-label">Kolom Identitas Wilayah / Daerah</label>
                      <select
                        className="select-input"
                        value={matrixRegionCol}
                        onChange={(e) => setMatrixRegionCol(e.target.value)}
                        style={{ width: '100%', height: 38 }}
                      >
                        <option value="">-- Tanpa Kolom Wilayah (Gunakan Default) --</option>
                        {sourceColumns.map((col) => (
                          <option key={col} value={col}>
                            {col} (contoh: {String(rawData[0]?.[col] ?? '-')})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="input-label">Kolom Indikator / Variabel (Opsional)</label>
                      <select
                        className="select-input"
                        value={matrixIndicatorCol}
                        onChange={(e) => setMatrixIndicatorCol(e.target.value)}
                        style={{ width: '100%', height: 38 }}
                      >
                        <option value="">-- Gunakan Nama Dataset ({selectedDataset?.name}) --</option>
                        {sourceColumns.map((col) => (
                          <option key={col} value={col}>
                            {col} (contoh: {String(rawData[0]?.[col] ?? '-')})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                /* STANDARD MAPPING TABLE */
                <div className="data-table-wrapper" style={{ marginBottom: 20 }}>
                  <table className="mapping-table">
                    <thead>
                      <tr>
                        <th>Kolom dalam File ({sourceColumns.length})</th>
                        <th className="mapping-arrow">→</th>
                        <th>Field Variabel Sistem</th>
                        <th>Contoh Data Baris Pertama</th>
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
                              onChange={(e) => updateMapping(i, e.target.value)}
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
              )}

              {/* FALLBACK DEFAULTS ACCORDION / BOX */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px dashed var(--slate-300)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  marginBottom: 24,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Info size={15} style={{ color: '#2563eb' }} />
                  Nilai Bawaan (Fallback Default) jika Variabel Tidak Ada di File
                </div>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                  Jika file spreadsheet Anda tidak memiliki kolom tahun tertentu, wilayah, atau satuan, sistem akan otomatis menggunakan nilai berikut:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Tahun / Periode Default
                    </label>
                    <input
                      type="text"
                      className="text-input"
                      value={defaultPeriod}
                      onChange={(e) => setDefaultPeriod(e.target.value)}
                      placeholder="Contoh: 2024"
                      style={{ height: 34, fontSize: 12.5 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Wilayah Default
                    </label>
                    <input
                      type="text"
                      className="text-input"
                      value={defaultRegion}
                      onChange={(e) => setDefaultRegion(e.target.value)}
                      placeholder="Contoh: Kabupaten Bangka"
                      style={{ height: 34, fontSize: 12.5 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Satuan Nilai Default
                    </label>
                    <input
                      type="text"
                      className="text-input"
                      value={defaultUnit}
                      onChange={(e) => setDefaultUnit(e.target.value)}
                      placeholder="Contoh: Jiwa, %, Miliar Rp"
                      style={{ height: 34, fontSize: 12.5 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Sumber Data Default
                    </label>
                    <input
                      type="text"
                      className="text-input"
                      value={defaultSource}
                      onChange={(e) => setDefaultSource(e.target.value)}
                      placeholder="Contoh: BPS Kabupaten Bangka"
                      style={{ height: 34, fontSize: 12.5 }}
                    />
                  </div>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button variant="secondary" onClick={() => setStep('upload')} icon={<ArrowLeft size={14} />}>
                  Kembali ke Unggah
                </Button>
                <Button
                  onClick={() => {
                    if (tableFormat === 'standard') {
                      const hasPeriod = mappings.some((m) => m.target_field === 'period') || defaultPeriod.trim() !== '';
                      const hasValue = mappings.some((m) => m.target_field === 'value');
                      if (!hasValue) {
                        setToast({ msg: 'Kolom Nilai Angka wajib dipetakan.', type: 'error' });
                        return;
                      }
                      if (!hasPeriod) {
                        setToast({ msg: 'Kolom Periode / Tahun wajib dipetakan atau diisi nilai default.', type: 'error' });
                        return;
                      }
                    }
                    setStep('preview');
                  }}
                  icon={<ArrowRight size={14} />}
                >
                  Lanjut ke Pratinjau & Validasi
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: PRATINJAU & VALIDASI                                 */}
        {/* ============================================================ */}
        {step === 'preview' && (
          <div className="section">
            {(() => {
              const records = getTransformedRecords();
              const validRecords = records.filter(
                (r) => r.period && r.period.trim() !== '' && r.value !== null && !isNaN(r.value)
              );
              const invalidCount = records.length - validRecords.length;

              return (
                <>
                  <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 className="section-title">Pratinjau Hasil Transformasi Data</h3>
                      <p className="section-subtitle">
                        Memverifikasi data statistik sebelum disimpan ke dataset <strong>{selectedDataset?.name}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="section-body">
                    {/* Diagnostic Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid var(--slate-200)',
                          borderRadius: 'var(--radius-md)',
                          padding: '14px 16px',
                        }}
                      >
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Total Baris Terbaca</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                          {records.length}
                        </div>
                      </div>

                      <div
                        style={{
                          background: '#ecfdf5',
                          border: '1px solid #6ee7b7',
                          borderRadius: 'var(--radius-md)',
                          padding: '14px 16px',
                        }}
                      >
                        <div style={{ fontSize: 12, color: '#047857', fontWeight: 600 }}>Siap Diimport (Valid)</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#065f46', marginTop: 4 }}>
                          {validRecords.length}
                        </div>
                      </div>

                      {invalidCount > 0 && (
                        <div
                          style={{
                            background: '#fffbeb',
                            border: '1px solid #fcd34d',
                            borderRadius: 'var(--radius-md)',
                            padding: '14px 16px',
                          }}
                        >
                          <div style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>Dilewati (Kosong/Strip)</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#92400e', marginTop: 4 }}>
                            {invalidCount}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Preview Table */}
                    <div className="data-table-wrapper" style={{ maxHeight: 380, marginBottom: 12 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Status Baris</th>
                            <th>Periode / Tahun</th>
                            <th>Nilai Angka</th>
                            <th>Satuan</th>
                            <th>Wilayah</th>
                            <th>Indikator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.slice(0, 20).map((row, i) => {
                            const isValid = row.period && row.period.trim() !== '' && row.value !== null && !isNaN(row.value);
                            return (
                              <tr key={i} style={{ background: !isValid ? '#fffbeb' : undefined }}>
                                <td style={{ color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                                <td>
                                  {isValid ? (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        fontSize: 11.5,
                                        color: '#059669',
                                        fontWeight: 600,
                                      }}
                                    >
                                      <CheckCircle size={13} /> Siap Import
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        fontSize: 11.5,
                                        color: '#d97706',
                                        fontWeight: 600,
                                      }}
                                    >
                                      <AlertTriangle size={13} /> Dilewati
                                    </span>
                                  )}
                                </td>
                                <td style={{ fontWeight: 600, color: '#1e293b' }}>{row.period || '-'}</td>
                                <td style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                                  {row.value !== null ? row.value.toLocaleString('id-ID') : '-'}
                                </td>
                                <td style={{ color: '#64748b' }}>{row.unit}</td>
                                <td style={{ color: '#334155' }}>{row.region}</td>
                                <td style={{ color: '#475569', fontSize: 12 }}>{row.indicator}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {records.length > 20 && (
                      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                        Menampilkan 20 sampel dari {records.length} baris data statistik hasil konversi.
                      </p>
                    )}

                    <div className="validation-msg validation-success" style={{ marginBottom: 20 }}>
                      <CheckCircle size={16} />
                      <span>
                        Sebanyak <strong>{validRecords.length} data statistik valid</strong> siap dimasukkan ke dataset{' '}
                        <strong>{selectedDataset?.name}</strong> dengan status draf.
                      </span>
                    </div>

                    <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Button variant="secondary" onClick={() => setStep('mapping')} icon={<ArrowLeft size={14} />}>
                        Kembali ke Pemetaan
                      </Button>
                      <Button
                        onClick={handleSave}
                        loading={saving}
                        icon={<Sparkles size={14} />}
                        disabled={validRecords.length === 0}
                      >
                        Konfirmasi & Simpan {validRecords.length} Data
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: DONE                                                 */}
        {/* ============================================================ */}
        {step === 'done' && (
          <div className="section">
            <div className="section-body" style={{ textAlign: 'center', padding: '54px 24px' }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 18px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                }}
              >
                <CheckCircle size={40} />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                Import Data Statistik Berhasil!
              </h3>
              <p style={{ fontSize: 14.5, color: '#64748b', marginBottom: 30, maxWidth: 480, margin: '0 auto 30px', lineHeight: 1.6 }}>
                Sebanyak <strong>{savedCount} baris data statistik</strong> berhasil disimpan ke dataset{' '}
                <strong>{selectedDataset?.name}</strong> ({selectedDataset?.code}). Data siap untuk diverifikasi dan direview.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button variant="secondary" onClick={reset}>
                  Import File Lain
                </Button>
                {selectedDataset && (
                  <Link href={`/datasets/${selectedDataset.id}`}>
                    <Button icon={<ArrowRight size={14} />}>Lihat Data di Dataset</Button>
                  </Link>
                )}
                <Link href="/datasets">
                  <Button variant="ghost">Buka Katalog Dataset</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL: PILIH SHEET EXCEL                                     */}
      {/* ============================================================ */}
      {showSheetModal && (
        <Modal
          open={showSheetModal}
          onClose={() => setShowSheetModal(false)}
          title="Pilih Lembar Kerja (Sheet) Excel"
          description="File spreadsheet ini memiliki beberapa sheet. Pilih sheet yang berisi data statistik yang ingin diimport:"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '18px 0' }}>
            {availableSheets.map((sh) => (
              <button
                key={sh}
                type="button"
                className={`dataset-select-item ${selectedSheet === sh ? 'dataset-select-item-active' : ''}`}
                onClick={() => handleSheetSelect(sh)}
                style={{ textAlign: 'left', width: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileSpreadsheet size={18} style={{ color: '#2563eb' }} />
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a' }}>{sh}</span>
                </div>
                <Button size="sm" variant="secondary">Pilih Sheet</Button>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* MODAL: BUAT DATASET BARU LANGSUNG DARI IMPORT               */}
      {/* ============================================================ */}
      {showCreateDatasetModal && (
        <Modal
          open={showCreateDatasetModal}
          onClose={() => setShowCreateDatasetModal(false)}
          title="Buat Dataset Baru untuk Import"
          description="Tambahkan entri dataset baru jika data statistik belum memiliki wadah katalog."
        >
          <form onSubmit={handleCreateDataset} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            <InputField
              label="Nama Dataset"
              required
              value={newDsForm.name}
              onChange={(e) => setNewDsForm({ ...newDsForm, name: e.target.value })}
              placeholder="Contoh: Jumlah Penduduk Kecamatan Sungailiat"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <InputField
                label="Kode Dataset"
                value={newDsForm.code}
                onChange={(e) => setNewDsForm({ ...newDsForm, code: e.target.value })}
                placeholder="Contoh: POP-002"
                hint="Biarkan kosong untuk otomatis"
              />

              <div>
                <label className="input-label">Kategori Statistik *</label>
                <input
                  type="text"
                  list="categories-datalist"
                  className="text-input"
                  required
                  value={newDsForm.category}
                  onChange={(e) => setNewDsForm({ ...newDsForm, category: e.target.value })}
                  placeholder="Pilih atau ketik kategori..."
                />
                <datalist id="categories-datalist">
                  {distinctCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <InputField
                label="Cakupan Wilayah"
                value={newDsForm.geographic_scope}
                onChange={(e) => setNewDsForm({ ...newDsForm, geographic_scope: e.target.value })}
                placeholder="Kabupaten Bangka"
              />

              <InputField
                label="Satuan Nilai"
                required
                value={newDsForm.unit}
                onChange={(e) => setNewDsForm({ ...newDsForm, unit: e.target.value })}
                placeholder="Jiwa, %, Miliar Rp, dll"
              />
            </div>

            <InputField
              label="Sumber Data"
              value={newDsForm.source}
              onChange={(e) => setNewDsForm({ ...newDsForm, source: e.target.value })}
              placeholder="BPS Kabupaten Bangka"
            />

            <div className="modal-actions" style={{ marginTop: 10 }}>
              <Button variant="secondary" type="button" onClick={() => setShowCreateDatasetModal(false)}>
                Batal
              </Button>
              <Button type="submit" icon={<Plus size={14} />}>
                Buat & Gunakan Dataset
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AppLayout>
  );
}

export default function ImportPage() {
  return (
    <Suspense>
      <ImportPageInner />
    </Suspense>
  );
}
