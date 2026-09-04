// ============================================================
// SAPA BPS 1901 IN — Repository / Data Access Layer
// ============================================================
// Mock implementation using in-memory storage.
// Replace with real database calls when ready.
// ============================================================

import {
  Dataset,
  DataRecord,
  DataStatus,
  AuditLog,
  AuditAction,
  AuditChange,
  User,
  UserRole,
  ReviewRequest,
  DashboardSummary,
  Category,
  ValidationError,
  AnomalyWarning,
  ChatbotTemplate,
} from './types';
import {
  MOCK_DATASETS,
  MOCK_RECORDS,
  MOCK_USERS,
  MOCK_REVIEWS,
  MOCK_AUDIT_LOGS,
  CATEGORIES,
} from './mock-data';
import { generateId, detectChangeAnomaly } from './utils';
import { BackendApi, getEffectiveBackendUrl } from './apiClient';

// --- In-Memory Store ---

const STORAGE_KEY = 'sapa_bps_data';

interface AppStore {
  datasets: Dataset[];
  records: DataRecord[];
  users: User[];
  reviews: ReviewRequest[];
  auditLogs: AuditLog[];
  categories: Category[];
}

function getInitialStore(): AppStore {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore parse errors
    }
  }
  return {
    datasets: [...MOCK_DATASETS],
    records: [...MOCK_RECORDS],
    users: [...MOCK_USERS],
    reviews: [...MOCK_REVIEWS],
    auditLogs: [...MOCK_AUDIT_LOGS],
    categories: [...CATEGORIES],
  };
}

let store: AppStore | null = null;

function getStore(): AppStore {
  if (!store) {
    store = getInitialStore();
  }
  return store;
}

function saveStore(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getStore()));
    } catch {
      // localStorage full or unavailable
    }
  }
}

// Notify listeners
type Listener = () => void;
const listeners: Set<Listener> = new Set();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  saveStore();
  listeners.forEach((l) => l());
}

// ============================================================
// STATUS KONEKSI BACKEND DAN DATABASE REAKTIF
// ============================================================

export interface BackendConnectionState {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  targetUrl: string;
}

let connectionState: BackendConnectionState = {
  isConnected: false,
  isSyncing: false,
  lastSyncedAt: null,
  targetUrl: '',
};

type ConnectionListener = (state: BackendConnectionState) => void;
const connectionListeners: Set<ConnectionListener> = new Set();

export function subscribeBackendStatus(listener: ConnectionListener): () => void {
  connectionListeners.add(listener);
  listener(connectionState);
  return () => connectionListeners.delete(listener);
}

export function getBackendStatus(): BackendConnectionState {
  return connectionState;
}

function updateBackendStatus(partial: Partial<BackendConnectionState>) {
  connectionState = {
    ...connectionState,
    ...partial,
    targetUrl: getEffectiveBackendUrl(),
  };
  connectionListeners.forEach((l) => l(connectionState));
}

let isSyncing = false;
const pendingDeletedDatasets = new Set<string>();
const pendingDeletedRecords = new Set<string>();

/**
 * Sinkronisasi data real-time dua arah dengan backend Express / db_store.json
 */
export async function syncWithBackend(): Promise<void> {
  if (typeof window === 'undefined' || isSyncing) return;
  isSyncing = true;
  updateBackendStatus({ isSyncing: true });

  try {
    const currentStore = getStore();

    // 1. Prioritaskan Full Snapshot Sync dua arah:
    // Kirim data lokal saat ini (termasuk input terbaru dan id yang dihapus) ke backend, dan terima database gabungan yang utuh.
    const syncRes = await BackendApi.syncStore({
      datasets: currentStore.datasets,
      records: currentStore.records,
      categories: currentStore.categories,
      users: currentStore.users,
      reviews: currentStore.reviews,
      auditLogs: currentStore.auditLogs,
      deleted_dataset_ids: Array.from(pendingDeletedDatasets),
      deleted_record_ids: Array.from(pendingDeletedRecords),
    });

    if (syncRes && Array.isArray(syncRes.datasets)) {
      pendingDeletedDatasets.clear();
      pendingDeletedRecords.clear();

      currentStore.datasets = syncRes.datasets;
      if (Array.isArray(syncRes.records)) currentStore.records = syncRes.records;
      if (Array.isArray(syncRes.categories)) currentStore.categories = syncRes.categories;
      if (Array.isArray(syncRes.users)) currentStore.users = syncRes.users;
      if (Array.isArray(syncRes.reviews)) currentStore.reviews = syncRes.reviews;
      if (Array.isArray(syncRes.auditLogs)) currentStore.auditLogs = syncRes.auditLogs;

      notify();
      updateBackendStatus({ isConnected: true, isSyncing: false, lastSyncedAt: new Date() });
      return;
    }

    // 2. Fallback REST API individual jika endpoint sync khusus belum merespons
    const [datasets, records, reviews, auditLogs, users, categories] = await Promise.all([
      BackendApi.getDatasets(),
      BackendApi.getRecords(),
      BackendApi.getReviews(),
      BackendApi.getAuditLogs(),
      BackendApi.getUsers(),
      BackendApi.getCategories(),
    ]);

    let hasChanges = false;

    if (datasets && datasets.length > 0) {
      currentStore.datasets = datasets;
      hasChanges = true;
    }
    if (records && records.length > 0) {
      currentStore.records = records;
      hasChanges = true;
    }
    if (reviews && reviews.length > 0) {
      currentStore.reviews = reviews;
      hasChanges = true;
    }
    if (auditLogs && auditLogs.length > 0) {
      currentStore.auditLogs = auditLogs;
      hasChanges = true;
    }
    if (users && users.length > 0) {
      currentStore.users = users;
      hasChanges = true;
    }
    if (categories && categories.length > 0) {
      currentStore.categories = categories;
      hasChanges = true;
    }

    const isLive = Boolean(syncRes || datasets || records || categories || users);

    if (hasChanges) {
      notify();
    }

    if (isLive) {
      updateBackendStatus({ isConnected: true, isSyncing: false, lastSyncedAt: new Date() });
    } else {
      updateBackendStatus({ isConnected: false, isSyncing: false });
    }
  } catch (err) {
    console.warn('[Backend Sync] Menggunakan data lokal (backend offline):', err);
    updateBackendStatus({ isConnected: false, isSyncing: false });
  } finally {
    isSyncing = false;
  }
}

