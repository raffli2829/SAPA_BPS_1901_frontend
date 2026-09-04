// ============================================================
// SAPA BPS 1901 IN — Utility Ekstraksi & Logika Import File
// ============================================================

import type { Dataset } from './types';
import * as XLSX from 'xlsx';

// Daftar sinonim kata kunci untuk pemetaan otomatis variabel statistik
export const VARIABLE_SYNONYMS: Record<string, string[]> = {
  period: [
    'tahun',
    'thn',
    'year',
    'periode',
    'period',
    'th',
    'waktu',
    'time',
    'triwulan',
    'semester',
    'bulan',
  ],
  region: [
    'wilayah',
    'kabupaten',
    'kecamatan',
    'kab',
    'kec',
    'daerah',
    'region',
    'lokasi',
    'area',
    'desa',
    'kelurahan',
    'nama wilayah',
    'nama_wilayah',
  ],
  value: [
    'nilai',
    'value',
    'jumlah',
    'angka',
    'total',
    'capaian',
    'realisasi',
    'besaran',
    'persen',
    'persentase',
    'data',
    'hasil',
    'skor',
    'indeks',
    'kuantum',
    'volume',
  ],
  indicator: [
    'indikator',
    'indicator',
    'variabel',
    'variable',
    'rincian',
    'uraian',
    'keterangan variabel',
    'karakteristik',
    'nama_indikator',
    'nama_data',
    'item',
    'komponen',
    'kategori data',
  ],
  unit: ['satuan', 'unit', 'sat'],
  notes: ['catatan', 'notes', 'keterangan', 'ket', 'metodologi', 'catatan metodologi'],
  source: ['sumber', 'source', 'asal data', 'asal_data', 'sumber data'],
};

/**
 * Pemetaan kolom otomatis berdasarkan sinonim variabel
 */
export function autoMapColumn(columnName: string): string {
  const clean = cleanHeader(columnName).toLowerCase();
  if (!clean) return '';

  for (const [targetField, synonyms] of Object.entries(VARIABLE_SYNONYMS)) {
    for (const syn of synonyms) {
      if (clean === syn || clean.startsWith(`${syn}_`) || clean.endsWith(`_${syn}`) || clean.includes(syn)) {
        return targetField;
      }
    }
  }

  // Jika nama kolom persis angka tahun (misal "2024"), tandai sebagai value jika dalam konteks matrix
  if (/^(19|20)\d{2}$/.test(clean)) {
    return 'value';
  }

  return '';
}

/**
 * Membersihkan header kolom dari UTF-8 BOM, spasi berlebih, dan karakter khusus
 */
export function cleanHeader(header: unknown): string {
  if (header === null || header === undefined) return '';
  return String(header)
    .replace(/^\ufeff/, '') // Bersihkan BOM UTF-8
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
}

/**
 * Parsing angka cerdas yang menangani format Indonesia (titik ribuan, koma desimal),
 * format internasional (koma ribuan, titik desimal), persentase, desimal murni, dan string kosong/strip.
 */
export function parseNumberValue(val: unknown): number | null {
  if (val === null || val === undefined) return null;

  // Jika sudah number dari JavaScript / XLSX
  if (typeof val === 'number') {
    return isFinite(val) ? val : null;
  }

  let str = String(val).trim();
  if (!str) return null;

  // Simbol nilai kosong dalam publikasi statistik BPS
  if (['-', '—', '–', 'na', 'n/a', 'nil', 'null', 'tidak ada', '.'].includes(str.toLowerCase())) {
    return null;
  }

  // Hapus prefix mata uang dan simbol non-numerik di awal/akhir
  str = str.replace(/^(rp\.?|idr)\s*/i, '').replace(/%$/, '').trim();

  // Kasus 1: Mengandung titik DAN koma
  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Format Indonesia / Eropa: 1.234.567,89
      const normalized = str.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(normalized);
      return isFinite(num) ? num : null;
    } else {
      // Format AS / Inggris: 1,234,567.89
      const normalized = str.replace(/,/g, '');
      const num = parseFloat(normalized);
      return isFinite(num) ? num : null;
    }
  }

  // Kasus 2: Hanya mengandung koma (format desimal Indonesia atau ribuan)
  if (str.includes(',')) {
    const parts = str.split(',');
    // Jika format ribuan seperti 1,000,000
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parseInt(parts[0], 10) > 0)) {
      if (parts.length === 2 && parts[1].length !== 3) {
        const num = parseFloat(str.replace(',', '.'));
        return isFinite(num) ? num : null;
      }
    }
    // Default koma sebagai desimal
    const num = parseFloat(str.replace(',', '.'));
    return isFinite(num) ? num : null;
  }

  // Kasus 3: Hanya mengandung titik
  if (str.includes('.')) {
    const parts = str.split('.');
    // Jika terdapat lebih dari 1 titik (misal 1.234.567), ini pasti pemisah ribuan Indonesia
    if (parts.length > 2) {
      const num = parseFloat(str.replace(/\./g, ''));
      return isFinite(num) ? num : null;
    }

    // Jika tepat 1 titik, periksa apakah desimal (misal 4.85 atau 12.5) atau ribuan (misal 324.500)
    const integerPart = parts[0];
    const decimalPart = parts[1];

    if (decimalPart.length === 3 && parseInt(integerPart, 10) >= 1 && parseInt(integerPart, 10) <= 999) {
      if (integerPart === '0') {
        const num = parseFloat(str);
        return isFinite(num) ? num : null;
      }
      const rawFloat = parseFloat(str);
      return isFinite(rawFloat) ? rawFloat : null;
    }

    const num = parseFloat(str);
    return isFinite(num) ? num : null;
  }

  // Angka integer biasa
  const num = parseFloat(str);
  return isFinite(num) ? num : null;
}

