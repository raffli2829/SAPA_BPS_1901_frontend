// ============================================================
// SAPA BPS 1901 IN — Core Type Definitions
// ============================================================

// --- Enums ---

export enum DataStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum UserRole {
  DATA_ENTRY = 'DATA_ENTRY',
  REVIEWER = 'REVIEWER',
}

export enum PeriodType {
  YEARLY = 'YEARLY',
  QUARTERLY = 'QUARTERLY',
  MONTHLY = 'MONTHLY',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  SUBMIT_REVIEW = 'SUBMIT_REVIEW',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  PUBLISH = 'PUBLISH',
  ARCHIVE = 'ARCHIVE',
  VERIFY_ANOMALY = 'VERIFY_ANOMALY',
}

// --- Data Models ---

export interface Dataset {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  definition: string;
  geographic_scope: string;
  unit: string;
  source: string;
  period_type: PeriodType;
  status: DataStatus;
  created_by: string;
  updated_by: string;
  created_at: string; // ISO date string
  updated_at: string;
  record_count?: number;
}

export interface DataRecord {
  id: string;
  dataset_id: string;
  indicator: string;
  region: string;
  period: string; // e.g., "2025", "2025-Q1", "2025-01"
  value: number | null;
  unit: string;
  notes: string;
  source: string;
  status: DataStatus;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean; // soft delete
}

export interface AuditLog {
  id: string;
  entity_type: 'dataset' | 'record';
  entity_id: string;
  entity_name: string;
  action: AuditAction;
  changes: AuditChange[];
  user_id: string;
  user_name: string;
  reason?: string;
  created_at: string;
}

export interface AuditChange {
  field: string;
  old_value: string | number | null;
  new_value: string | number | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface ReviewRequest {
  id: string;
  dataset_id: string;
  dataset_name: string;
  record_ids: string[];
  description: string;
  submitted_by: string;
  submitted_by_name: string;
  submitted_at: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  reject_reason?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  row?: number;
  severity: 'error' | 'warning';
}

export interface AnomalyWarning {
  record_id: string;
  field: string;
  current_value: number;
  previous_value: number;
  change_percent: number;
  message: string;
}

// --- Category ---

export interface Category {
  id: string;
  name: string;
  code: string;
  description: string;
}

// --- Import ---

export interface ColumnMapping {
  source_column: string;
  target_field: keyof DataRecord | '';
}

export interface ImportPreviewRow {
  row_number: number;
  data: Record<string, string | number>;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// --- Dashboard ---

export interface DashboardSummary {
  total_datasets: number;
  published_records: number;
  draft_records: number;
  draft_datasets?: number;
  pending_review: number;
}

// --- API Response ---

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// --- Filters ---

export interface DatasetFilter {
  search: string;
  category: string;
  status: DataStatus | '';
  period: string;
  sort_by: keyof Dataset;
  sort_order: 'asc' | 'desc';
}

// --- Spreadsheet ---

export interface SpreadsheetCell {
  row: number;
  col: number;
  value: string | number;
  error?: string;
  warning?: string;
}

export interface SpreadsheetRow {
  id: string;
  cells: Record<string, string | number>;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

// --- UI State ---

export type TabValue = 'data' | 'metadata' | 'history';
export type InputMode = 'form' | 'spreadsheet';

// --- Chatbot Template ---

export interface ChatbotTemplate {
  id: string;
  keyword: string;
  response: string;
  category?: string;
  is_active?: boolean;
  source_type?: 'DATASET' | 'MANUAL';
  dataset_id?: string;
  dataset_code?: string;
  updated_at?: string;
}

// --- Status display helpers ---

export const STATUS_LABELS: Record<DataStatus, string> = {
  [DataStatus.DRAFT]: 'Draft',
  [DataStatus.REVIEW]: 'Menunggu Review',
  [DataStatus.PUBLISHED]: 'Published',
  [DataStatus.ARCHIVED]: 'Diarsipkan',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.DATA_ENTRY]: 'Pengelola Data Statistik',
  [UserRole.REVIEWER]: 'Pengelola Data Statistik',
};

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  [PeriodType.YEARLY]: 'Tahunan',
  [PeriodType.QUARTERLY]: 'Triwulanan',
  [PeriodType.MONTHLY]: 'Bulanan',
};