// Auto sync on client initialization & periodic background reconciliation
if (typeof window !== 'undefined') {
  // Sync segera begitu client browser siap
  setTimeout(() => {
    syncWithBackend();
  }, 100);

  // Sync berkala setiap 25 detik agar frontend selalu mengikuti perubahan di server/WhatsApp
  setInterval(() => {
    syncWithBackend();
  }, 25000);

  // Sync saat pengguna kembali ke tab ini
  window.addEventListener('focus', () => {
    syncWithBackend();
  });
}

// --- Reset ---

export function resetStore(): void {
  store = {
    datasets: [...MOCK_DATASETS],
    records: [...MOCK_RECORDS],
    users: [...MOCK_USERS],
    reviews: [...MOCK_REVIEWS],
    auditLogs: [...MOCK_AUDIT_LOGS],
    categories: [...CATEGORIES],
  };
  saveStore();
  notify();
}

// ============================================================
// CATEGORY REPOSITORY
// ============================================================

export const CategoryRepo = {
  getAll(): Category[] {
    return getStore().categories;
  },

  getById(id: string): Category | undefined {
    return getStore().categories.find((c) => c.id === id);
  },

  getByName(name: string): Category | undefined {
    return getStore().categories.find((c) => c.name === name);
  },

  create(data: Omit<Category, 'id'>): Category {
    const category: Category = { id: generateId(), ...data };
    getStore().categories.push(category);
    BackendApi.createCategory(category).catch(() => {});
    notify();
    syncWithBackend().catch(() => {});
    return category;
  },

  update(id: string, updates: Partial<Category>): Category | undefined {
    const s = getStore();
    const idx = s.categories.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    s.categories[idx] = { ...s.categories[idx], ...updates };
    BackendApi.updateCategory(id, updates).catch(() => {});
    notify();
    syncWithBackend().catch(() => {});
    return s.categories[idx];
  },

  delete(id: string): boolean {
    const s = getStore();
    const idx = s.categories.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    s.categories.splice(idx, 1);
    BackendApi.deleteCategory(id).catch(() => {});
    notify();
    syncWithBackend().catch(() => {});
    return true;
  },
};

// ============================================================
// DATASET REPOSITORY
// ============================================================