/**
 * Membersihkan format periode (misal Excel menyimpan tahun sebagai 2024.0)
 */
export function cleanPeriodValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Jika tahun terformat float seperti 2024.0
  if (/^(19|20)\d{2}\.0+$/.test(str)) {
    str = str.split('.')[0];
  }
  return str;
}

/**
 * Deteksi apakah file memiliki format Matriks / Kolom Tahun (contoh: Wilayah | 2020 | 2021 | 2022 | 2023)
 */
export function detectMatrixFormat(headers: string[]): {
  isMatrix: boolean;
  yearColumns: string[];
  nonYearColumns: string[];
} {
  const cleanedHeaders = headers.map(cleanHeader);
  const yearColumns: string[] = [];
  const nonYearColumns: string[] = [];

  for (const h of cleanedHeaders) {
    if (/^(19|20)\d{2}$/.test(h) || /^(19|20)\d{2}[-\s]?(q[1-4]|tw[1-4]|sm[1-2])$/i.test(h)) {
      yearColumns.push(h);
    } else {
      nonYearColumns.push(h);
    }
  }

  const isMatrix = yearColumns.length >= 2;
  return { isMatrix, yearColumns, nonYearColumns };
}

/**
 * Mengubah data berformat matriks (pivot) menjadi data baris vertikal (unpivot)
 */
export function unpivotMatrixData(
  rows: Record<string, unknown>[],
  yearColumns: string[],
  idColumn: string,
  indicatorColumn?: string
): Record<string, unknown>[] {
  const unpivoted: Record<string, unknown>[] = [];

  for (const row of rows) {
    const regionVal = idColumn ? row[idColumn] : undefined;
    const indicatorVal = indicatorColumn ? row[indicatorColumn] : undefined;

    for (const year of yearColumns) {
      const cellValue = row[year];
      if (cellValue !== undefined && cellValue !== null && String(cellValue).trim() !== '') {
        unpivoted.push({
          ...(regionVal !== undefined ? { region: regionVal } : {}),
          ...(indicatorVal !== undefined ? { indicator: indicatorVal } : {}),
          period: year,
          value: cellValue,
        });
      }
    }
  }

  return unpivoted;
}

/**
 * Pencocokan cerdas dataset berdasarkan nama file, sheet, nama kolom, dan isi data
 */
