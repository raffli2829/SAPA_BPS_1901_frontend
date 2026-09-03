'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button, Toast, EmptyState } from '@/components/ui';
import { UserRepo, DatasetRepo, subscribe } from '@/lib/repository';
import { User, UserRole } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import {
  Users as UsersIcon,
  UserCheck,
  Mail,
  Plus,
  Edit2,
  Trash2,
  Sparkles,
  Search,
  Database,
  Building2,
  CheckCircle2,
} from 'lucide-react';

export default function UsersPage() {
  const { isAuthenticated, isLoading, user: currentUser } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>(() => {
    try {
      return UserRepo.getAll();
    } catch {
      return [];
    }
  });

  const [datasets, setDatasets] = useState(() => {
    try {
      return DatasetRepo.getAll();
    } catch {
      return [];
    }
  });

  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    function reload() {
      setUsers(UserRepo.getAll());
      setDatasets(DatasetRepo.getAll());
    }

    const unsub = subscribe(reload);
    return unsub;
  }, [isAuthenticated, isLoading, router]);

  const filteredUsers = useMemo(() => {
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  const handleOpenModal = (userToEdit?: User) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setFormName(userToEdit.name);
      setFormEmail(userToEdit.email);
    } else {
      setEditingUser(null);
      setFormName('');
      setFormEmail('');
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      setToast({ msg: 'Nama dan email wajib diisi.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingUser) {
        UserRepo.update(editingUser.id, {
          name: formName.trim(),
          email: formEmail.trim(),
        });
        setToast({ msg: `Data pengelola "${formName}" berhasil diperbarui.`, type: 'success' });
      } else {
        UserRepo.create({
          name: formName.trim(),
          email: formEmail.trim(),
          role: UserRole.DATA_ENTRY,
        });
        setToast({ msg: `Pengelola data baru "${formName}" berhasil ditambahkan.`, type: 'success' });
      }
      setIsModalOpen(false);
      setUsers(UserRepo.getAll());
    } catch {
      setToast({ msg: 'Gagal menyimpan data pengguna.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = (userToDelete: User) => {
    if (users.length <= 1) {
      setToast({ msg: 'Tidak dapat menghapus satu-satunya pengelola data tersisa.', type: 'error' });
      return;
    }
    if (confirm(`Apakah Anda yakin ingin menghapus akun "${userToDelete.name}"?`)) {
      UserRepo.delete(userToDelete.id);
      setUsers(UserRepo.getAll());
      setToast({ msg: `Pengelola "${userToDelete.name}" berhasil dihapus.`, type: 'success' });
    }
  };

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <Header
        title="Manajemen Pengelola Data"
        subtitle="Daftar tim pengelola dan operator data statistik resmi BPS Kabupaten Bangka"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => handleOpenModal()}
          >
            Tambah Pengelola
          </Button>
        }
      />

      <div className="page-content" style={{ maxWidth: 1180 }}>
        {/* Modern Stats Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
              }}
            >
              <UsersIcon size={22} />
            </div>
            <div>
              <p style={{ fontSize: 13, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Total Pengelola Data
              </p>
              <h3 style={{ fontSize: 24, fontWeight: 700, margin: '2px 0 0', color: 'var(--slate-900)' }}>
                {users.length} Pegawai
              </h3>
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.25)',
              }}
            >
              <UserCheck size={22} />
            </div>
            <div>
              <p style={{ fontSize: 13, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Akses Pengelolaan
              </p>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0', color: 'var(--slate-900)' }}>
                Setara & Terpadu
              </h3>
              <span style={{ fontSize: 11.5, color: '#059669', fontWeight: 500 }}>
                Semua akun dapat input & publikasi
              </span>
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-xl)',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(51, 65, 85, 0.2)',
              }}
            >
              <Building2 size={22} />
            </div>
            <div>
              <p style={{ fontSize: 13, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Satuan Kerja BPS
              </p>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0', color: 'var(--slate-900)' }}>
                Bangka (Kode 1901)
              </h3>
              <span style={{ fontSize: 11.5, color: 'var(--slate-500)' }}>
                Provinsi Kep. Bangka Belitung
              </span>
            </div>
          </div>
        </div>

        {/* Section List Pengguna */}
        <div className="section">
          <div className="section-header" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 className="section-title">
                <UsersIcon size={18} style={{ color: 'var(--primary-600)' }} />
                Daftar Akun Pengelola Data
              </h2>
              <p className="section-subtitle">
                Seluruh pengguna memiliki hak akses penuh untuk menginput, meninjau, dan mempublikasikan data statistik
              </p>
            </div>
            <div style={{ position: 'relative', width: 280 }}>
              <Search
                size={15}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }}
              />
              <input
                type="text"
                className="text-input"
                placeholder="Cari nama atau email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
              />
            </div>
          </div>

          <div className="section-body">
            {filteredUsers.length === 0 ? (
              <EmptyState
                title="Pengguna Tidak Ditemukan"
                description={`Tidak ada pengelola data yang cocok dengan pencarian "${search}".`}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                    Reset Pencarian
                  </Button>
                }
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: 18,
                }}
              >
                {filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id;

                  return (
                    <div
                      key={u.id}
                      style={{
                        background: '#ffffff',
                        border: isCurrent ? '1.5px solid var(--primary-400)' : '1px solid var(--slate-200)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '20px',
                        boxShadow: isCurrent ? '0 4px 14px rgba(37, 99, 235, 0.1)' : 'var(--shadow-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 16,
                        transition: 'transform 150ms, box-shadow 150ms',
                      }}
                    >
                      {/* Top User Info */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div
                              style={{
                                width: 46,
                                height: 46,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                                color: 'var(--primary-700)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 18,
                                fontWeight: 700,
                                border: '2px solid #bfdbfe',
                                position: 'relative',
                              }}
                            >
                              {u.name.charAt(0).toUpperCase()}
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  right: 0,
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  background: '#10b981',
                                  border: '2px solid #ffffff',
                                }}
                                title="Akun Aktif"
                              />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--slate-900)' }}>
                                  {u.name}
                                </h4>
                                {isCurrent && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 600,
                                      background: 'var(--primary-100)',
                                      color: 'var(--primary-800)',
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    Anda
                                  </span>
                                )}
                              </div>
                              <a
                                href={`mailto:${u.email}`}
                                style={{
                                  fontSize: 12.5,
                                  color: 'var(--slate-500)',
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  marginTop: 2,
                                }}
                              >
                                <Mail size={12} /> {u.email}
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Badges & Meta */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              background: '#eff6ff',
                              color: 'var(--primary-700)',
                              padding: '3px 10px',
                              borderRadius: 999,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              border: '1px solid #bfdbfe',
                            }}
                          >
                            <CheckCircle2 size={12} /> Pengelola Data Statistik
                          </span>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 500,
                              background: 'var(--slate-100)',
                              color: 'var(--slate-700)',
                              padding: '3px 10px',
                              borderRadius: 999,
                            }}
                          >
                            BPS Kab. Bangka
                          </span>
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div
                        style={{
                          borderTop: '1px solid var(--slate-150)',
                          paddingTop: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          fontSize: 12,
                          color: 'var(--slate-500)',
                        }}
                      >
                        <span>Terdaftar: {formatDate(u.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Add / Edit User */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 16,
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 500,
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--slate-900)' }}>
                  {editingUser ? 'Edit Akun Pengelola' : 'Tambah Pengelola Data Baru'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--slate-500)' }}>
                  Setiap akun memiliki hak akses setara untuk mengelola dan mempublikasikan data
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--slate-400)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="input-label" htmlFor="uname">
                    Nama Lengkap Pegawai<span className="input-required">*</span>
                  </label>
                  <input
                    id="uname"
                    type="text"
                    required
                    className="text-input"
                    placeholder="Contoh: Rahmat Hidayat, S.Tr.Stat."
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="input-label" htmlFor="uemail">
                    Alamat Email BPS / Resmi<span className="input-required">*</span>
                  </label>
                  <input
                    id="uemail"
                    type="email"
                    required
                    className="text-input"
                    placeholder="Contoh: rahmat.hidayat@bps.go.id"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--slate-200)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <CheckCircle2 size={15} color="#10b981" />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--slate-800)' }}>
                      Tipe Akun: Pengelola Data Statistik
                    </span>
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--slate-500)', margin: 0, lineHeight: 1.4 }}>
                    Akun ini dapat menambah, mengedit, mengimpor, memverifikasi data, dan mempublikasikan data statistik tanpa batasan peran terpisah.
                  </p>
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: 24 }}>
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" loading={isSaving} icon={<Sparkles size={14} />}>
                  {editingUser ? 'Simpan Perubahan' : 'Daftarkan Pengelola'}
                </Button>
              </div>
            </form>
          </div>
        </div>
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
