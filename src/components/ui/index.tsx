import React from 'react';
import { cn } from '@/lib/utils';
import { DataStatus, STATUS_LABELS } from '@/lib/types';

// ============================================================
// Button
// ============================================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn('btn', `btn-${variant}`, `btn-${size}`, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="btn-spinner" />
      ) : (
        icon && <span className="btn-icon">{icon}</span>
      )}
      {children}
    </button>
  );
}

// ============================================================
// StatusBadge
// ============================================================

interface StatusBadgeProps {
  status: DataStatus;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export function StatusBadge({ status, size = 'md', showDot = true }: StatusBadgeProps) {
  const colorMap: Record<DataStatus, string> = {
    [DataStatus.DRAFT]: 'badge-draft',
    [DataStatus.REVIEW]: 'badge-review',
    [DataStatus.PUBLISHED]: 'badge-published',
    [DataStatus.ARCHIVED]: 'badge-archived',
  };

  return (
    <span className={cn('badge', colorMap[status], `badge-${size}`)}>
      {showDot && <span className="badge-dot" />}
      {STATUS_LABELS[status]}
    </span>
  );
}

// ============================================================
// StatCard / MetricCard
// ============================================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconColor?: 'blue' | 'emerald' | 'amber' | 'slate';
  href?: string;
  footerText?: string;
  trendText?: string;
}

export function StatCard({
  label,
  value,
  icon,
  iconColor = 'blue',
  href,
  footerText,
  trendText,
}: StatCardProps) {
  const content = (
    <>
      <div className="summary-card-header">
        <span className="summary-card-label">{label}</span>
        <div className={cn('summary-card-icon', `summary-card-icon-${iconColor}`)}>
          {icon}
        </div>
      </div>
      <div className="summary-card-value">{value}</div>
      {(footerText || trendText) && (
        <div className="summary-card-footer">
          <span>{footerText}</span>
          {trendText && <span className="summary-card-trend">{trendText}</span>}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} className="summary-card">
        {content}
      </a>
    );
  }

  return <div className="summary-card">{content}</div>;
}

// ============================================================
// EmptyState
// ============================================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, actions, action }: EmptyStateProps) {
  const renderedActions = actions || action;
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {renderedActions && <div className="empty-state-actions">{renderedActions}</div>}
    </div>
  );
}

// ============================================================
// Skeleton
// ============================================================

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  borderRadius?: string;
}

export function Skeleton({ width, height = '1rem', className, borderRadius }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton', className)}
      style={{ width, height, borderRadius }}
    />
  );
}

const SKELETON_WIDTHS = ['85px', '110px', '95px', '120px', '75px', '100px'];

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-skeleton">
      <div className="table-skeleton-header">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]} height="14px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="table-skeleton-row">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} width={SKELETON_WIDTHS[(i + j) % SKELETON_WIDTHS.length]} height="14px" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Modal / Dialog
// ============================================================

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: 'default' | 'danger' | 'warning';
  maxWidth?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  variant = 'default',
  maxWidth,
  className,
  style,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={cn('modal', `modal-${variant}`, className)}
        style={{ ...(maxWidth ? { maxWidth } : {}), ...style }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-title">{title}</h3>
        {description && <p className="modal-description">{description}</p>}
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

// ============================================================
// Search Input
// ============================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Cari...',
  className,
}: SearchInputProps) {
  return (
    <div className={cn('search-input-wrapper', className)}>
      <svg
        className="search-input-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        className="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          className="search-clear"
          onClick={() => onChange('')}
          title="Hapus pencarian"
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ============================================================
// Select
// ============================================================

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
}

export function Select({
  label,
  options,
  placeholder,
  className,
  error,
  ...props
}: SelectProps) {
  return (
    <div className={cn('select-wrapper', className)}>
      {label && <label className="input-label">{label}</label>}
      <select className="select-input" {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="input-error">{error}</p>}
    </div>
  );
}

// ============================================================
// Input Field
// ============================================================

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <div className={cn('input-field', className)}>
        {label && (
          <label className="input-label" htmlFor={props.id}>
            {label}
            {props.required && <span className="input-required">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={cn('text-input', error && 'text-input-error')}
          {...props}
        />
        {error && <p className="input-error">{error}</p>}
        {hint && !error && <p className="input-hint">{hint}</p>}
      </div>
    );
  }
);
InputField.displayName = 'InputField';

// ============================================================
// Textarea Field
// ============================================================

interface TextareaFieldProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextareaField = React.forwardRef<
  HTMLTextAreaElement,
  TextareaFieldProps
>(({ label, error, className, ...props }, ref) => {
  return (
    <div className={cn('input-field', className)}>
      {label && (
        <label className="input-label" htmlFor={props.id}>
          {label}
          {props.required && <span className="input-required">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn('textarea-input', error && 'text-input-error')}
        {...props}
      />
      {error && <p className="input-error">{error}</p>}
    </div>
  );
});
TextareaField.displayName = 'TextareaField';

// ============================================================
// Tabs
// ============================================================

interface TabsProps {
  tabs: { value: string; label: string; count?: number }[];
  activeTab: string;
  onTabChange: (value: string) => void;
  actions?: React.ReactNode;
}

export function Tabs({ tabs, activeTab, onTabChange, actions }: TabsProps) {
  return (
    <div className="tabs-container">
      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={cn('tab', activeTab === tab.value && 'tab-active')}
            onClick={() => onTabChange(tab.value)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="tab-count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>
      {actions && <div className="tabs-actions">{actions}</div>}
    </div>
  );
}

// ============================================================
// Toast / Notification
// ============================================================

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

export function Toast({ message, type = 'info', onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={cn('toast', `toast-${type}`)}>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose} type="button">
        ×
      </button>
    </div>
  );
}

// ============================================================
// Pagination
// ============================================================

interface PaginationProps {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export function Pagination({
  current,
  total,
  pageSize,
  onChange,
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <span className="pagination-info">
        Menampilkan {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, total)}{' '}
        dari {total} data
      </span>
      <div className="pagination-buttons">
        <button
          className="pagination-btn"
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
          type="button"
          title="Halaman Sebelumnya"
        >
          ←
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let page: number;
          if (totalPages <= 5) {
            page = i + 1;
          } else if (current <= 3) {
            page = i + 1;
          } else if (current >= totalPages - 2) {
            page = totalPages - 4 + i;
          } else {
            page = current - 2 + i;
          }
          return (
            <button
              key={page}
              type="button"
              className={cn(
                'pagination-btn',
                current === page && 'pagination-btn-active'
              )}
              onClick={() => onChange(page)}
            >
              {page}
            </button>
          );
        })}
        <button
          className="pagination-btn"
          disabled={current >= totalPages}
          onClick={() => onChange(current + 1)}
          type="button"
          title="Halaman Berikutnya"
        >
          →
        </button>
      </div>
    </div>
  );
}