export function matchDatasetFromFile(
  fileName: string,
  sheetNames: string[],
  headers: string[],
  sampleRows: Record<string, unknown>[],
  datasets: Dataset[]
): { bestMatch: Dataset | null; score: number; reason: string } {
  if (!datasets || datasets.length === 0) {
    return { bestMatch: null, score: 0, reason: '' };
  }

  const tokens = [
    fileName.toLowerCase().replace(/[._-]/g, ' '),
    ...sheetNames.map((s) => s.toLowerCase()),
    ...headers.map((h) => cleanHeader(h).toLowerCase()),
    ...sampleRows.slice(0, 5).flatMap((r) => Object.values(r).map((v) => String(v).toLowerCase())),
  ].join(' ');

  let bestDataset: Dataset | null = null;
  let maxScore = 0;
  let matchReason = '';

  for (const ds of datasets) {
    let score = 0;
    const reasons: string[] = [];

    const dsName = ds.name.toLowerCase();
    const dsCat = ds.category.toLowerCase();
    const dsCode = ds.code.toLowerCase();

    // 1. Cek kecocokan kode dataset persis (misal POP-001, POV-001)
    if (tokens.includes(dsCode) || fileName.toLowerCase().includes(dsCode)) {
      score += 60;
      reasons.push(`Kode dataset cocok (${ds.code})`);
    }

    // 2. Cek kata kunci kategori spesifik
    const categoryKeywords: Record<string, string[]> = {
      'Jumlah Penduduk': ['penduduk', 'populasi', 'jiwa', 'demografi', 'kelahiran', 'kematian'],
      'Data Kemiskinan': ['miskin', 'kemiskinan', 'poverty', 'garis kemiskinan', 'p1', 'p2'],
      'Pertumbuhan Ekonomi': ['ekonomi', 'pertumbuhan', 'laju pertumbuhan', 'adhk'],
      'Indeks Pembangunan Manusia (IPM)': ['ipm', 'hdi', 'pembangunan manusia', 'angka harapan hidup'],
      'Tenaga Kerja': ['pengangguran', 'tpt', 'angkatan kerja', 'tenaga kerja', 'bekerja', 'labor'],
      'Produk Domestik Regional Bruto (PDRB)': ['pdrb', 'grdp', 'domestik', 'adhb', 'lapangan usaha'],
      'Indeks Pembangunan Gender (IPG)': ['gender', 'ipg', 'gdi', 'perempuan'],
      'Angka Partisipasi Sekolah': ['sekolah', 'aps', 'pendidikan', 'partisipasi sekolah', 'apk', 'apm'],
    };

    for (const [catName, kws] of Object.entries(categoryKeywords)) {
      if (dsCat.includes(catName.toLowerCase())) {
        for (const kw of kws) {
          if (tokens.includes(kw)) {
            score += 25;
            reasons.push(`Kata kunci kategori terdeteksi ("${kw}")`);
            break;
          }
        }
      }
    }

    // 3. Cek kecocokan nama dataset
    const dsWords = dsName.split(/\s+/).filter((w) => w.length > 3 && !['data', 'kabupaten', 'bangka', 'tahun'].includes(w));
    let matchedWords = 0;
    for (const word of dsWords) {
      if (tokens.includes(word)) {
        matchedWords++;
      }
    }
    if (matchedWords > 0) {
      score += matchedWords * 15;
      reasons.push(`${matchedWords} kata nama dataset cocok`);
    }

    // 4. Cek kesesuaian satuan nilai (unit)
    if (ds.unit && tokens.includes(ds.unit.toLowerCase())) {
      score += 10;
      reasons.push(`Satuan nilai cocok (${ds.unit})`);
    }

    if (score > maxScore) {
      maxScore = score;
      bestDataset = ds;
      matchReason = reasons.slice(0, 2).join(', ');
    }
  }

  if (maxScore >= 25 && bestDataset) {
    return { bestMatch: bestDataset, score: maxScore, reason: matchReason };
  }

  return { bestMatch: null, score: 0, reason: '' };
}

/**
 * Mengunduh file template contoh data statistik (Standar & Matriks)
 */
export function downloadSampleTemplate(format: 'standard' | 'matrix', fileType: 'csv' | 'xlsx'): void {
  let data: Record<string, string | number>[];
  let fileName: string;

  if (format === 'standard') {
    fileName = `template_statistik_standar.${fileType}`;
    data = [
      {
        'Wilayah': 'Kabupaten Bangka',
        'Indikator': 'Jumlah Penduduk',
        'Tahun': 2021,
        'Nilai': 324200,
        'Satuan': 'Jiwa',
        'Catatan': 'Data proyeksi SP2020',
      },
      {
        'Wilayah': 'Kabupaten Bangka',
        'Indikator': 'Jumlah Penduduk',
        'Tahun': 2022,
        'Nilai': 327100,
        'Satuan': 'Jiwa',
        'Catatan': 'Data proyeksi SP2020',
      },
      {
        'Wilayah': 'Kabupaten Bangka',
        'Indikator': 'Jumlah Penduduk',
        'Tahun': 2023,
        'Nilai': 330050,
        'Satuan': 'Jiwa',
        'Catatan': 'Data proyeksi SP2020',
      },
      {
        'Wilayah': 'Kabupaten Bangka',
        'Indikator': 'Jumlah Penduduk',
        'Tahun': 2024,
        'Nilai': 333400,
        'Satuan': 'Jiwa',
        'Catatan': 'Data proyeksi SP2020',
      },
    ];
  } else {
    fileName = `template_statistik_matriks.${fileType}`;
    data = [
      {
        'Kecamatan': 'Sungailiat',
        'Indikator': 'Persentase Penduduk Miskin',
        '2020': 4.75,
        '2021': 4.62,
        '2022': 4.51,
        '2023': 4.38,
        '2024': 4.25,
      },
      {
        'Kecamatan': 'Belinyu',
        'Indikator': 'Persentase Penduduk Miskin',
        '2020': 5.20,
        '2021': 5.05,
        '2022': 4.90,
        '2023': 4.78,
        '2024': 4.65,
      },
      {
        'Kecamatan': 'Mendo Barat',
        'Indikator': 'Persentase Penduduk Miskin',
        '2020': 5.80,
        '2021': 5.65,
        '2022': 5.48,
        '2023': 5.30,
        '2024': 5.15,
      },
    ];
  }

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TemplateData');

  if (fileType === 'xlsx') {
    XLSX.writeFile(wb, fileName);
  } else {
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
