'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button, InputField, TextareaField, Toast } from '@/components/ui';
import { DatasetRepo, CategoryRepo } from '@/lib/repository';
import { DataStatus, PeriodType } from '@/lib/types';
import { Database, Sparkles, CheckCircle, AlertCircle, RefreshCw, Plus, ListFilter } from 'lucide-react';

export default function NewDatasetPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);

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
    try {
      setAvailableCategories(DatasetRepo.getDistinctCategories());
      setAvailableUnits(DatasetRepo.getDistinctUnits());
    } catch {}
  }, []);

  // Check code uniqueness
  const isCodeDuplicate = useMemo(() => {
    if (!form.code.trim()) return false;
    try {
      return DatasetRepo.isCodeTaken(form.code);
    } catch {
      return false;
    }
  }, [form.code]);

  const generateSuggestedCode = () => {
    const base = (form.name || form.category || 'DATA')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 4) || 'BPS';
    
    let candidate = `${base}-001`;
    let counter = 1;
    while (DatasetRepo.isCodeTaken(candidate)) {
      counter++;
      candidate = `${base}-${String(counter).padStart(3, '0')}`;
    }
    updateField('code', candidate);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Nama dataset wajib diisi.';
    
    if (!form.code.trim()) {
      errs.code = 'Kode dataset wajib diisi.';
    } else if (DatasetRepo.isCodeTaken(form.code)) {
      errs.code = `Kode dataset "${form.code.toUpperCase()}" sudah digunakan. Gunakan kode unik agar tidak bertabrakan.`;
    }

    if (!form.category.trim()) errs.category = 'Kategori statistik wajib diisi atau dipilih.';
    if (!form.unit.trim()) errs.unit = 'Satuan nilai wajib diisi atau dipilih.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !user) return;

    setSaving(true);
    try {
      // Auto save category if it's new
      if (form.category.trim()) {
        const catExists = CategoryRepo.getAll().some(
          c => c.name.toLowerCase() === form.category.trim().toLowerCase()
        );
        if (!catExists) {
          CategoryRepo.create({
            name: form.category.trim(),
            code: form.category.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5),
            description: 'Kategori baru ditambahkan melalui form dataset',
          });
        }
      }

      const dataset = DatasetRepo.create(
        {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          category: form.category.trim(),
          description: form.description.trim(),
          definition: form.definition.trim(),
          geographic_scope: form.geographic_scope.trim(),
          unit: form.unit.trim(),
          source: form.source.trim(),
          period_type: form.period_type,
          status: DataStatus.DRAFT,
        },
        user.id,
        user.name
      );
      setToast({ msg: 'Dataset baru berhasil didaftarkan.', type: 'success' });
      setTimeout(() => router.push(`/datasets/${dataset.id}`), 800);
    } catch {
      setToast({ msg: 'Gagal membuat dataset. Coba lagi.', type: 'error' });
      setSaving(false);
    }
  };

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

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout>
      <Header
        title="Buat Dataset Baru"
        subtitle="Daftarkan indikator statistik makro baru ke dalam pangkalan data BPS"
        backHref="/datasets"
      />
      <div className="page-content" style={{ maxWidth: 960 }}>
        <div className="section">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                <Database size={18} style={{ color: '#2563eb' }} />
                Informasi Pokok Dataset
              </h2>
              <p className="section-subtitle">
                Tentukan nama, kode unik, kategori statistik, dan satuan nilai untuk dataset ini
              </p>
            </div>
          </div>
          <div className="section-body">
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                {/* Nama Dataset */}
                <div className="form-grid-full">
                  <InputField
                    label="Nama Dataset"
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    error={errors.name}
                    placeholder="Contoh: Jumlah Penduduk Kabupaten Bangka"
                  />
                </div>

                {/* Kode Dataset (Harus Unik) */}
                <div className="input-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label" htmlFor="code">
                      Kode Dataset (Unik)<span className="input-required">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={generateSuggestedCode}
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: '2px 8px', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', border: 'none', background: 'transparent' }}
                      title="Buat rekomendasi kode otomatis yang belum dipakai"
                    >
                      <RefreshCw size={11} /> Buat Kode Unik
                    </button>
                  </div>
                  <input
                    id="code"
                    type="text"
                    required
                    className={`text-input ${isCodeDuplicate ? 'input-error' : form.code && !isCodeDuplicate ? 'input-success' : ''}`}
                    value={form.code}
                    onChange={(e) => updateField('code', e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                    placeholder="Contoh: POP-001 atau PDRB-001"
                    style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}
                  />
                  {isCodeDuplicate ? (
                    <p style={{ color: 'var(--error-text)', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={13} /> Kode &quot;{form.code}&quot; sudah digunakan oleh dataset lain. Kode tidak boleh sama.
                    </p>
                  ) : form.code ? (
                    <p style={{ color: 'var(--success-text)', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={13} /> Kode tersedia dan belum pernah digunakan.
                    </p>
                  ) : (
                    <p className="input-hint">Gunakan format huruf kapital dan strip (contoh: POP-001). Kode harus unik.</p>
                  )}
                  {errors.code && !isCodeDuplicate && <p className="input-error-msg">{errors.code}</p>}
                </div>

                {/* Kategori Statistik (Pilih atau Tambah Manual) */}
                <div className="input-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label">
                      Kategori Statistik<span className="input-required">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomCategory(!isCustomCategory);
                        if (!isCustomCategory) updateField('category', '');
                      }}
                      style={{ fontSize: 11.5, color: 'var(--primary-600)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                    >
                      {isCustomCategory ? (
                        <>
                          <ListFilter size={11} /> Pilih dari Daftar
                        </>
                      ) : (
                        <>
                          <Plus size={11} /> Tambah Kategori Baru
                        </>
                      )}
                    </button>
                  </div>

                  {isCustomCategory ? (
                    <div>
                      <input
                        type="text"
                        className="text-input"
                        placeholder="Ketik nama kategori baru (contoh: Pariwisata & Hotel)"
                        value={form.category}
                        onChange={(e) => updateField('category', e.target.value)}
                        autoFocus
                      />
                      <p className="input-hint">Kategori baru ini akan otomatis tersimpan ke daftar pilihan sistem.</p>
                    </div>
                  ) : (
                    <div className="select-wrapper">
                      <select
                        className="select-input"
                        value={form.category}
                        onChange={(e) => {
                          if (e.target.value === '__NEW__') {
                            setIsCustomCategory(true);
                            updateField('category', '');
                          } else {
                            updateField('category', e.target.value);
                          }
                        }}
                      >
                        <option value="">Pilih kategori statistik yang tersedia</option>
                        {availableCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="__NEW__" style={{ color: 'var(--primary-600)', fontWeight: 600 }}>
                          + Ketik Kategori Baru Manual...
                        </option>
                      </select>
                    </div>
                  )}
                  {errors.category && <p className="input-error-msg">{errors.category}</p>}
                </div>

                {/* Satuan Nilai (Pilih atau Tambah Manual) */}
                <div className="input-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label" htmlFor="unit">
                      Satuan Nilai<span className="input-required">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomUnit(!isCustomUnit);
                        if (!isCustomUnit) updateField('unit', '');
                      }}
                      style={{ fontSize: 11.5, color: 'var(--primary-600)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                    >
                      {isCustomUnit ? (
                        <>
                          <ListFilter size={11} /> Pilih dari Daftar
                        </>
                      ) : (
                        <>
                          <Plus size={11} /> Ketik Satuan Baru
                        </>
                      )}
                    </button>
                  </div>

                  {isCustomUnit ? (
                    <div>
                      <input
                        id="unit"
                        type="text"
                        className="text-input"
                        placeholder="Contoh: Kilogram (Kg), Hektar, Kuintal"
                        value={form.unit}
                        onChange={(e) => updateField('unit', e.target.value)}
                        autoFocus
                      />
                      <p className="input-hint">Satuan ini akan otomatis tercatat dan dapat dipilih untuk dataset berikutnya.</p>
                    </div>
                  ) : (
                    <div className="select-wrapper">
                      <select
                        className="select-input"
                        value={form.unit}
                        onChange={(e) => {
                          if (e.target.value === '__NEW__') {
                            setIsCustomUnit(true);
                            updateField('unit', '');
                          } else {
                            updateField('unit', e.target.value);
                          }
                        }}
                      >
                        <option value="">Pilih satuan nilai statistik</option>
                        {availableUnits.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                        <option value="__NEW__" style={{ color: 'var(--primary-600)', fontWeight: 600 }}>
                          + Ketik Satuan Baru Manual...
                        </option>
                      </select>
                    </div>
                  )}
                  {errors.unit && <p className="input-error-msg">{errors.unit}</p>}

                  {/* Quick suggestion chips */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {['Jiwa', 'Persen (%)', 'Miliar Rupiah', 'Tahun', 'Indeks'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setIsCustomUnit(false);
                          updateField('unit', s);
                        }}
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: form.unit === s ? '1px solid var(--primary-600)' : '1px solid var(--slate-200)',
                          background: form.unit === s ? 'var(--primary-50)' : '#ffffff',
                          color: form.unit === s ? 'var(--primary-700)' : 'var(--slate-600)',
                          cursor: 'pointer',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipe Frekuensi Periode */}
                <div className="input-field">
                  <label className="input-label">Tipe Frekuensi Periode</label>
                  <div className="select-wrapper">
                    <select
                      className="select-input"
                      value={form.period_type}
                      onChange={(e) => updateField('period_type', e.target.value)}
                    >
                      <option value={PeriodType.YEARLY}>Tahunan (Yearly)</option>
                      <option value={PeriodType.QUARTERLY}>Triwulanan (Quarterly)</option>
                      <option value={PeriodType.MONTHLY}>Bulanan (Monthly)</option>
                    </select>
                  </div>
                </div>

                {/* Cakupan Wilayah */}
                <InputField
                  label="Cakupan Wilayah"
                  id="geographic_scope"
                  value={form.geographic_scope}
                  onChange={(e) => updateField('geographic_scope', e.target.value)}
                  placeholder="Kabupaten Bangka"
                />

                {/* Sumber Data */}
                <InputField
                  label="Sumber Data"
                  id="source"
                  value={form.source}
                  onChange={(e) => updateField('source', e.target.value)}
                  placeholder="BPS Kabupaten Bangka"
                />

                {/* Deskripsi Dataset */}
                <div className="form-grid-full">
                  <TextareaField
                    label="Deskripsi Dataset"
                    id="description"
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Jelaskan secara singkat cakupan dan tujuan dataset ini"
                    rows={3}
                  />
                </div>

                {/* Definisi Operasional */}
                <div className="form-grid-full">
                  <TextareaField
                    label="Definisi Operasional / Konsep"
                    id="definition"
                    value={form.definition}
                    onChange={(e) => updateField('definition', e.target.value)}
                    placeholder="Definisi teknis indikator berdasarkan metodologi resmi BPS"
                    rows={3}
                  />
                </div>
              </div>

              <div className="form-actions">
                <Button variant="secondary" type="button" onClick={() => router.push('/datasets')}>
                  Batal
                </Button>
                <Button
                  type="submit"
                  loading={saving}
                  disabled={isCodeDuplicate}
                  icon={<Sparkles size={14} />}
                >
                  Simpan Dataset Baru
                </Button>
              </div>
            </form>
          </div>
        </div>
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
