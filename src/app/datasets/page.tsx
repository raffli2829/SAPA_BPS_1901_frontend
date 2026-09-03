'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import {
  Button,
  StatusBadge,
  SearchInput,
  Select,
  Pagination,
  EmptyState,
  TableSkeleton,
  Toast,
} from '@/components/ui';
import { DatasetRepo, RecordRepo, subscribe } from '@/lib/repository';
import { CATEGORIES } from '@/lib/mock-data';
import { Dataset, DataStatus } from '@/lib/types';
import { formatDateShort, getPeriodRange, formatNumber } from '@/lib/utils';
import { Plus, Database, ArrowUpDown, ChevronRight, Filter, Trash2, Pencil } from 'lucide-react';
import EditDatasetModal from '@/components/datasets/EditDatasetModal';

const PAGE_SIZE = 10;

export default function DatasetsPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>(() => {
    try {
      return DatasetRepo.getAll();
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'updated_at' | 'name'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);

  const handleDeleteDataset = (e: React.MouseEvent, ds: Dataset) => {
    e.stopPropagation();
    e.preventDefault();
    if (
      confirm(
        `HAPUS DATASET?\n\nNama: "${ds.name}" (${ds.code})\n\nSeluruh data di dalam dataset ini akan dihapus dari sistem. Gunakan opsi ini jika salah membuat dataset.`
      )
    ) {
      if (user) {
        DatasetRepo.delete(ds.id, user.id, user.name);
        setDatasets(DatasetRepo.getAll());
        setToast({ msg: `Dataset "${ds.name}" berhasil dihapus.`, type: 'success' });
      }
    }
  };

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    function loadData() {
      setDatasets(DatasetRepo.getAll());
      setLoading(false);
    }

    const unsub = subscribe(loadData);
    return unsub;
  }, [isAuthenticated, isLoading, router]);

  const filtered = useMemo(() => {
    let result = [...datasets];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q)
      );
    }

    if (filterCategory) {
      result = result.filter((d) => d.category === filterCategory);
    }

    if (filterStatus) {
      result = result.filter((d) => d.status === filterStatus);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [datasets, search, filterCategory, filterStatus, sortBy, sortOrder]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const [prevFilter, setPrevFilter] = useState({ search, filterCategory, filterStatus });
  if (
    prevFilter.search !== search ||
    prevFilter.filterCategory !== filterCategory ||
    prevFilter.filterStatus !== filterStatus
  ) {
    setPrevFilter({ search, filterCategory, filterStatus });
    setCurrentPage(1);
  }

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <PageContent
        datasets={paginated}
        totalCount={filtered.length}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        filterCategory={filterCategory}
        onFilterCategory={setFilterCategory}
        filterStatus={filterStatus}
        onFilterStatus={setFilterStatus}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={(field) => {
          if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            setSortBy(field);
            setSortOrder('desc');
          }
        }}
        onDeleteDataset={handleDeleteDataset}
        onEditDataset={(ds) => setEditingDataset(ds)}
      />
      {editingDataset && (
        <EditDatasetModal
          dataset={editingDataset}
          open={!!editingDataset}
          onClose={() => setEditingDataset(null)}
          onSuccess={(updated) => {
            setDatasets(DatasetRepo.getAll());
            setToast({
              msg: `Dataset "${updated.name}" berhasil diperbarui.`,
              type: 'success',
            });
          }}
        />
      )}
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