export const DatasetRepo = {
  getAll(): Dataset[] {
    return getStore().datasets.map((ds) => ({
      ...ds,
      record_count: getStore().records.filter(
        (r) => r.dataset_id === ds.id && !r.is_deleted
      ).length,
    }));
  },

  getById(id: string): Dataset | undefined {
    const ds = getStore().datasets.find((d) => d.id === id);
    if (!ds) return undefined;
    return {
      ...ds,
      record_count: getStore().records.filter(
        (r) => r.dataset_id === ds.id && !r.is_deleted
      ).length,
    };
  },

  getPublished(): Dataset[] {
    return this.getAll().filter((d) => d.status === DataStatus.PUBLISHED);
  },

  search(query: string): Dataset[] {
    const q = query.toLowerCase();
    return this.getAll().filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.geographic_scope.toLowerCase().includes(q)
    );
  },

  getDistinctCategories(): string[] {
    const fromCategories = getStore().categories.map((c) => c.name.trim()).filter(Boolean);
    const fromDatasets = getStore().datasets.map((d) => d.category?.trim()).filter(Boolean);
    return Array.from(new Set([...fromCategories, ...fromDatasets])).sort((a, b) => a.localeCompare('id'));
  },

  getDistinctUnits(): string[] {
    const defaults = [
      'Jiwa',
      'Ribu Jiwa',
      'Persen (%)',
      'Miliar Rupiah',
      'Triliun Rupiah',
      'Tahun',
      'Indeks',
      'Ton',
      'Rupiah / Kapita / Bulan',
      'Rupiah / Tahun',
      'Ha (Hektar)',
      'Orang',
      'Unit',
    ];
    const fromDatasets = getStore().datasets.map((d) => d.unit?.trim()).filter(Boolean);
    const fromRecords = getStore().records.map((r) => r.unit?.trim()).filter(Boolean);
    return Array.from(new Set([...defaults, ...fromDatasets, ...fromRecords])).sort((a, b) => a.localeCompare('id'));
  },

  isCodeTaken(code: string, excludeDatasetId?: string): boolean {
    const clean = code.trim().toUpperCase();
    if (!clean) return false;
    return getStore().datasets.some(
      (d) => d.code.trim().toUpperCase() === clean && d.id !== excludeDatasetId
    );
  },

  create(
    data: Omit<Dataset, 'id' | 'created_at' | 'updated_at' | 'record_count' | 'created_by' | 'updated_by'>,
    userId: string,
    userName: string
  ): Dataset {
    const now = new Date().toISOString();
    const dataset: Dataset = {
      id: generateId(),
      ...data,
      created_by: userId,
      updated_by: userId,
      created_at: now,
      updated_at: now,
    };
    getStore().datasets.push(dataset);

    // Audit log
    AuditRepo.log({
      entity_type: 'dataset',
      entity_id: dataset.id,
      entity_name: dataset.name,
      action: AuditAction.CREATE,
      changes: [],
      user_id: userId,
      user_name: userName,
    });

    BackendApi.createDataset(dataset).catch(() => {});
    notify();
    syncWithBackend().catch(() => {});
    return dataset;
  },

  update(
    id: string,
    updates: Partial<Dataset>,
    userId: string,
    userName: string
  ): Dataset | undefined {
    const s = getStore();
    const index = s.datasets.findIndex((d) => d.id === id);
    if (index === -1) return undefined;

    const old = s.datasets[index];
    const changes: AuditChange[] = [];

    for (const key of Object.keys(updates) as (keyof Dataset)[]) {
      if (updates[key] !== old[key]) {
        changes.push({
          field: key,
          old_value: old[key] as string | number | null,
          new_value: updates[key] as string | number | null,
        });
      }
    }

    s.datasets[index] = {
      ...old,
      ...updates,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    if (changes.length > 0) {
      AuditRepo.log({
        entity_type: 'dataset',
        entity_id: id,
        entity_name: s.datasets[index].name,
        action: AuditAction.UPDATE,
        changes,
        user_id: userId,
        user_name: userName,
      });
    }

    BackendApi.updateDataset(id, updates).catch(() => {});
    notify();
    syncWithBackend().catch(() => {});
    return s.datasets[index];
  },

  updateStatus(
    id: string,
    status: DataStatus,
    userId: string,
    userName: string,
    reason?: string
  ): Dataset | undefined {
    const s = getStore();
    const index = s.datasets.findIndex((d) => d.id === id);
    if (index === -1) return undefined;

    const old = s.datasets[index];
    const actionMap: Record<string, AuditAction> = {
      [`${DataStatus.DRAFT}_${DataStatus.REVIEW}`]: AuditAction.SUBMIT_REVIEW,
      [`${DataStatus.REVIEW}_${DataStatus.PUBLISHED}`]: AuditAction.APPROVE,
      [`${DataStatus.REVIEW}_${DataStatus.DRAFT}`]: AuditAction.REJECT,
      [`${DataStatus.PUBLISHED}_${DataStatus.ARCHIVED}`]: AuditAction.ARCHIVE,
    };

    const action =
      actionMap[`${old.status}_${status}`] || AuditAction.STATUS_CHANGE;

    s.datasets[index] = {
      ...old,
      status,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    // Also update records status if publishing/archiving
    if (status === DataStatus.PUBLISHED || status === DataStatus.ARCHIVED) {
      s.records
        .filter((r) => r.dataset_id === id && !r.is_deleted)
        .forEach((r) => {
          r.status = status;
          r.updated_by = userId;
          r.updated_at = new Date().toISOString();
        });
    }

    AuditRepo.log({
      entity_type: 'dataset',
      entity_id: id,
      entity_name: s.datasets[index].name,
      action,
      changes: [
        { field: 'status', old_value: old.status, new_value: status },
      ],
      user_id: userId,
      user_name: userName,
      reason,
    });

    BackendApi.updateDataset(id, { status }).catch(() => {});
    notify();
    return s.datasets[index];
  },

  delete(id: string, userId: string, userName: string): boolean {
    const s = getStore();
    const index = s.datasets.findIndex((d) => d.id === id);
    if (index === -1) return false;

    const dataset = s.datasets[index];
    pendingDeletedDatasets.add(id);

    // Hapus total dataset dari daftar agar tidak muncul di katalog jika salah buat
    s.datasets.splice(index, 1);

    // Hapus seluruh data record terkait dataset ini
    s.records = s.records.filter((r) => r.dataset_id !== id);

    AuditRepo.log({
      entity_type: 'dataset',
      entity_id: id,
      entity_name: dataset.name,
      action: AuditAction.ARCHIVE,
      changes: [{ field: 'dataset', old_value: dataset.name, new_value: null }],
      user_id: userId,
      user_name: userName,
      reason: 'Dataset dihapus oleh pengguna karena salah buat',
    });

    BackendApi.deleteDataset(id).catch(() => {});
    notify();
    syncWithBackend().catch(() => {});
    return true;
  },
};

// ============================================================
// DATA RECORD REPOSITORY
// ============================================================

export const RecordRepo = {
  getAll(): DataRecord[] {
    return getStore()
      .records.filter((r) => !r.is_deleted)
      .sort((a, b) => a.period.localeCompare(b.period));
  },

  getByDataset(datasetId: string): DataRecord[] {
    return getStore()
      .records.filter((r) => r.dataset_id === datasetId && !r.is_deleted)
      .sort((a, b) => a.period.localeCompare(b.period));
  },

  getById(id: string): DataRecord | undefined {
    return getStore().records.find((r) => r.id === id && !r.is_deleted);
  },

  getByStatus(status: DataStatus): DataRecord[] {
    return getStore().records.filter(
      (r) => r.status === status && !r.is_deleted
    );
  },

  create(
    data: Omit<
      DataRecord,
      'id' | 'created_at' | 'updated_at' | 'is_deleted'
    >,
    userName: string
  ): DataRecord {
    const now = new Date().toISOString();
    const record: DataRecord = {
      id: generateId(),
      ...data,
      created_at: now,
      updated_at: now,
      is_deleted: false,
    };
    getStore().records.push(record);

    AuditRepo.log({
      entity_type: 'record',
      entity_id: record.id,
      entity_name: `${record.indicator} ${record.period}`,
      action: AuditAction.CREATE,
      changes: [{ field: 'value', old_value: null, new_value: record.value }],
      user_id: data.created_by,
      user_name: userName,
    });

    // Update dataset's updated_at
    const ds = getStore().datasets.find((d) => d.id === data.dataset_id);
    if (ds) {
      ds.updated_at = now;
      ds.updated_by = data.created_by;
    }

    BackendApi.createRecord(record).catch(() => {});
    notify();
    syncWithBackend().catch(() => {});
    return record;
  },

  createBulk(
    records: Omit<
      DataRecord,
      'id' | 'created_at' | 'updated_at' | 'is_deleted'
    >[],
    userName: string
  ): DataRecord[] {
    const now = new Date().toISOString();
    const created: DataRecord[] = records.map((data) => ({
      id: generateId(),
      ...data,
      created_at: now,
      updated_at: now,
      is_deleted: false,
    }));

    getStore().records.push(...created);

    // Single audit log for bulk
    if (created.length > 0) {
      AuditRepo.log({
        entity_type: 'record',
        entity_id: created[0].dataset_id,
        entity_name: `${created.length} data records`,
        action: AuditAction.CREATE,
        changes: created.map((r) => ({
          field: `${r.indicator} ${r.period}`,
          old_value: null,
          new_value: r.value,
        })),
        user_id: records[0].created_by,
        user_name: userName,
      });

      // Update dataset
      const ds = getStore().datasets.find(
        (d) => d.id === created[0].dataset_id
      );
      if (ds) {
        ds.updated_at = now;
        ds.updated_by = records[0].created_by;
      }

      BackendApi.bulkSaveRecords(created[0].dataset_id, created).catch(() => {});
    }

    notify();
    syncWithBackend().catch(() => {});
    return created;
  },

  update(
    id: string,
    updates: Partial<DataRecord>,
    userId: string,
    userName: string,
    reason?: string
  ): DataRecord | undefined {
    const s = getStore();
    const index = s.records.findIndex((r) => r.id === id);
    if (index === -1) return undefined;

    const old = s.records[index];
    const changes: AuditChange[] = [];

    for (const key of Object.keys(updates) as (keyof DataRecord)[]) {
      if (updates[key] !== old[key]) {
        changes.push({
          field: key,
          old_value: old[key] as string | number | null,
          new_value: updates[key] as string | number | null,
        });
      }
    }

    s.records[index] = {
      ...old,
      ...updates,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    if (changes.length > 0) {
      AuditRepo.log({
        entity_type: 'record',
        entity_id: id,
        entity_name: `${s.records[index].indicator} ${s.records[index].period}`,
        action: AuditAction.UPDATE,
        changes,
        user_id: userId,
        user_name: userName,
        reason: reason || 'Pembaruan nilai data',
      });
    }

    BackendApi.updateRecord(id, updates).catch(() => {});
    notify();
    syncWithBackend().catch(() => {});
    return s.records[index];
  },

  delete(id: string, userId: string, userName: string): boolean {
    const record = getStore().records.find((r) => r.id === id);
    if (!record) return false;

    pendingDeletedRecords.add(id);
    record.is_deleted = true;
    record.updated_by = userId;
    record.updated_at = new Date().toISOString();

    AuditRepo.log({
      entity_type: 'record',
      entity_id: id,
      entity_name: `${record.indicator} ${record.period}`,
      action: AuditAction.DELETE,
      changes: [{ field: 'value', old_value: record.value, new_value: null }],
      user_id: userId,
      user_name: userName,
    });

    BackendApi.deleteRecord(id).catch(() => {});
    notify();
    syncWithBackend().catch(() => {});
    return true;
  },

  checkDuplicate(
    datasetId: string,
    indicator: string,
    region: string,
    period: string,
    excludeId?: string
  ): boolean {
    return getStore().records.some(
      (r) =>
        r.dataset_id === datasetId &&
        r.indicator === indicator &&
        r.region === region &&
        r.period === period &&
        !r.is_deleted &&
        r.id !== excludeId
    );
  },

  checkAnomalies(
    datasetId: string,
    indicator: string,
    region: string,
    value: number
  ): AnomalyWarning | null {
    const existing = getStore()
      .records.filter(
        (r) =>
          r.dataset_id === datasetId &&
          r.indicator === indicator &&
          r.region === region &&
          !r.is_deleted &&
          r.value !== null
      )
      .sort((a, b) => b.period.localeCompare(a.period));

    if (existing.length === 0) return null;

    const latest = existing[0];
    if (latest.value !== null && detectChangeAnomaly(value, latest.value)) {
      const changePercent =
        ((value - latest.value) / latest.value) * 100;
      return {
        record_id: latest.id,
        field: 'value',
        current_value: value,
        previous_value: latest.value,
        change_percent: changePercent,
        message: `Perubahan nilai terlihat sangat besar (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%). Periksa kembali apakah nilai ${value.toLocaleString('id-ID')} sudah benar.`,
      };
    }

    return null;
  },

  confirmAnomaly(
    recordId: string,
    userId: string,
    userName: string,
    customNote?: string
  ): boolean {
    const record = getStore().records.find((r) => r.id === recordId);
    if (!record) return false;

    const tag = '[Dikonfirmasi Valid]';
    if (!record.notes.includes(tag)) {
      record.notes = record.notes ? `${record.notes} ${tag}` : tag;
    }
    if (customNote) {
      record.notes = `${record.notes} - ${customNote}`;
    }
    record.updated_at = new Date().toISOString();
    record.updated_by = userId;

    AuditRepo.log({
      entity_type: 'record',
      entity_id: record.id,
      entity_name: `${record.indicator} (${record.period})`,
      action: AuditAction.VERIFY_ANOMALY,
      changes: [{ field: 'notes', old_value: '', new_value: record.notes }],
      user_id: userId,
      user_name: userName,
      reason: customNote || 'Data telah diverifikasi dan disetujui sebagai data valid lapangan.',
    });

    BackendApi.updateRecord(record.id, record).catch(() => {});
    notify();
    return true;
  },
};

// ============================================================
// AUDIT LOG REPOSITORY
// ============================================================

export const AuditRepo = {
  getAll(): AuditLog[] {
    return getStore().auditLogs.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  getByEntity(entityId: string): AuditLog[] {
    return getStore()
      .auditLogs.filter((l) => l.entity_id === entityId)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },

  getByDataset(datasetId: string): AuditLog[] {
    // Get logs for the dataset and its records
    const recordIds = getStore()
      .records.filter((r) => r.dataset_id === datasetId)
      .map((r) => r.id);

    return getStore()
      .auditLogs.filter(
        (l) => l.entity_id === datasetId || recordIds.includes(l.entity_id)
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },

  log(data: Omit<AuditLog, 'id' | 'created_at'> & { reason?: string }): void {
    const log: AuditLog = {
      id: generateId(),
      ...data,
      created_at: new Date().toISOString(),
    };
    getStore().auditLogs.push(log);
    BackendApi.logAudit(log).catch(() => {});
    // Don't call notify() here to avoid infinite loops
  },
};

// ============================================================
// REVIEW REPOSITORY
// ============================================================

export const ReviewRepo = {
  getAll(): ReviewRequest[] {
    return getStore().reviews.sort(
      (a, b) =>
        new Date(b.submitted_at).getTime() -
        new Date(a.submitted_at).getTime()
    );
  },

  getPending(): ReviewRequest[] {
    return this.getAll().filter((r) => r.status === 'PENDING');
  },

  getById(id: string): ReviewRequest | undefined {
    return getStore().reviews.find((r) => r.id === id);
  },

  create(
    data: Omit<ReviewRequest, 'id' | 'submitted_at' | 'status'>
  ): ReviewRequest {
    const review: ReviewRequest = {
      id: generateId(),
      ...data,
      submitted_at: new Date().toISOString(),
      status: 'PENDING',
    };
    getStore().reviews.push(review);

    // Update dataset status to REVIEW
    DatasetRepo.updateStatus(
      data.dataset_id,
      DataStatus.REVIEW,
      data.submitted_by,
      data.submitted_by_name
    );

    BackendApi.submitReview(data).catch(() => {});
    notify();
    return review;
  },

  approve(
    id: string,
    reviewerId: string,
    reviewerName: string
  ): ReviewRequest | undefined {
    const review = getStore().reviews.find((r) => r.id === id);
    if (!review) return undefined;

    review.status = 'APPROVED';
    review.reviewed_by = reviewerId;
    review.reviewed_by_name = reviewerName;
    review.reviewed_at = new Date().toISOString();

    // Update dataset status to PUBLISHED
    DatasetRepo.updateStatus(
      review.dataset_id,
      DataStatus.PUBLISHED,
      reviewerId,
      reviewerName
    );

    BackendApi.approveReview(id, reviewerId).catch(() => {});
    notify();
    return review;
  },

  reject(
    id: string,
    reviewerId: string,
    reviewerName: string,
    reason: string
  ): ReviewRequest | undefined {
    const review = getStore().reviews.find((r) => r.id === id);
    if (!review) return undefined;

    review.status = 'REJECTED';
    review.reviewed_by = reviewerId;
    review.reviewed_by_name = reviewerName;
    review.reviewed_at = new Date().toISOString();
    review.reject_reason = reason;

    // Update dataset status back to DRAFT
    DatasetRepo.updateStatus(
      review.dataset_id,
      DataStatus.DRAFT,
      reviewerId,
      reviewerName,
      reason
    );

    BackendApi.rejectReview(id, reviewerId, reason).catch(() => {});
    notify();
    return review;
  },
};

// ============================================================
// USER REPOSITORY
// ============================================================

export const UserRepo = {
  getAll(): User[] {
    return getStore().users;
  },

  getById(id: string): User | undefined {
    return getStore().users.find((u) => u.id === id);
  },

  getByEmail(email: string): User | undefined {
    return getStore().users.find((u) => u.email === email);
  },

  create(data: Omit<User, 'id' | 'created_at'>): User {
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: data.name.trim(),
      email: data.email.trim(),
      role: data.role || UserRole.DATA_ENTRY,
      created_at: new Date().toISOString(),
    };
    getStore().users.push(newUser);
    BackendApi.createUser(newUser).catch(() => {});
    notify();
    return newUser;
  },

  update(id: string, data: Partial<Omit<User, 'id'>>): User | undefined {
    const user = getStore().users.find((u) => u.id === id);
    if (!user) return undefined;
    if (data.name) user.name = data.name.trim();
    if (data.email) user.email = data.email.trim();
    if (data.role) user.role = data.role;
    BackendApi.updateUser(id, data).catch(() => {});
    notify();
    return user;
  },

  delete(id: string): boolean {
    const idx = getStore().users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    getStore().users.splice(idx, 1);
    BackendApi.deleteUser(id).catch(() => {});
    notify();
    return true;
  },
};

// ============================================================
// DASHBOARD
// ============================================================

export function getDashboardSummary(): DashboardSummary {
  const datasets = DatasetRepo.getAll();
  const records = getStore().records.filter((r) => !r.is_deleted);

  // Hitung jumlah data yang memerlukan verifikasi lapangan (fluktuasi tajam yang belum dikonfirmasi)
  const activeDatasets = datasets.filter((d) => d.status !== DataStatus.ARCHIVED);
  let pendingVerifikasiCount = 0;
  activeDatasets.forEach((ds) => {
    const dsRecords = records
      .filter((r) => r.dataset_id === ds.id && r.value !== null && !isNaN(r.value))
      .sort((a, b) => a.period.localeCompare(b.period));

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
          if (Math.abs(changePercent) >= 25) {
            const isConfirmed = curr.notes?.includes('[Dikonfirmasi Valid]') || false;
            if (!isConfirmed) pendingVerifikasiCount++;
          }
        }
      }
    });
  });

  const draftDatasetsCount = datasets.filter((d) => d.status === DataStatus.DRAFT).length;
  const draftRecordsCount = records.filter((r) => r.status === DataStatus.DRAFT).length;

  return {
    total_datasets: activeDatasets.length,
    published_records: records.filter(
      (r) => r.status === DataStatus.PUBLISHED
    ).length,
    draft_records: draftRecordsCount,
    draft_datasets: draftDatasetsCount,
    pending_review: pendingVerifikasiCount,
  };
}

