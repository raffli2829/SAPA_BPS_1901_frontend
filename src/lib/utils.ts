// ============================================================
// SAPA BPS 1901 IN — Utility Functions
// ============================================================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID').format(value);
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function getPeriodRange(records: { period: string }[]): string {
  if (!records.length) return '-';
  const periods = records.map((r) => r.period).sort();
  const first = periods[0];
  const last = periods[periods.length - 1];
  if (first === last) return first;
  return `${first}–${last}`;
}

export function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return formatDateShort(dateStr);
}

export function parseTabSeparated(text: string): string[][] {
  if (!text || !text.trim()) return [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.map((line) => {
    // 1. Jika ada karakter Tab (standar copy dari Excel / Google Sheets)
    if (line.includes('\t')) {
      return line
        .split('\t')
        .map((cell) => cell.trim())
        .filter((c) => c.length > 0);
    }

    // 2. Jika dipisahkan oleh titik koma (format CSV lokal Indonesia)
    if (line.includes(';')) {
      return line
        .split(';')
        .map((cell) => cell.trim())
        .filter((c) => c.length > 0);
    }

    // 3. Jika dipisahkan oleh pipa (|)
    if (line.includes('|')) {
      return line
        .split('|')
        .map((cell) => cell.trim())
        .filter((c) => c.length > 0);
    }

    // 4. Jika terdapat 2 spasi atau lebih berurutan
    if (/\s{2,}/.test(line)) {
      return line
        .split(/\s{2,}/)
        .map((cell) => cell.trim())
        .filter((c) => c.length > 0);
    }

    // 5. Jika dipisahkan koma dengan spasi (misal: "2020, 8%")
    if (/\d\s*,\s*[^\d]/.test(line) || /,\s+/.test(line)) {
      return line
        .split(/,\s*/)
        .map((cell) => cell.trim())
        .filter((c) => c.length > 0);
    }

    // 6. Jika dipisahkan satu spasi dan bagian paling kanan adalah angka/persen (contoh: "2020 8%", "2021 7%")
    const matchLastNum = line.match(/^(.*?)\s+([-+]?[\d.,]+%?)\s*$/);
    if (matchLastNum) {
      return [matchLastNum[1].trim(), matchLastNum[2].trim()];
    }

    // 7. Pemisahan umum berdasarkan spasi jika ada minimal 2 elemen
    const parts = line
      .split(/\s+/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (parts.length >= 2) {
      return [parts.slice(0, parts.length - 1).join(' '), parts[parts.length - 1]];
    }

    return [line];
  });
}

export function detectChangeAnomaly(
  currentValue: number,
  previousValue: number,
  threshold: number = 100
): boolean {
  if (previousValue === 0) return currentValue > 0;
  const changePercent = Math.abs(
    ((currentValue - previousValue) / previousValue) * 100
  );
  return changePercent > threshold;
}

export function truncateText(text: string, maxLength: number = 80): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
