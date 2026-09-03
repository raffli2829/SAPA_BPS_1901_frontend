'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button, Toast } from '@/components/ui';
import { DatasetRepo, CategoryRepo } from '@/lib/repository';
import { Dataset, DataStatus, PeriodType } from '@/lib/types';
import {
  Database,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Pencil,
  Plus,
  ListFilter,
} from 'lucide-react';
import Link from 'next/link';

export default function EditDatasetPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const datasetId = params.id as string;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dynamic available categories & units from store
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableUnits, setAvailableUnits] = useState<string[]>([]);

  // Toggle custom manual vs select from existing
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [isCustomUnit, setIsCustomUnit] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
    definition: '',
    geographic_scope: 'Kabupaten Bangka',
    unit: '',
    source: 'BPS Kabupaten Bangka',
    period_type: PeriodType.YEARLY,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    try {
      const cats = DatasetRepo.getDistinctCategories();
      const units = DatasetRepo.getDistinctUnits();
      setAvailableCategories(cats);
      setAvailableUnits(units);

      const ds = DatasetRepo.getById(datasetId);
      if (ds) {
        setDataset(ds);
        setForm({
          name: ds.name,
          code: ds.code,
          category: ds.category,
          description: ds.description || '',
          definition: ds.definition || '',
          geographic_scope: ds.geographic_scope || 'Kabupaten Bangka',
          unit: ds.unit || '',
          source: ds.source || 'BPS Kabupaten Bangka',
          period_type: ds.period_type || PeriodType.YEARLY,
        });

        if (ds.category && !cats.includes(ds.category.trim())) {
          setIsCustomCategory(true);
        }
        if (ds.unit && !units.includes(ds.unit.trim())) {
          setIsCustomUnit(true);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isLoading, router, datasetId]);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Nama dataset / indikator wajib diisi.';

    const cleanCode = form.code.trim().toUpperCase();
    if (!cleanCode) {
      errs.code = 'Kode dataset wajib diisi.';
    } else if (DatasetRepo.isCodeTaken(cleanCode, datasetId)) {
      errs.code = `Kode dataset "${cleanCode}" sudah digunakan dataset lain. Gunakan kode unik.`;
    }

    if (!form.category.trim()) errs.category = 'Kategori statistik wajib diisi atau dipilih.';
    if (!form.unit.trim()) errs.unit = 'Satuan nilai wajib diisi atau dipilih.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !user || !dataset) return;

    setSaving(true);
    try {
      const catTrim = form.category.trim();
      const catExists = CategoryRepo.getAll().some(
        (c) => c.name.toLowerCase() === catTrim.toLowerCase()
      );
      if (!catExists) {
        CategoryRepo.create({
          name: catTrim,
          code: catTrim.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5),
          description: 'Kategori baru ditambahkan melalui form edit dataset',
        });
      }

      const updates: Partial<Dataset> = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        category: catTrim,
        description: form.description.trim(),
        definition: form.definition.trim(),
        geographic_scope: form.geographic_scope.trim(),
        unit: form.unit.trim(),
        source: form.source.trim(),
        period_type: form.period_type as PeriodType,
      };

      const updated = DatasetRepo.update(dataset.id, updates, user.id, user.name);

      if (updated) {
        setToast({ msg: `Dataset "${updated.name}" berhasil diperbarui.`, type: 'success' });
        setTimeout(() => router.push(`/datasets/${dataset.id}`), 800);
      } else {
        setToast({ msg: 'Gagal memperbarui dataset. Coba lagi.', type: 'error' });
        setSaving(false);
      }
    } catch {
      setToast({ msg: 'Terjadi kesalahan sistem saat menyimpan dataset.', type: 'error' });
      setSaving(false);
    }
  };

  if (isLoading || !isAuthenticated) return null;

  if (loading) {
    return (
      <AppLayout>
        <Header title="Memuat Dataset..." backHref={`/datasets/${datasetId}`} />
        <div className="page-content" style={{ maxWidth: 860 }}>
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            Memuat data indikator...
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!dataset) {
    return (
      <AppLayout>
        <Header title="Dataset Tidak Ditemukan" backHref="/datasets" />
        <div className="page-content" style={{ maxWidth: 860 }}>
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p>Dataset yang Anda tuju tidak ditemukan.</p>
            <Link href="/datasets">
              <Button variant="secondary" icon={<ArrowLeft size={14} />}>
                Kembali ke Katalog
              </Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Header
        title={`Edit Dataset: ${dataset.name}`}
        subtitle={`Perbarui spesifikasi metadata dan informasi data makro (${dataset.code})`}
        backHref={`/datasets/${dataset.id}`}
        actions={
          <Link href={`/datasets/${dataset.id}`}>
            <Button variant="secondary" size="sm" icon={<ArrowLeft size={13} />}>
              Batal & Kembali
            </Button>
          </Link>
        }
      />

      <div className="page-content" style={{ maxWidth: 880 }}>
        {/* Banner peringatan jika berstatus PUBLISHED */}
        {dataset.status === DataStatus.PUBLISHED && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 12,
              padding: '14px 16px',
              fontSize: 13,
              color: '#1e40af',
              marginBottom: 20,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              lineHeight: 1.5,
            }}
          >
            <AlertCircle size={18} style={{ marginTop: 2, flexShrink: 0, color: '#2563eb' }} />
            <div>
              <strong>Status: PUBLISHED (Data Resmi Aktif)</strong>
              <div style={{ marginTop: 2 }}>
                Perubahan pada nama indikator, satuan nilai, dan metadata akan langsung tersinkronisasi ke katalog BPS dan sistem layanan bot WhatsApp SAPA BPS.
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 14,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
              Identitas & Klasifikasi Indikator
            </h3>

            {/* Nama & Kode */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Nama Indikator / Dataset <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Contoh: Jumlah Penduduk Kabupaten Bangka"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: `1px solid ${errors.name ? '#ef4444' : 'var(--slate-300)'}`,
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {errors.name && (
                  <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>
                    {errors.name}
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Kode Unik Dataset <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                  placeholder="Contoh: DEMO-001"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: `1px solid ${errors.code ? '#ef4444' : 'var(--slate-300)'}`,
                    fontSize: 14,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {errors.code && (
                  <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>
                    {errors.code}
                  </span>
                )}
              </div>
            </div>

            {/* Kategori & Satuan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Kategori */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Kategori Statistik <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomCategory(!isCustomCategory)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-color)',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {isCustomCategory ? <ListFilter size={12} /> : <Plus size={12} />}
                    {isCustomCategory ? 'Pilih dari Daftar' : 'Buat Kategori Baru'}
                  </button>
                </div>

                {isCustomCategory ? (
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    placeholder="Ketik kategori baru..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: `1px solid ${errors.category ? '#ef4444' : 'var(--slate-300)'}`,
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <select
                    value={form.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: `1px solid ${errors.category ? '#ef4444' : 'var(--slate-300)'}`,
                      fontSize: 14,
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">-- Pilih Kategori Statistik --</option>
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
                {errors.category && (
                  <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>
                    {errors.category}
                  </span>
                )}
              </div>

              {/* Satuan Nilai */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Satuan Nilai <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomUnit(!isCustomUnit)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-color)',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {isCustomUnit ? <ListFilter size={12} /> : <Plus size={12} />}
                    {isCustomUnit ? 'Pilih dari Daftar' : 'Buat Satuan Baru'}
                  </button>
                </div>

                {isCustomUnit ? (
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(e) => updateField('unit', e.target.value)}
                    placeholder="Ketik satuan baru..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: `1px solid ${errors.unit ? '#ef4444' : 'var(--slate-300)'}`,
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <select
                    value={form.unit}
                    onChange={(e) => updateField('unit', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: `1px solid ${errors.unit ? '#ef4444' : 'var(--slate-300)'}`,
                      fontSize: 14,
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">-- Pilih Satuan Nilai --</option>
                    {availableUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                )}
                {errors.unit && (
                  <span style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: 'block' }}>
                    {errors.unit}
                  </span>
                )}
              </div>
            </div>

            {/* Frekuensi, Cakupan Wilayah, Sumber */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Frekuensi Periode
                </label>
                <select
                  value={form.period_type}
                  onChange={(e) => updateField('period_type', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--slate-300)',
                    fontSize: 14,
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value={PeriodType.YEARLY}>Tahunan (Yearly)</option>
                  <option value={PeriodType.QUARTERLY}>Triwulanan (Quarterly)</option>
                  <option value={PeriodType.MONTHLY}>Bulanan (Monthly)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Cakupan Wilayah
                </label>
                <input
                  type="text"
                  value={form.geographic_scope}
                  onChange={(e) => updateField('geographic_scope', e.target.value)}
                  placeholder="Contoh: Kabupaten Bangka"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--slate-300)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Sumber Data
                </label>
                <input
                  type="text"
                  value={form.source}
                  onChange={(e) => updateField('source', e.target.value)}
                  placeholder="Contoh: BPS Kabupaten Bangka"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--slate-300)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Deskripsi */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Deskripsi Singkat Dataset
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Ringkasan tentang data dan relevansinya..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--slate-300)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Definisi */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Definisi Operasional & Konsep Statistik
              </label>
              <textarea
                rows={4}
                value={form.definition}
                onChange={(e) => updateField('definition', e.target.value)}
                placeholder="Rumus perhitungan, metodologi survei, atau batasan konseptual data..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--slate-300)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Link href={`/datasets/${dataset.id}`}>
              <Button variant="secondary" type="button" disabled={saving}>
                Batal
              </Button>
            </Link>
            <Button
              variant="primary"
              type="submit"
              loading={saving}
              icon={<CheckCircle size={15} />}
            >
              Simpan Perubahan Dataset
            </Button>
          </div>
        </form>
      </div>

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