// ============================================================
// VALIDATION
// ============================================================

export function validateRecord(
  record: Partial<DataRecord>,
  datasetId: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!record.indicator?.trim()) {
    errors.push({
      field: 'indicator',
      message: 'Indikator wajib diisi.',
      severity: 'error',
    });
  }

  if (!record.region?.trim()) {
    errors.push({
      field: 'region',
      message: 'Wilayah wajib diisi.',
      severity: 'error',
    });
  }

  if (!record.period?.trim()) {
    errors.push({
      field: 'period',
      message: 'Periode/tahun wajib diisi.',
      severity: 'error',
    });
  } else {
    // Validate year format
    const yearMatch = record.period.match(/^\d{4}$/);
    const quarterMatch = record.period.match(/^\d{4}-Q[1-4]$/);
    const monthMatch = record.period.match(/^\d{4}-\d{2}$/);
    if (!yearMatch && !quarterMatch && !monthMatch) {
      errors.push({
        field: 'period',
        message:
          'Format periode tidak valid. Gunakan: 2025, 2025-Q1, atau 2025-01.',
        severity: 'error',
      });
    }
  }

  if (record.value === null || record.value === undefined) {
    errors.push({
      field: 'value',
      message: 'Nilai wajib diisi.',
      severity: 'error',
    });
  } else if (typeof record.value === 'number' && isNaN(record.value)) {
    errors.push({
      field: 'value',
      message: 'Kolom "Nilai" harus berupa angka.',
      severity: 'error',
    });
  }

  if (!record.unit?.trim()) {
    errors.push({
      field: 'unit',
      message: 'Satuan wajib diisi.',
      severity: 'error',
    });
  }

  // Check duplicate
  if (record.indicator && record.region && record.period) {
    const isDuplicate = RecordRepo.checkDuplicate(
      datasetId,
      record.indicator,
      record.region,
      record.period
    );
    if (isDuplicate) {
      errors.push({
        field: 'period',
        message: `Data duplikat. Data untuk ${record.region} ${record.indicator} tahun ${record.period} sudah tersedia.`,
        severity: 'error',
      });
    }
  }

  // Anomaly warning
  if (
    typeof record.value === 'number' &&
    record.indicator &&
    record.region
  ) {
    const anomaly = RecordRepo.checkAnomalies(
      datasetId,
      record.indicator,
      record.region,
      record.value
    );
    if (anomaly) {
      errors.push({
        field: 'value',
        message: anomaly.message,
        severity: 'warning',
      });
    }
  }

  return errors;
}

