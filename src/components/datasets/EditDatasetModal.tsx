'use client';

import { useState, useEffect } from 'react';
import { Button, Modal } from '@/components/ui';
import { DatasetRepo, CategoryRepo } from '@/lib/repository';
import { Dataset, DataStatus, PeriodType } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, Check, Pencil, Plus, ListFilter } from 'lucide-react';

interface EditDatasetModalProps {
  dataset: Dataset;
  open: boolean;
  onClose: () => void;
  onSuccess?: (updated: Dataset) => void;
}

export default function EditDatasetModal({
  dataset,
  open,
  onClose,
  onSuccess,
}: EditDatasetModalProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available options from DB
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableUnits, setAvailableUnits] = useState<string[]>([]);

  // Toggles for custom entry
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [isCustomUnit, setIsCustomUnit] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: dataset.name,
    code: dataset.code,
    category: dataset.category,
    unit: dataset.unit,
    period_type: dataset.period_type || PeriodType.YEARLY,
    geographic_scope: dataset.geographic_scope || 'Kabupaten Bangka',
    source: dataset.source || 'BPS Kabupaten Bangka',
    description: dataset.description || '',
    definition: dataset.definition || '',
  });

  // Load distinct categories & units
  useEffect(() => {
    try {
      const cats = DatasetRepo.getDistinctCategories();
      const units = DatasetRepo.getDistinctUnits();
      setAvailableCategories(cats);
      setAvailableUnits(units);

      // Determine if current category/unit is custom
      if (dataset.category && !cats.includes(dataset.category.trim())) {
        setIsCustomCategory(true);
      }
      if (dataset.unit && !units.includes(dataset.unit.trim())) {
        setIsCustomUnit(true);
      }
    } catch {}
  }, [dataset]);

  // Sync form when dataset prop changes
  useEffect(() => {
    setForm({
      name: dataset.name,
      code: dataset.code,
      category: dataset.category,
      unit: dataset.unit,
      period_type: dataset.period_type || PeriodType.YEARLY,
      geographic_scope: dataset.geographic_scope || 'Kabupaten Bangka',
      source: dataset.source || 'BPS Kabupaten Bangka',
      description: dataset.description || '',
      definition: dataset.definition || '',
    });
    setError(null);
  }, [dataset]);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Anda harus login untuk melakukan perubahan.');
      return;
    }

    // Validations
    if (!form.name.trim()) {
      setError('Nama dataset / indikator wajib diisi.');
      return;
    }

    const cleanCode = form.code.trim().toUpperCase();
    if (!cleanCode) {
      setError('Kode unik dataset wajib diisi.');
      return;
    }

    // Check duplicate code excluding this dataset
    if (DatasetRepo.isCodeTaken(cleanCode, dataset.id)) {
      setError(`Kode dataset "${cleanCode}" sudah digunakan oleh dataset lain. Gunakan kode unik.`);
      return;
    }

    if (!form.category.trim()) {
      setError('Kategori statistik wajib diisi atau dipilih.');
      return;
    }

    if (!form.unit.trim()) {
      setError('Satuan nilai wajib diisi atau dipilih.');
      return;
    }

    setSaving(true);
    try {
      // Auto save category if new
      const catTrim = form.category.trim();
      const catExists = CategoryRepo.getAll().some(
        (c) => c.name.toLowerCase() === catTrim.toLowerCase()
      );
      if (!catExists) {
        CategoryRepo.create({
          name: catTrim,
          code: catTrim.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5),
          description: 'Kategori baru ditambahkan melalui edit dataset',
        });
      }

      const updates: Partial<Dataset> = {
        name: form.name.trim(),
        code: cleanCode,
        category: catTrim,
        unit: form.unit.trim(),
        period_type: form.period_type as PeriodType,
        geographic_scope: form.geographic_scope.trim(),
        source: form.source.trim(),
        description: form.description.trim(),
        definition: form.definition.trim(),
      };

      const updated = DatasetRepo.update(dataset.id, updates, user.id, user.name);

      if (updated) {
        onSuccess?.(updated);
        onClose();
      } else {
        setError('Gagal memperbarui dataset. Dataset mungkin tidak ditemukan.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan perubahan.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Dataset & Metadata"
      description={`Perbarui informasi dan spesifikasi metadata untuk "${dataset.name}".`}
      maxWidth={640}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Banner peringatan jika berstatus PUBLISHED */}
        {dataset.status === DataStatus.PUBLISHED && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12.5,
              color: '#1e40af',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              lineHeight: 1.45,
            }}
          >
            <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0, color: '#2563eb' }} />
            <div>
              <strong>Perhatian:</strong> Dataset ini berstatus <strong>PUBLISHED</strong>.
              Perubahan nama, satuan, dan metadata akan langsung tersinkronisasi ke katalog resmi dan chatbot WhatsApp SAPA BPS.
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecdd3',
              borderRadius: 8,
              color: '#b91c1c',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Grid 2 Kolom: Nama & Kode */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
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
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--slate-300)',
                fontSize: 13.5,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
              Kode Unik <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => updateField('code', e.target.value.toUpperCase())}
              placeholder="Contoh: DEMO-001"
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--slate-300)',
                fontSize: 13.5,
                fontFamily: 'monospace',
                fontWeight: 600,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Grid 2 Kolom: Kategori & Satuan */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Kategori */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                Kategori <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomCategory(!isCustomCategory)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-color)',
                  fontSize: 11.5,
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {isCustomCategory ? <ListFilter size={11} /> : <Plus size={11} />}
                {isCustomCategory ? 'Pilih Kategori' : 'Kategori Baru'}
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
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--slate-300)',
                  fontSize: 13.5,
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
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--slate-300)',
                  fontSize: 13.5,
                  background: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">-- Pilih Kategori --</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Satuan Nilai */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                Satuan Nilai <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomUnit(!isCustomUnit)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-color)',
                  fontSize: 11.5,
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {isCustomUnit ? <ListFilter size={11} /> : <Plus size={11} />}
                {isCustomUnit ? 'Pilih Satuan' : 'Satuan Baru'}
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
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--slate-300)',
                  fontSize: 13.5,
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
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--slate-300)',
                  fontSize: 13.5,
                  background: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">-- Pilih Satuan --</option>
                {availableUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Grid 3 Kolom: Frekuensi Periode, Cakupan Wilayah, Sumber Data */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
              Frekuensi Periode
            </label>
            <select
              value={form.period_type}
              onChange={(e) => updateField('period_type', e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--slate-300)',
                fontSize: 13.5,
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
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
              Cakupan Wilayah
            </label>
            <input
              type="text"
              value={form.geographic_scope}
              onChange={(e) => updateField('geographic_scope', e.target.value)}
              placeholder="Contoh: Kabupaten Bangka"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--slate-300)',
                fontSize: 13.5,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
              Sumber Data
            </label>
            <input
              type="text"
              value={form.source}
              onChange={(e) => updateField('source', e.target.value)}
              placeholder="Contoh: BPS Kabupaten Bangka"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--slate-300)',
                fontSize: 13.5,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Deskripsi Singkat */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
            Deskripsi Singkat Dataset
          </label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Ringkasan tentang data dan relevansinya..."
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid var(--slate-300)',
              fontSize: 13.5,
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Definisi Operasional Konsep */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
            Definisi Operasional & Konsep Statistik
          </label>
          <textarea
            rows={3}
            value={form.definition}
            onChange={(e) => updateField('definition', e.target.value)}
            placeholder="Rumus perhitungan, metodologi survei, atau batas konseptual data..."
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid var(--slate-300)',
              fontSize: 13.5,
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" type="submit" loading={saving} icon={<Check size={14} />}>
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
