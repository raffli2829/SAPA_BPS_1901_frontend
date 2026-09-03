'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button, Toast, EmptyState } from '@/components/ui';
import { ChatbotTemplateRepo, DatasetRepo, subscribe } from '@/lib/repository';
import { ChatbotTemplate, DataStatus, Dataset } from '@/lib/types';
import { BackendApi } from '@/lib/apiClient';
import {
  MessageSquare,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Send,
  Smartphone,
  Bot,
  Search,
  CheckCheck,
  RefreshCw,
  Hash,
  Lock,
  Eye,
  ExternalLink,
  Layers,
  FileSpreadsheet,
  HelpCircle,
} from 'lucide-react';

export default function KeywordsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [templates, setTemplates] = useState<ChatbotTemplate[]>(() => {
    try {
      return ChatbotTemplateRepo.getAll();
    } catch {
      return [];
    }
  });

  const [search, setSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState<'ALL' | 'DATASET' | 'MANUAL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Modal Add / Edit Template
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChatbotTemplate | null>(null);
  const [formKeyword, setFormKeyword] = useState('');
  const [formResponse, setFormResponse] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Modal Preview (Read-Only)
  const [previewTemplate, setPreviewTemplate] = useState<ChatbotTemplate | null>(null);

  // WhatsApp Simulator State
  const [simMessages, setSimMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: 'Halo! Selamat datang di layanan *SAPA BPS Kab. Bangka* 😊\n\nKetik kata kunci data statistik (contoh: *penduduk*, *kemiskinan*, *ipm*, atau *menu*) untuk melihat template balasan otomatis.',
      time: '08:00',
    },
  ]);
  const [simInput, setSimInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [simSubmenu, setSimSubmenu] = useState<{
    category: string;
    datasets: { id: string; name: string; code: string; response?: string }[];
  } | null>(null);

  // Bot Connection Status
  const [botStatus, setBotStatus] = useState<{ state: string; phoneNumber?: string }>({ state: 'connected' });

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    function reload() {
      setTemplates(ChatbotTemplateRepo.getAll());
    }

    // Background sync with backend FAQs
    ChatbotTemplateRepo.syncWithBackendFaqs().then(() => {
      setTemplates(ChatbotTemplateRepo.getAll());
    });

    BackendApi.getBotStatus().then((st) => {
      if (st) setBotStatus(st);
    });

    const unsub = subscribe(reload);
    return unsub;
  }, [isAuthenticated, isLoading, router]);

  // Helper untuk membersihkan label 'Resmi BPS' menjadi 'Layanan & FAQ BPS'
  const getCleanCategory = (cat?: string) => {
    if (!cat || cat === 'Resmi BPS') return 'Layanan & FAQ BPS';
    return cat;
  };

  // Categories list (Menggantikan 'Resmi BPS' secara konsisten)
  const categories = useMemo(() => {
    const set = new Set(
      templates.map((t) => getCleanCategory(t.category))
    );
    return ['ALL', ...Array.from(set)];
  }, [templates]);

  // Metrics count
  const datasetCount = useMemo(() => templates.filter((t) => t.source_type === 'DATASET').length, [templates]);
  const manualCount = useMemo(() => templates.filter((t) => t.source_type === 'MANUAL').length, [templates]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        t.keyword.toLowerCase().includes(search.toLowerCase()) ||
        t.response.toLowerCase().includes(search.toLowerCase());
      const matchSource =
        selectedSource === 'ALL' ||
        (selectedSource === 'DATASET' && t.source_type === 'DATASET') ||
        (selectedSource === 'MANUAL' && t.source_type === 'MANUAL');
      const cleanCategory = getCleanCategory(t.category);
      const matchCat = selectedCategory === 'ALL' || cleanCategory === selectedCategory;
      return matchSearch && matchSource && matchCat;
    });
  }, [templates, search, selectedSource, selectedCategory]);

  const handleOpenModal = (tpl?: ChatbotTemplate) => {
    if (tpl) {
      if (tpl.source_type === 'DATASET') {
        // Dataset template is read-only, open preview instead
        setPreviewTemplate(tpl);
        return;
      }
      setEditingTemplate(tpl);
      setFormKeyword(tpl.keyword);
      setFormResponse(tpl.response);
      setFormCategory(tpl.category || 'Umum');
    } else {
      setEditingTemplate(null);
      setFormKeyword('');
      setFormResponse('');
      setFormCategory('Informasi Umum');
    }
    setIsModalOpen(true);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKeyword.trim() || !formResponse.trim()) {
      setToast({ msg: 'Kata kunci dan isi template pesan balasan wajib diisi.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingTemplate) {
        ChatbotTemplateRepo.update(editingTemplate.id, {
          keyword: formKeyword.trim(),
          response: formResponse.trim(),
          category: formCategory.trim() || 'Umum',
        });
        setToast({ msg: 'Template balasan chatbot berhasil diperbarui.', type: 'success' });
      } else {
        ChatbotTemplateRepo.create({
          keyword: formKeyword.trim(),
          response: formResponse.trim(),
          category: formCategory.trim() || 'Umum',
        });
        setToast({ msg: 'Kata kunci baru berhasil didaftarkan ke chatbot WhatsApp.', type: 'success' });
      }
      setIsModalOpen(false);
      setTemplates(ChatbotTemplateRepo.getAll());
    } catch {
      setToast({ msg: 'Gagal menyimpan template chatbot.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = (tpl: ChatbotTemplate) => {
    if (tpl.source_type === 'DATASET') {
      alert('Template yang berasal dari dataset resmi bersifat otomatis dan tidak dapat dihapus.');
      return;
    }
    if (confirm(`Hapus template kata kunci "${tpl.keyword}" dari bot WhatsApp?`)) {
      ChatbotTemplateRepo.delete(tpl.id);
      setTemplates(ChatbotTemplateRepo.getAll());
      setToast({ msg: `Kata kunci "${tpl.keyword}" berhasil dihapus.`, type: 'success' });
    }
  };

  // WhatsApp Simulator Action
  const handleSimSend = (textToSend?: string) => {
    const text = textToSend || simInput;
    if (!text.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Add user message
    setSimMessages((prev) => [...prev, { sender: 'user', text, time: timeStr }]);
    if (!textToSend) setSimInput('');
    setIsBotTyping(true);

    // Find match in templates & dynamic menu
    setTimeout(() => {
      const clean = text.trim().toLowerCase();

      // Bangun daftar menu dinamis: Mengelompokkan berdasarkan Kategori dataset resmi BPS
      const allPublishedDs = DatasetRepo.getAll().filter((d) => d.status === DataStatus.PUBLISHED);
      const datasetTemplates = templates.filter((t) => t.source_type === 'DATASET' && t.id !== 'tpl-system-menu');
      const seenCategories = new Set<string>();
      let mIdx = 1;
      const dynamicItems: { num: number; label: string; category: string; type: 'dataset' | 'service'; response?: string }[] = [];

      allPublishedDs.forEach((ds) => {
        const cat = ds.category || ds.name;
        const lower = cat.trim().toLowerCase();
        if (!seenCategories.has(lower)) {
          seenCategories.add(lower);
          const tpl = datasetTemplates.find(
            (t) => (t.category && t.category.trim().toLowerCase() === lower) || t.keyword.trim().toLowerCase() === lower
          );
          dynamicItems.push({
            num: mIdx++,
            label: cat,
            category: cat,
            type: 'dataset',
            response: tpl?.response,
          });
        }
      });

      const s1Num = mIdx++;
      dynamicItems.push({
        num: s1Num,
        label: 'Apa saja layanan BPS?',
        category: 'Layanan',
        type: 'service',
        response:
          `🏛️ *LAYANAN RESMI BPS KABUPATEN BANGKA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n1. Pelayanan Statistik Terpadu (PST) & Konsultasi\n2. Rekomendasi Kegiatan Statistik (Romantik)\n3. Permintaan Data Mikro dan Publikasi Statistik Resmi\n4. Layanan Pengaduan & Informasi Publik\n\n_Ketik *petugas* untuk berbicara dengan admin PST._`,
      });

      const s2Num = mIdx++;
      dynamicItems.push({
        num: s2Num,
        label: 'Hubungi Petugas PST BPS',
        category: 'Kontak',
        type: 'service',
        response:
          `🏛️ *LAYANAN KONSULTASI STATISTIK TERPADU (PST)*\n*BPS Kabupaten Bangka*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🏢 *Alamat:* Jl. Ahmad Yani Jalur Dua Sungailiat\n⏰ *Jam Layanan:* Senin – Jumat (08.00 – 15.30 WIB)\n📞 *WhatsApp PST:* https://wa.me/6281234567890\n✉️ *Email:* bps1901@bps.go.id\n🌐 *Portal:* bangkakab.bps.go.id`,
      });

      const dynamicMenuStr =
        `📋 *MENU UTAMA LAYANAN DATA SAPA BPS*\n🏛️ *BPS KABUPATEN BANGKA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Silakan pilih topik informasi statistik resmi BPS Kab. Bangka berikut:\n\n` +
        dynamicItems.map((it) => `${it.num}. *${it.label}*`).join('\n') +
        `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 _Balas dengan angka *1* - *${s2Num}*, atau ketik kata kunci pertanyaan langsung._`;

      let reply = '';

      // 1. Jika pengguna sedang berada di dalam Sub-menu pemilihan dataset rinci
      if (simSubmenu) {
        if (['menu', 'batal', 'kembali', 'exit', 'keluar', 'p'].includes(clean)) {
          setSimSubmenu(null);
          reply = dynamicMenuStr;
        } else if (/^\d+$/.test(clean)) {
          const subNum = parseInt(clean, 10);
          if (subNum >= 1 && subNum <= simSubmenu.datasets.length) {
            const chosen = simSubmenu.datasets[subNum - 1];
            setSimSubmenu(null);
            const foundTpl = templates.find((t) => t.dataset_id === chosen.id || t.keyword.toLowerCase() === chosen.name.toLowerCase());
            reply = foundTpl ? foundTpl.response : chosen.response || `📊 *DATA: ${chosen.name}* (${chosen.code})`;
          } else {
            reply =
              `⚠️ Pilihan nomor *${subNum}* tidak tersedia.\n\n` +
              `Silakan balas dengan angka *1* - *${simSubmenu.datasets.length}*, atau ketik *menu* untuk kembali ke Menu Utama.`;
          }
        } else {
          setSimSubmenu(null);
        }
      }

      // 2. Jika tidak dalam submenu
      if (!reply) {
        if (/^\d+$/.test(clean)) {
          const num = parseInt(clean, 10);
          const item = dynamicItems.find((d) => d.num === num);
          if (item) {
            if (item.type === 'service') {
              reply = item.response || '';
            } else {
              // Cek apakah ada lebih dari 1 dataset dalam kategori ini
              const catLower = item.category.trim().toLowerCase();
              const matchedDatasets = allPublishedDs.filter((d) => {
                const dCat = (d.category || '').trim().toLowerCase();
                return dCat === catLower;
              });

              if (matchedDatasets.length > 1) {
                const subDs = matchedDatasets.map((d) => {
                  const tpl = datasetTemplates.find((t) => t.dataset_id === d.id);
                  return {
                    id: d.id,
                    name: d.name,
                    code: d.code,
                    response: tpl?.response,
                  };
                });
                setSimSubmenu({ category: item.label, datasets: subDs });
                const lines = subDs.map((d, i) => `${i + 1}. *${d.name}* (${d.code})`);
                reply =
                  `📊 *PILIHAN DATASET: ${item.label.toUpperCase()}*\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `Terdapat *${subDs.length} dataset statistik resmi* dalam kategori ini. Silakan balas dengan nomor dataset yang ingin Anda lihat lebih rinci:\n\n` +
                  lines.join('\n') +
                  `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `💡 _Balas dengan angka *1* - *${subDs.length}*, atau ketik *menu* untuk kembali ke Menu Utama._`;
              } else {
                const singleDs = matchedDatasets[0];
                const tpl = singleDs ? datasetTemplates.find((t) => t.dataset_id === singleDs.id) : null;
                reply = tpl?.response || item.response || '';
              }
            }
          } else {
            reply = `Maaf, pilihan nomor *${num}* belum tersedia.\n\n${dynamicMenuStr}`;
          }
        } else if (clean === 'menu' || clean === 'sapa' || clean === 'halo' || clean === 'p') {
          reply = dynamicMenuStr;
        } else {
          // Cek apakah kata kunci mengetik nama kategori yang memiliki > 1 dataset
          const matchedCategoryDs: Dataset[] = allPublishedDs.filter(
            (d: Dataset) => (d.category && d.category.trim().toLowerCase() === clean) || clean.includes((d.category || '').toLowerCase())
          );
          const uniqueCats: string[] = Array.from(new Set(matchedCategoryDs.map((d: Dataset) => d.category)));
          if (uniqueCats.length === 1 && matchedCategoryDs.length > 1) {
            const catName = uniqueCats[0];
            const subDs = matchedCategoryDs.map((d: Dataset) => {
              const tpl = datasetTemplates.find((t) => t.dataset_id === d.id);
              return {
                id: d.id,
                name: d.name,
                code: d.code,
                response: tpl?.response,
              };
            });
            setSimSubmenu({ category: catName, datasets: subDs });
            const lines = subDs.map((d, i: number) => `${i + 1}. *${d.name}* (${d.code})`);
            reply =
              `📊 *PILIHAN DATASET: ${catName.toUpperCase()}*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Terdapat *${subDs.length} dataset statistik resmi* dalam kategori ini. Silakan balas dengan nomor dataset yang ingin Anda lihat lebih rinci:\n\n` +
              lines.join('\n') +
              `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `💡 _Balas dengan angka *1* - *${subDs.length}*, atau ketik *menu* untuk kembali ke Menu Utama._`;
          } else {
            let matched = templates.find((t) => t.keyword.toLowerCase() === clean);
            if (!matched) {
              matched = templates.find(
                (t) => clean.includes(t.keyword.toLowerCase()) || t.keyword.toLowerCase().includes(clean)
              );
            }

            if (matched) {
              reply = matched.response;
            } else {
              reply =
                `Mohon maaf, kata kunci *"${text}"* belum terdaftar dalam template cepat kami.\n\n` +
                `💡 _Ketik *menu* untuk melihat daftar topik data resmi BPS Kab. Bangka, atau ketik *petugas* untuk konsultasi PST._`;
            }
          }
        }
      }

      setSimMessages((prev) => [...prev, { sender: 'bot', text: reply, time: timeStr }]);
      setIsBotTyping(false);
    }, 450);
  };

  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <Header
        title="Template Chatbot & Kata Kunci"
        subtitle="Kelola kata kunci pemicu serta respons otomatis bot WhatsApp SAPA BPS"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => handleOpenModal()}
          >
            Tambah Kata Kunci Manual
          </Button>
        }
      />

      <div className="page-content" style={{ maxWidth: 1320 }}>
        {/* Top Metric Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-xl)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Total Template Aktif
              </p>
              <h3 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 0', color: 'var(--slate-900)' }}>
                {templates.length} Keyword
              </h3>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--primary-50)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={20} />
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-xl)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Dari Dataset Resmi BPS
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0369a1' }}>
                  {datasetCount} Template
                </h3>
                <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                  Preview Only
                </span>
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: '#f0f9ff',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileSpreadsheet size={20} />
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-xl)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Template Kustom / Manual
              </p>
              <h3 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 0', color: 'var(--slate-900)' }}>
                {manualCount} Template
              </h3>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: '#f8fafc',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Edit2 size={18} />
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-xl)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--slate-500)', margin: 0, fontWeight: 500 }}>
                Status WhatsApp Bot
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: botStatus.state === 'connected' ? '#10b981' : '#f59e0b',
                    display: 'inline-block',
                  }}
                />
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--slate-900)' }}>
                  {botStatus.state === 'connected' ? 'Aktif Terhubung' : 'Standby / QR'}
                </h3>
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={20} />
            </div>
          </div>
        </div>

        {/* 2 Columns: Template List & Live WhatsApp Simulator */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.45fr) minmax(350px, 1fr)',
            gap: 24,
            alignItems: 'start',
          }}
          className="chatbot-layout-grid"
        >
          {/* Left Column: Template List */}
          <div>
            <div className="section" style={{ marginBottom: 0 }}>
              <div className="section-header" style={{ flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="section-title">
                    <Hash size={18} style={{ color: 'var(--primary-600)' }} />
                    Daftar Kata Kunci & Template Balasan
                  </h2>
                  <p className="section-subtitle">
                    Kategorisasi keyword pemicu chat. Template dari dataset resmi terlindungi dan dapat di-preview.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => handleOpenModal()}
                >
                  Tambah Template Baru
                </Button>
              </div>

              <div className="section-body">
                {/* Source Filter Tabs: All, Dataset (Read-Only), Manual */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedSource('ALL')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: selectedSource === 'ALL' ? '1px solid var(--primary-600)' : '1px solid var(--slate-200)',
                      background: selectedSource === 'ALL' ? 'var(--primary-50)' : '#ffffff',
                      color: selectedSource === 'ALL' ? 'var(--primary-700)' : 'var(--slate-600)',
                      transition: 'all 150ms',
                    }}
                  >
                    Semua ({templates.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSource('DATASET')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      border: selectedSource === 'DATASET' ? '1px solid #0284c7' : '1px solid var(--slate-200)',
                      background: selectedSource === 'DATASET' ? '#f0f9ff' : '#ffffff',
                      color: selectedSource === 'DATASET' ? '#0369a1' : 'var(--slate-600)',
                      transition: 'all 150ms',
                    }}
                  >
                    <Lock size={12} /> Dari Dataset Resmi ({datasetCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSource('MANUAL')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      border: selectedSource === 'MANUAL' ? '1px solid #475569' : '1px solid var(--slate-200)',
                      background: selectedSource === 'MANUAL' ? '#f1f5f9' : '#ffffff',
                      color: selectedSource === 'MANUAL' ? '#0f172a' : 'var(--slate-600)',
                      transition: 'all 150ms',
                    }}
                  >
                    <Edit2 size={12} /> Template Manual ({manualCount})
                  </button>
                </div>

                {/* Search Bar & Category Filter */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                    <Search
                      size={15}
                      style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }}
                    />
                    <input
                      type="text"
                      className="text-input"
                      placeholder="Cari kata kunci atau isi template chat..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
                    />
                  </div>

                  <div className="select-wrapper" style={{ minWidth: 200 }}>
                    <select
                      className="select-input"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      style={{ height: 38, fontSize: 13 }}
                    >
                      <option value="ALL">Semua Topik ({templates.length})</option>
                      {categories
                        .filter((cat) => cat !== 'ALL')
                        .map((cat) => {
                          const count = templates.filter((t) => getCleanCategory(t.category) === cat).length;
                          return (
                            <option key={cat} value={cat}>
                              {cat} ({count})
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>

                {/* Templates List */}
                {filteredTemplates.length === 0 ? (
                  <EmptyState
                    title="Tidak Ada Template Chatbot"
                    description={search ? `Tidak ada template yang cocok dengan "${search}".` : 'Belum ada kata kunci pada filter ini.'}
                    actions={
                      <Button variant="primary" size="sm" onClick={() => handleOpenModal()}>
                        Tambah Template Manual
                      </Button>
                    }
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {filteredTemplates.map((tpl) => {
                      const isFromDataset = tpl.source_type === 'DATASET';

                      return (
                        <div
                          key={tpl.id}
                          style={{
                            background: '#ffffff',
                            border: isFromDataset ? '1.5px solid #bae6fd' : '1px solid var(--slate-200)',
                            borderRadius: 'var(--radius-xl)',
                            padding: '18px 20px',
                            boxShadow: 'var(--shadow-subtle)',
                            transition: 'border-color 150ms, box-shadow 150ms',
                          }}
                        >
                          {/* Header of each Card */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: 'var(--slate-900)',
                                    background: isFromDataset ? '#f0f9ff' : 'var(--slate-100)',
                                    padding: '3px 10px',
                                    borderRadius: 'var(--radius-md)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  💬 &quot;{tpl.keyword}&quot;
                                </span>

                                {/* Source Badge */}
                                {isFromDataset ? (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: '#0369a1',
                                      background: '#e0f2fe',
                                      border: '1px solid #7dd3fc',
                                      padding: '2px 8px',
                                      borderRadius: 999,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <Lock size={11} /> Dari Dataset Resmi (Hanya Preview)
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: '#475569',
                                      background: '#f1f5f9',
                                      padding: '2px 8px',
                                      borderRadius: 999,
                                    }}
                                  >
                                    ✏️ Template Manual
                                  </span>
                                )}

                                {tpl.category && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 500,
                                      color: 'var(--slate-600)',
                                      background: 'var(--slate-50)',
                                      padding: '2px 8px',
                                      borderRadius: 999,
                                      border: '1px solid var(--slate-200)',
                                    }}
                                  >
                                    {getCleanCategory(tpl.category)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => handleSimSend(tpl.keyword)}
                                title="Uji coba balasan di Simulator"
                                style={{
                                  padding: '5px 10px',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: 'var(--primary-700)',
                                  background: 'var(--primary-50)',
                                  border: '1px solid var(--primary-200)',
                                  borderRadius: 'var(--radius-md)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Sparkles size={13} /> Coba di Simulator
                              </button>

                              {isFromDataset ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewTemplate(tpl)}
                                    title="Lihat Preview Lengkap"
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      color: '#0369a1',
                                      background: '#f0f9ff',
                                      border: '1px solid #bae6fd',
                                      borderRadius: 'var(--radius-md)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <Eye size={13} /> Preview
                                  </button>
                                  {tpl.dataset_id && (
                                    <Link href={`/datasets/${tpl.dataset_id}`}>
                                      <button
                                        type="button"
                                        title="Buka Halaman Dataset Asli"
                                        style={{
                                          padding: '5px 8px',
                                          color: 'var(--slate-600)',
                                          background: 'transparent',
                                          border: 'none',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                        }}
                                      >
                                        <ExternalLink size={14} />
                                      </button>
                                    </Link>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenModal(tpl)}
                                    style={{
                                      padding: '5px 8px',
                                      color: 'var(--slate-600)',
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                    }}
                                    title="Edit Template Manual"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTemplate(tpl)}
                                    style={{
                                      padding: '5px 8px',
                                      color: 'var(--error-text)',
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                    }}
                                    title="Hapus Template"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Message Content Preview Box */}
                          <div
                            style={{
                              background: isFromDataset ? '#f8fafc' : '#fcfcfd',
                              border: '1px solid var(--slate-150)',
                              borderRadius: 'var(--radius-lg)',
                              padding: '12px 16px',
                              fontSize: 12.5,
                              color: 'var(--slate-700)',
                              whiteSpace: 'pre-wrap',
                              maxHeight: 120,
                              overflowY: 'auto',
                              lineHeight: 1.5,
                            }}
                          >
                            {tpl.response}
                          </div>

                          {/* Footer Info */}
                          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--slate-400)' }}>
                            <span>
                              {isFromDataset
                                ? '🔒 Template otomatis tersinkronisasi dari pangkalan data BPS.'
                                : '✏️ Template kustom buatan operator.'}
                            </span>
                            <span>{tpl.updated_at ? `Diperbarui: ${tpl.updated_at.slice(0, 10)}` : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: WhatsApp Live Simulator */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--slate-200)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                height: 620,
              }}
            >
              {/* WhatsApp Simulator Header */}
              <div
                style={{
                  background: '#075e54',
                  color: '#ffffff',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: '#128c7e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}
                >
                  🤖
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                    SAPA BPS Kab. Bangka
                  </h4>
                  <span style={{ fontSize: 11, color: '#a7f3d0' }}>
                    {isBotTyping ? 'sedang mengetik...' : 'online (Asisten Statistik)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSimMessages([
                      {
                        sender: 'bot',
                        text: 'Halo! Selamat datang di layanan *SAPA BPS Kab. Bangka* 😊\n\nKetik kata kunci data statistik (contoh: *penduduk*, *kemiskinan*, *ipm*, atau *menu*) untuk mencoba balasan.',
                        time: '08:00',
                      },
                    ])
                  }
                  style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', opacity: 0.8 }}
                  title="Reset Obrolan Simulator"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Chat Body (WhatsApp look) */}
              <div
                style={{
                  flex: 1,
                  background: '#efeae2',
                  padding: '14px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ textAlign: 'center', margin: '4px 0' }}>
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.85)',
                      padding: '3px 10px',
                      borderRadius: 6,
                      fontSize: 10.5,
                      color: '#54656f',
                      boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
                    }}
                  >
                    Simulator Chatbot WhatsApp SAPA BPS
                  </span>
                </div>

                {simMessages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      background: msg.sender === 'user' ? '#d9fdd3' : '#ffffff',
                      borderRadius: msg.sender === 'user' ? '8px 0px 8px 8px' : '0px 8px 8px 8px',
                      padding: '8px 12px',
                      boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                      fontSize: 12.5,
                      lineHeight: 1.45,
                      color: '#111b21',
                      wordBreak: 'break-word',
                    }}
                  >
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                    <div
                      style={{
                        textAlign: 'right',
                        fontSize: 10,
                        color: '#667781',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 3,
                      }}
                    >
                      {msg.time}
                      {msg.sender === 'user' && <CheckCheck size={12} color="#53bdeb" />}
                    </div>
                  </div>
                ))}

                {isBotTyping && (
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      background: '#ffffff',
                      borderRadius: '0px 8px 8px 8px',
                      padding: '8px 14px',
                      fontSize: 11.5,
                      color: '#667781',
                      fontStyle: 'italic',
                    }}
                  >
                    Bot sedang merangkai data...
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div
                style={{
                  background: '#f0f2f5',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  placeholder="Ketik kata kunci untuk menguji..."
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSimSend();
                  }}
                  style={{
                    flex: 1,
                    background: '#ffffff',
                    border: '1px solid #d1d7db',
                    borderRadius: 20,
                    padding: '8px 14px',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSimSend()}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#00a884',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Kirim Pesan"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Add / Edit Template (MANUAL ONLY) */}
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
              maxWidth: 600,
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--slate-900)' }}>
                  {editingTemplate ? 'Edit Template Chatbot' : 'Tambah Kata Kunci & Template Balasan'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--slate-500)' }}>
                  Template kustom buatan operator yang dapat disesuaikan isinya
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

            <form onSubmit={handleSaveTemplate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="input-label" htmlFor="kw">
                    Kata Kunci Pemicu (Trigger Keyword)<span className="input-required">*</span>
                  </label>
                  <input
                    id="kw"
                    type="text"
                    required
                    className="text-input"
                    placeholder="Contoh: Jadwal Rilis BPS, Konsultasi Statistik, Kontak PST"
                    value={formKeyword}
                    onChange={(e) => setFormKeyword(e.target.value)}
                    autoFocus
                  />
                  <p className="input-hint">Jika pengguna WhatsApp mengetik kalimat ini, bot akan langsung membalas dengan template di bawah.</p>
                </div>

                <div>
                  <label className="input-label" htmlFor="cat">
                    Kategori / Topik
                  </label>
                  <input
                    id="cat"
                    type="text"
                    list="category-suggestions"
                    className="text-input"
                    placeholder="Pilih atau ketik kategori baru (contoh: Layanan & Kontak, Ekonomi Makro)"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  />
                  <datalist id="category-suggestions">
                    {categories.filter((c) => c !== 'ALL').map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {['Layanan & Kontak', 'Ekonomi Makro', 'Sosial & Kependudukan', 'Indikator Makro', 'Informasi Umum'].map((quickCat) => (
                      <button
                        key={quickCat}
                        type="button"
                        onClick={() => setFormCategory(quickCat)}
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: formCategory === quickCat ? '1px solid var(--primary-600)' : '1px solid var(--slate-200)',
                          background: formCategory === quickCat ? 'var(--primary-50)' : '#ffffff',
                          color: formCategory === quickCat ? 'var(--primary-700)' : 'var(--slate-600)',
                          cursor: 'pointer',
                        }}
                      >
                        {quickCat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="input-label" htmlFor="resp">
                      Isi Pesan Balasan WhatsApp (Template)<span className="input-required">*</span>
                    </label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setFormResponse((prev) => prev + '*Teks Tebal*')}
                        style={{ fontSize: 11, padding: '2px 6px', background: 'var(--slate-100)', border: '1px solid var(--slate-200)', borderRadius: 4, cursor: 'pointer' }}
                      >
                        *B*
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormResponse((prev) => prev + '_Teks Miring_')}
                        style={{ fontSize: 11, padding: '2px 6px', background: 'var(--slate-100)', border: '1px solid var(--slate-200)', borderRadius: 4, cursor: 'pointer' }}
                      >
                        _I_
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormResponse((prev) => prev + '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')}
                        style={{ fontSize: 11, padding: '2px 6px', background: 'var(--slate-100)', border: '1px solid var(--slate-200)', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Garis
                      </button>
                    </div>
                  </div>
                  <textarea
                    id="resp"
                    required
                    className="textarea-input"
                    rows={6}
                    placeholder="Tuliskan isi pesan balasan resmi..."
                    value={formResponse}
                    onChange={(e) => setFormResponse(e.target.value)}
                  />
                  <p className="input-hint">Mendukung format WhatsApp: *tebal*, _miring_, dan emoji.</p>
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: 20 }}>
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" loading={isSaving} icon={<Sparkles size={14} />}>
                  Simpan Template
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview Read-Only (FOR DATASET TEMPLATES) */}
      {previewTemplate && (
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
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 580,
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--radius-lg)',
                    background: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Lock size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--slate-900)' }}>
                    Preview Template Dataset Resmi
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--slate-500)' }}>
                    Keyword: <strong>&quot;{previewTemplate.keyword}&quot;</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--slate-400)' }}
              >
                ✕
              </button>
            </div>

            {/* Read-Only Banner */}
            <div
              style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: 12.5,
                color: '#0369a1',
                marginBottom: 16,
                lineHeight: 1.45,
              }}
            >
              🔒 <strong>Template ini tidak dapat diedit secara manual</strong> karena datanya dihasilkan otomatis secara dinamis dari Katalog Dataset BPS. Jika ingin memperbarui angka atau rinciannya, perbarui data melalui menu <strong>Katalog Dataset</strong>.
            </div>

            {/* Formatted Preview Box */}
            <div
              style={{
                background: '#efeae2',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '0px 8px 8px 8px',
                  padding: '12px 14px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: '#111b21',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {previewTemplate.response}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              {previewTemplate.dataset_id ? (
                <Link href={`/datasets/${previewTemplate.dataset_id}`}>
                  <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
                    Buka Dataset Asli
                  </Button>
                </Link>
              ) : <div />}

              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Sparkles size={14} />}
                  onClick={() => {
                    handleSimSend(previewTemplate.keyword);
                    setPreviewTemplate(null);
                  }}
                >
                  Uji di Simulator WhatsApp
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(null)}>
                  Tutup
                </Button>
              </div>
            </div>
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