// ============================================================
// CHATBOT TEMPLATE REPOSITORY
// ============================================================

const CHATBOT_STORAGE_KEY = 'sapa_bps_chatbot_templates';

const DEFAULT_TEMPLATES: ChatbotTemplate[] = [
  {
    id: 'tpl-1',
    keyword: 'Jumlah Penduduk',
    category: 'Kependudukan',
    response: 'Jumlah Penduduk Kabupaten Bangka tahun 2025 tercatat sebanyak *346.069 jiwa*.\n\n📊 *Sumber:* Proyeksi Penduduk 2020-2035 Hasil SP2020 BPS.',
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl-2',
    keyword: 'Data Kemiskinan',
    category: 'Sosial & Kesejahteraan',
    response: '📊 *DATA KEMISKINAN KABUPATEN BANGKA*\n\n📍 *Kabupaten Bangka (2025):*\n• Jumlah Penduduk Miskin: *16,58 ribu jiwa*\n• Persentase Kemiskinan: *4,71%*\n• Garis Kemiskinan: *Rp734.575 / kapita / bulan*\n• Indeks Kedalaman (P1): *0,51* | Keparahan (P2): *0,09*',
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl-3',
    keyword: 'Pertumbuhan Ekonomi',
    category: 'Ekonomi Makro',
    response: '📊 *LAJU PERTUMBUHAN EKONOMI KAB. BANGKA*\n\n📈 *Pertumbuhan Tahunan:*\n• 2021: *7,46%*\n• 2022: *4,86%*\n• 2023: *4,42%*\n• 2024: *-0,44%*\n\n📈 *Pertumbuhan Triwulanan 2025 (y-on-y):*\n• Triwulan I: *5,28%*\n• Triwulan II: *4,14%*\n• Triwulan III: *5,19%*',
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl-4',
    keyword: 'Indeks Pembangunan Manusia (IPM)',
    category: 'Indikator Makro',
    response: '📊 *INDEKS PEMBANGUNAN MANUSIA (IPM) KAB. BANGKA*\n\n🌟 *Tahun 2025:* IPM *75,38* (Naik 0,96% dari 2024)\n• Umur Harapan Hidup (UHH): *73,56 tahun*\n• Rata-rata Lama Sekolah (RLS): *8,77 tahun*\n• Harapan Lama Sekolah (HLS): *13,13 tahun*\n• Pengeluaran per Kapita: *Rp 13.411.000,- / tahun*',
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl-5',
    keyword: 'Tenaga Kerja',
    category: 'Ketenagakerjaan',
    response: '📊 *DATA KETENAGAKERJAAN KAB. BANGKA (2021-2025)*\n\n💼 *Tahun 2025:*\n• Tingkat Partisipasi Angkatan Kerja (TPAK): *67,93%*\n• Tingkat Pengangguran Terbuka (TPT): *4,75%*',
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl-6',
    keyword: 'Hubungi Petugas PST BPS',
    category: 'Layanan & Kontak',
    response: '🏛️ *LAYANAN KONSULTASI STATISTIK TERPADU (PST)*\n*Badan Pusat Statistik Kabupaten Bangka*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🏢 *Alamat Kantor:* Jl. Ahmad Yani Jalur Dua Sungailiat\n⏰ *Jam Layanan:* Senin – Jumat (08.00 – 15.30 WIB)\n📞 *WhatsApp PST:* https://wa.me/6281234567890\n✉️ *Email:* bps1901@bps.go.id',
    is_active: true,
    updated_at: new Date().toISOString(),
  },
];