function PageContent({
  datasets,
  totalCount,
  loading,
  search,
  onSearchChange,
  filterCategory,
  onFilterCategory,
  filterStatus,
  onFilterStatus,
  currentPage,
  onPageChange,
  sortBy,
  sortOrder,
  onSort,
  onDeleteDataset,
  onEditDataset,
  onMobileMenuOpen,
}: {
  datasets: Dataset[];
  totalCount: number;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  filterCategory: string;
  onFilterCategory: (value: string) => void;
  filterStatus: string;
  onFilterStatus: (value: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  sortBy: 'updated_at' | 'name';
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'updated_at' | 'name') => void;
  onDeleteDataset: (e: React.MouseEvent, ds: Dataset) => void;
  onEditDataset: (ds: Dataset) => void;
  onMobileMenuOpen?: () => void;
}) {
  return (
    <>
      <Header
        title="Katalog Dataset"
        subtitle="Daftar dataset statistik makro Kabupaten Bangka"
        onMobileMenuOpen={onMobileMenuOpen || (() => {})}
        actions={
          <Link href="/datasets/new">
            <Button icon={<Plus size={14} />}>Buat Dataset</Button>
          </Link>
        }
      />
      <div className="page-content">
        {/* Filters & Actions Bar */}
        <div className="filter-bar">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Cari dataset, kode, atau kategori..."
          />
          <Select
            options={CATEGORIES.map((c) => ({ value: c.name, label: c.name }))}
            placeholder="Semua Kategori"
            value={filterCategory}
            onChange={(e) => onFilterCategory(e.target.value)}
          />
          <Select
            options={[
              { value: DataStatus.DRAFT, label: 'Draf (Draft)' },
              { value: DataStatus.REVIEW, label: 'Menunggu Review' },
              { value: DataStatus.PUBLISHED, label: 'Terpublikasi (Published)' },
              { value: DataStatus.ARCHIVED, label: 'Diarsipkan' },
            ]}
            placeholder="Semua Status"
            value={filterStatus}
            onChange={(e) => onFilterStatus(e.target.value)}
          />
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : datasets.length === 0 ? (
          <EmptyState
            icon={<Database size={36} />}
            title={search || filterCategory || filterStatus ? 'Tidak ada hasil yang cocok' : 'Belum ada dataset'}
            description={
              search || filterCategory || filterStatus
                ? 'Tidak ditemukan dataset yang sesuai kriteria pencarian. Coba ubah kata kunci atau reset filter.'
                : 'Mulai dengan membuat dataset statistik baru untuk wilayah Kabupaten Bangka.'
            }
            actions={
              !search && !filterCategory && !filterStatus ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <Link href="/datasets/new">
                    <Button icon={<Plus size={14} />}>Buat Dataset Baru</Button>
                  </Link>
                  <Link href="/import">
                    <Button variant="secondary">Import dari Excel</Button>
                  </Link>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onSearchChange('');
                    onFilterCategory('');
                    onFilterStatus('');
                  }}
                >
                  Reset Semua Filter
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="data-table-wrapper">
              <table className="data-table data-table-sticky">
                <thead>
                  <tr>
                    <th
                      className="sortable"
                      onClick={() => onSort('name')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        Nama Dataset & Kode
                        <ArrowUpDown size={12} style={{ opacity: sortBy === 'name' ? 1 : 0.4 }} />
                      </div>
                    </th>
                    <th>Kategori</th>
                    <th>Rentang Periode</th>
                    <th className="cell-numeric">Jumlah Data</th>
                    <th>Status Validasi</th>
                    <th
                      className="sortable"
                      onClick={() => onSort('updated_at')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        Terakhir Update
                        <ArrowUpDown size={12} style={{ opacity: sortBy === 'updated_at' ? 1 : 0.4 }} />
                      </div>
                    </th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((ds) => {
                    const records = RecordRepo.getByDataset(ds.id);
                    const periodRange = getPeriodRange(records);

                    return (
                      <tr key={ds.id}>
                        <td>
                          <div>
                            <Link
                              href={`/datasets/${ds.id}`}
                              className="row-link"
                            >
                              {ds.name}
                            </Link>
                            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, fontFamily: 'monospace' }}>
                              {ds.code}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 12,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: '#f1f5f9',
                              color: '#334155',
                              fontWeight: 500,
                            }}
                          >
                            {ds.category}
                          </span>
                        </td>
                        <td style={{ fontSize: 12.5, color: '#475569' }}>{periodRange}</td>
                        <td className="cell-numeric">
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>
                            {formatNumber(ds.record_count || 0)}
                          </span>
                          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>data</span>
                        </td>
                        <td>
                          <StatusBadge status={ds.status} size="sm" />
                        </td>
                        <td style={{ fontSize: 12, color: '#64748b' }}>{formatDateShort(ds.updated_at)}</td>
                        <td className="cell-actions">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onEditDataset(ds);
                              }}
                              title="Edit Dataset & Metadata"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--primary-color)',
                                cursor: 'pointer',
                                padding: 6,
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: 4,
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            <Link href={`/datasets/${ds.id}`} title="Buka Detail">
                              <Button variant="ghost" size="sm" style={{ padding: '0 6px', height: 28 }}>
                                <ChevronRight size={16} />
                              </Button>
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => onDeleteDataset(e, ds)}
                              title="Hapus Dataset"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--error-text)',
                                cursor: 'pointer',
                                padding: 6,
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: 4,
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              current={currentPage}
              total={totalCount}
              pageSize={PAGE_SIZE}
              onChange={onPageChange}
            />
          </>
        )}
      </div>
    </>
  );
}