let cachedTemplates: ChatbotTemplate[] | null = null;

function detectFaqCategory(keyword: string): string {
  const k = keyword.toLowerCase();
  if (k.includes('pdrb') || k.includes('ekonomi') || k.includes('inflasi')) return 'Ekonomi Makro';
  if (k.includes('ipg') || k.includes('ipm') || k.includes('gender') || k.includes('indeks')) return 'Indikator Makro';
  if (k.includes('pendidikan') || k.includes('rls') || k.includes('hls') || k.includes('sekolah')) return 'Pendidikan & Sosial';
  if (k.includes('penduduk') || k.includes('kemiskinan') || k.includes('kerja')) return 'Sosial & Kependudukan';
  if (k.includes('layanan') || k.includes('kontak') || k.includes('petugas') || k.includes('pst') || k.includes('alamat')) return 'Layanan & Kontak';
  return 'Layanan & FAQ BPS';
}

function getCachedTemplates(): ChatbotTemplate[] {
  if (cachedTemplates) return cachedTemplates;
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(CHATBOT_STORAGE_KEY);
      if (saved) {
        cachedTemplates = JSON.parse(saved);
        if (cachedTemplates && cachedTemplates.length > 0) {
          cachedTemplates = cachedTemplates.map((t) => {
            if (!t.category || t.category === 'Resmi BPS') {
              return { ...t, category: detectFaqCategory(t.keyword) };
            }
            return t;
          });
          return cachedTemplates;
        }
      }
    } catch {}
  }
  cachedTemplates = [...DEFAULT_TEMPLATES];
  return cachedTemplates;
}

function saveCachedTemplates(templates: ChatbotTemplate[]): void {
  cachedTemplates = templates;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CHATBOT_STORAGE_KEY, JSON.stringify(templates));
    } catch {}
  }
  notify();
}

export const ChatbotTemplateRepo = {
  getAll(): ChatbotTemplate[] {
    const manualList = getCachedTemplates().map((t) => ({
      ...t,
      source_type: 'MANUAL' as const,
    }));

    // Auto-generate template dari dataset yang ada di pangkalan data BPS (HANYA DATASET YANG SUDAH BERSTATUS PUBLISHED!)
    const datasetTemplates: ChatbotTemplate[] = DatasetRepo.getAll()
      .filter((ds) => ds.status === DataStatus.PUBLISHED)
      .map((ds) => {
        const records = getStore()
          .records.filter(
            (r) =>
              r.dataset_id === ds.id &&
              !r.is_deleted &&
              r.value !== null &&
              r.status === DataStatus.PUBLISHED
          )
          .sort((a, b) => b.period.localeCompare(a.period));

        let dataSummary = '';
        if (records.length > 0) {
          const latest = records[0];
          const latestVal = typeof latest.value === 'number' ? latest.value.toLocaleString('id-ID') : latest.value;
          const historyLines = records.slice(0, 5).map(
            (r) =>
              `• Tahun *${r.period}* (${r.region}): *${typeof r.value === 'number' ? r.value.toLocaleString('id-ID') : r.value}* ${r.unit || ds.unit}${r.notes ? ` _(${r.notes})_` : ''}`
          ).join('\n');

          dataSummary =
            `⭐ *REALISASI TERBARU (Tahun ${latest.period}):*\n` +
            `👉 *${latestVal} ${latest.unit || ds.unit}*` +
            (latest.notes ? `\n_Catatan: ${latest.notes}_` : '') +
            `\n\n📈 *Rincian Perkembangan Historis (Terkini ke Terdahulu):*\n${historyLines}`;
        } else {
          dataSummary = '• _Data sedang dalam pemutakhiran berkala._';
        }

        const response =
          `📊 *DATA RESMI: ${ds.name.toUpperCase()}*\n` +
          `🏛️ *BPS Kabupaten Bangka* (Kode: ${ds.code})\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📍 *Cakupan:* ${ds.geographic_scope}\n` +
          `${dataSummary}\n\n` +
          (ds.definition ? `ℹ️ *Konsep/Definisi:* ${ds.definition.slice(0, 120)}...\n\n` : '') +
          `📌 *Sumber Data:* ${ds.source || 'BPS Kabupaten Bangka'}\n` +
          `💡 _Data diambil otomatis langsung dari Katalog Dataset SAPA BPS._`;

        return {
          id: `tpl-dataset-${ds.id}`,
          keyword: ds.name,
          response,
          category: ds.category || 'Data Statistik BPS',
          source_type: 'DATASET',
          dataset_id: ds.id,
          dataset_code: ds.code,
          is_active: true,
          updated_at: ds.updated_at,
        };
      });

    // Filter template manual lama agar tidak menimpa/menduplikasi data resmi dari dataset
    const datasetKeywords = new Set(
      datasetTemplates.flatMap((t) => [
        t.keyword.toLowerCase(),
        (t.category || '').toLowerCase(),
      ])
    );
    const filteredManual = manualList.filter((m) => {
      const kw = m.keyword.toLowerCase();
      // Selalu izinkan template layanan, kontak, dan FAQ umum
      if (
        kw.includes('layanan') ||
        kw.includes('petugas') ||
        kw.includes('pst') ||
        kw.includes('kontak') ||
        kw.includes('bantuan') ||
        kw.includes('alamat') ||
        kw.includes('jam')
      ) {
        return true;
      }
      // Jangan tampilkan template lama jika sudah ada dataset resmi terbitan untuk topik ini
      return !Array.from(datasetKeywords).some((dk) => dk && (kw.includes(dk) || dk.includes(kw)));
    });

    // Template Dinamis Menu Utama (Hanya masukkan dataset yang memiliki record terbitan riil)
    const publishedDs = DatasetRepo.getAll().filter((d) => {
      if (d.status !== DataStatus.PUBLISHED) return false;
      const recCount = getStore().records.filter(
        (r) => r.dataset_id === d.id && !r.is_deleted && r.value !== null && r.status === DataStatus.PUBLISHED
      ).length;
      return recCount > 0;
    });

    const seenCategories = new Set<string>();
    const mLines: string[] = [];
    let mNum = 1;

    publishedDs.forEach((ds) => {
      const label = ds.category || ds.name;
      const lower = label.trim().toLowerCase();
      if (!seenCategories.has(lower)) {
        seenCategories.add(lower);
        mLines.push(`${mNum++}. *${label}*`);
      }
    });

    const s1 = mNum++;
    const s2 = mNum++;
    mLines.push(`${s1}. *Apa saja layanan BPS?*`);
    mLines.push(`${s2}. *Hubungi Petugas PST BPS*`);

    const defaultMenuResponse =
      `📋 *MENU UTAMA LAYANAN DATA SAPA BPS*\n🏛️ *BPS KABUPATEN BANGKA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Silakan pilih topik informasi statistik resmi BPS Kab. Bangka berikut:\n\n` +
      mLines.join('\n') +
      `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _Balas dengan angka *1* - *${s2}*, ketik pertanyaan langsung, atau ketik *petugas* untuk konsultasi PST._`;

    // Cek apakah pengguna sudah memiliki template Menu Utama yang telah diedit/disimpan
    const existingMenuIdx = manualList.findIndex(
      (m) => m.id === 'tpl-system-menu' || m.keyword.trim().toLowerCase() === 'menu utama'
    );

    let menuTemplate: ChatbotTemplate;
    if (existingMenuIdx !== -1) {
      menuTemplate = {
        ...manualList[existingMenuIdx],
        id: 'tpl-system-menu',
        keyword: manualList[existingMenuIdx].keyword || 'Menu Utama',
        source_type: 'MANUAL',
      };
      // Hapus dari filteredManual jika ada di dalamnya agar tidak dobel
      const dupIdx = filteredManual.findIndex(
        (m) => m.id === 'tpl-system-menu' || m.keyword.trim().toLowerCase() === 'menu utama'
      );
      if (dupIdx !== -1) {
        filteredManual.splice(dupIdx, 1);
      }
    } else {
      menuTemplate = {
        id: 'tpl-system-menu',
        keyword: 'Menu Utama',
        response: defaultMenuResponse,
        category: 'Layanan & Kontak',
        source_type: 'MANUAL',
        is_active: true,
        updated_at: new Date().toISOString(),
      };
    }

    return [menuTemplate, ...filteredManual, ...datasetTemplates];
  },

  getById(id: string): ChatbotTemplate | undefined {
    return this.getAll().find((t) => t.id === id);
  },

  async syncWithBackendFaqs(): Promise<void> {
    try {
      const remoteFaqs = await BackendApi.getFaqs();
      if (remoteFaqs && remoteFaqs.length > 0) {
        const mapped: ChatbotTemplate[] = remoteFaqs.map((f, i) => ({
          id: `tpl-remote-${i}`,
          keyword: f.pertanyaan,
          response: f.jawaban.replace(/<br\s*\/?>/gi, '\n'),
          category: detectFaqCategory(f.pertanyaan),
          source_type: 'MANUAL',
          is_active: true,
          updated_at: new Date().toISOString(),
        }));
        saveCachedTemplates(mapped);
      }
    } catch {}
  },

  create(data: Omit<ChatbotTemplate, 'id' | 'updated_at'>): ChatbotTemplate {
    const list = [...getCachedTemplates()];
    const newTpl: ChatbotTemplate = {
      id: `tpl-${Date.now()}`,
      keyword: data.keyword.trim(),
      response: data.response.trim(),
      category: data.category?.trim() || 'Umum',
      source_type: 'MANUAL',
      is_active: data.is_active !== undefined ? data.is_active : true,
      updated_at: new Date().toISOString(),
    };
    list.unshift(newTpl);
    saveCachedTemplates(list);

    // Sync ke file data_faq.csv backend secara background
    BackendApi.saveFaq(newTpl.keyword, newTpl.response.replace(/\n/g, '<br>')).catch(() => {});
    return newTpl;
  },

  update(id: string, data: Partial<ChatbotTemplate>): ChatbotTemplate | undefined {
    if (id.startsWith('tpl-dataset-')) {
      console.warn('Template yang bersumber dari dataset bersifat read-only dan tidak dapat diedit.');
      return undefined;
    }

    const list = [...getCachedTemplates()];
    const isMenuUtama = id === 'tpl-system-menu' || data.keyword?.trim().toLowerCase() === 'menu utama';
    const idx = list.findIndex(
      (t) => t.id === id || (isMenuUtama && (t.id === 'tpl-system-menu' || t.keyword.trim().toLowerCase() === 'menu utama'))
    );

    if (idx === -1) {
      if (isMenuUtama) {
        const newMenu: ChatbotTemplate = {
          id: 'tpl-system-menu',
          keyword: data.keyword?.trim() || 'Menu Utama',
          response: data.response?.trim() || '',
          category: data.category?.trim() || 'Layanan & Kontak',
          source_type: 'MANUAL',
          is_active: data.is_active !== undefined ? data.is_active : true,
          updated_at: new Date().toISOString(),
        };
        list.unshift(newMenu);
        saveCachedTemplates(list);
        BackendApi.saveFaq(newMenu.keyword, newMenu.response.replace(/\n/g, '<br>')).catch(() => {});
        return newMenu;
      }
      return undefined;
    }

    const old = list[idx];
    const updated: ChatbotTemplate = {
      ...old,
      ...data,
      source_type: 'MANUAL',
      updated_at: new Date().toISOString(),
    };
    list[idx] = updated;
    saveCachedTemplates(list);

    BackendApi.saveFaq(
      updated.keyword,
      updated.response.replace(/\n/g, '<br>'),
      old.keyword
    ).catch(() => {});
    return updated;
  },

  delete(id: string): boolean {
    if (id.startsWith('tpl-dataset-')) {
      console.warn('Template yang bersumber dari dataset bersifat read-only dan tidak dapat dihapus.');
      return false;
    }

    const list = [...getCachedTemplates()];
    const isMenuUtama = id === 'tpl-system-menu';
    const target = list.find(
      (t) => t.id === id || (isMenuUtama && (t.id === 'tpl-system-menu' || t.keyword.trim().toLowerCase() === 'menu utama'))
    );

    if (!target && isMenuUtama) {
      // Menu utama yang belum disimpan kustom tidak perlu dihapus dari cache
      return true;
    }
    if (!target) return false;

    const filtered = list.filter(
      (t) => t.id !== target.id && (!isMenuUtama || t.keyword.trim().toLowerCase() !== 'menu utama')
    );
    saveCachedTemplates(filtered);

    BackendApi.deleteFaq(target.keyword).catch(() => {});
    return true;
  },
};
