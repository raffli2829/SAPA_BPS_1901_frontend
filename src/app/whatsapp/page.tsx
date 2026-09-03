'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import { Button, Modal, Toast } from '@/components/ui';
import { BackendApi, getEffectiveBackendUrl } from '@/lib/apiClient';
import { formatDate } from '@/lib/utils';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Radio,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Sparkles,
  PhoneCall,
  KeyRound,
  Info,
  Layers,
  Activity,
  Server,
  Zap,
  Database,
  Wifi,
  CheckCircle,
} from 'lucide-react';

interface BotStatusData {
  state: 'connecting' | 'connected' | 'qr_ready' | 'disconnected';
  qr: string | null;
  phoneNumber?: string;
  connectedAt?: string;
  qrUpdatedAt?: number;
  serverTime?: string;
}

interface SystemHealthData {
  status: string;
  service: string;
  port: string;
  timestamp: string;
  uptime: number;
  botState: string;
  phoneNumber: string | null;
}

const QR_EXPIRE_SECONDS = 60;

export default function WhatsAppHostPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  // Bot Status State
  const [botStatus, setBotStatus] = useState<BotStatusData>({
    state: 'connecting',
    qr: null,
  });
  const [isFetchingStatus, setIsFetchingStatus] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Auto-refresh countdown (60s)
  const [countdown, setCountdown] = useState<number>(QR_EXPIRE_SECONDS);
  const [isRefreshingQR, setIsRefreshingQR] = useState(false);

  // Tabs: 'qr' | 'pairing'
  const [loginMethod, setLoginMethod] = useState<'qr' | 'pairing'>('qr');

  // Phone Pairing Code State
  const [phoneInput, setPhoneInput] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Logout Modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Diagnostics & Detailed Status Check
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [lastPing, setLastPing] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [isCheckingDiagnostics, setIsCheckingDiagnostics] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [datasetCount, setDatasetCount] = useState<number | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Helper formatting uptime
  const formatUptime = (seconds?: number) => {
    if (!seconds && seconds !== 0) return '-';
    const s = Math.floor(seconds);
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (days > 0) return `${days} hari ${hours} jam ${minutes} menit`;
    if (hours > 0) return `${hours} jam ${minutes} menit`;
    if (minutes > 0) return `${minutes} menit ${secs} detik`;
    return `${secs} detik`;
  };

  // Helper formatting phone
  const formatPhone = (phone?: string | null) => {
    if (!phone) return '-';
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('62')) {
      return `+62 ${clean.slice(2, 5)}-${clean.slice(5, 9)}-${clean.slice(9)}`;
    }
    return phone;
  };

  // Diagnostics Runner
  const handleRunDiagnostics = useCallback(async (openModal = true) => {
    setIsCheckingDiagnostics(true);
    setIsFetchingStatus(true);
    setCheckError(null);
    const startTime = performance.now();

    try {
      const [healthRes, botRes, summaryRes] = await Promise.all([
        BackendApi.getHealth().catch(() => null),
        BackendApi.getBotStatus().catch(() => null),
        BackendApi.getDashboardSummary().catch(() => null),
      ]);

      const ping = Math.round(performance.now() - startTime);
      setLastPing(ping);
      setLastCheckedAt(new Date());

      if (summaryRes && typeof summaryRes.total_datasets === 'number') {
        setDatasetCount(summaryRes.total_datasets);
      }

      if (botRes) {
        setBotStatus(botRes);
        if (botRes.qr && botRes.state === 'qr_ready') {
          try {
            const url = await QRCode.toDataURL(botRes.qr, {
              width: 320,
              margin: 2,
              color: { dark: '#0f172a', light: '#ffffff' },
            });
            setQrDataUrl(url);
          } catch (qrErr) {
            console.error('Failed generating QR Data URL:', qrErr);
          }
        } else {
          setQrDataUrl(null);
        }
      }

      const isBackendLive = Boolean(healthRes && (healthRes.status === 'ok' || healthRes.service)) || Boolean(botRes);

      if (isBackendLive) {
        if (healthRes) {
          setHealthData(healthRes);
        }
        const botConnected = botRes?.state === 'connected' || healthRes?.botState === 'connected';
        const phone = botRes?.phoneNumber || healthRes?.phoneNumber;

        if (botConnected) {
          setToast({
            msg: `✅ [${ping}ms] Sistem Normal: Server Aktif & WhatsApp Bot Terhubung (${formatPhone(phone)})`,
            type: 'success',
          });
        } else if (botRes?.state === 'qr_ready') {
          setToast({
            msg: `🟡 [${ping}ms] Server Backend Aktif. Bot WhatsApp siap scan QR code.`,
            type: 'success',
          });
        } else {
          setToast({
            msg: `🔵 [${ping}ms] Server Backend Aktif. Bot WhatsApp status: ${botRes?.state || healthRes?.botState || 'connecting'}`,
            type: 'success',
          });
        }
      } else {
        setCheckError('Server backend tidak merespons. Pastikan file START_SAPA_BPS.bat dan tunnel Ngrok aktif.');
        setToast({
          msg: '❌ Server backend tidak merespons. Periksa tunnel Ngrok dan START_SAPA_BPS.bat.',
          type: 'error',
        });
      }

      if (openModal) {
        setShowDiagnosticModal(true);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Gagal menghubungi server.';
      setCheckError(errMsg);
      setToast({
        msg: '❌ Terjadi kesalahan saat memeriksa status server.',
        type: 'error',
      });
      if (openModal) {
        setShowDiagnosticModal(true);
      }
    } finally {
      setIsCheckingDiagnostics(false);
      setIsFetchingStatus(false);
    }
  }, []);

  const handleCopyReport = () => {
    const timeStr = lastCheckedAt
      ? lastCheckedAt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' })
      : new Date().toLocaleString('id-ID');
    const isBotOnline = botStatus.state === 'connected' || healthData?.botState === 'connected';
    const phone = botStatus.phoneNumber || healthData?.phoneNumber;
    const uptimeStr = formatUptime(healthData?.uptime);

    const report = [
      '====================================================',
      '        LAPORAN STATUS & DIAGNOSTIK SAPA BPS        ',
      '====================================================',
      `Waktu Pengecekan : ${timeStr} WIB`,
      `Status Backend   : ${healthData ? 'ONLINE / SEHAT (Port 80)' : 'TIDAK MERESPONS'}`,
      `Latency (Ping)   : ${lastPing !== null ? `${lastPing} ms` : '-'}`,
      `Uptime Server    : ${uptimeStr}`,
      `Bot WhatsApp     : ${isBotOnline ? 'ONLINE & TERHUBUNG' : botStatus.state === 'qr_ready' ? 'MENUNGGU SCAN QR' : botStatus.state}`,
      `Nomor Host       : ${formatPhone(phone)}`,
      `Enkripsi Sesi    : Signal Protocol End-to-End`,
      `Dataset Aktif    : ${datasetCount !== null ? `${datasetCount} Dataset` : 'Tersinkron'}`,
      `Public Endpoint  : https://footless-aptitude-caloric.ngrok-free.dev`,
      `Health Endpoint  : https://footless-aptitude-caloric.ngrok-free.dev/health`,
      '====================================================',
      isBotOnline
        ? 'KESIMPULAN: Layanan Chatbot WhatsApp & REST API beroperasi normal.'
        : 'KESIMPULAN: Server aktif, silakan scan QR code atau sambungkan nomor host.',
    ].join('\n');

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setToast({ msg: 'Laporan diagnostik lengkap berhasil disalin ke clipboard!', type: 'success' });
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // 1. Fetch Bot Status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await BackendApi.getBotStatus();
      if (res) {
        setBotStatus(res);

        // Jika ada QR code baru
        if (res.qr && res.state === 'qr_ready') {
          try {
            const url = await QRCode.toDataURL(res.qr, {
              width: 320,
              margin: 2,
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            setQrDataUrl(url);
          } catch (qrErr) {
            console.error('Failed generating QR Data URL:', qrErr);
          }
        } else {
          setQrDataUrl(null);
        }
      }
    } catch (err) {
      console.error('Error fetching bot status:', err);
    }
  }, []);

  // 2. Refresh QR Code (manual = reset sesi di server, auto = hanya sinkronisasi status terbaru)
  const handleRefreshQR = useCallback(async (manual = true) => {
    setIsRefreshingQR(true);
    try {
      if (manual) {
        await BackendApi.resetBotSession();
      }
      setCountdown(QR_EXPIRE_SECONDS);
      setPairingCode(null);
      await fetchStatus();
      if (manual) {
        setToast({ msg: 'Sesi diperbarui. Menyiapkan QR Code baru...', type: 'success' });
      }
    } catch (err) {
      if (manual) {
        setToast({ msg: 'Gagal memperbarui QR Code. Pastikan server backend aktif.', type: 'error' });
      }
    } finally {
      setIsRefreshingQR(false);
    }
  }, [fetchStatus]);

  // 3. Logout / Putuskan Sambungan
  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      const res = await BackendApi.logoutBot();
      if (res && res.success) {
        setToast({ msg: 'Sambungan host WhatsApp berhasil diputuskan. QR Code baru siap.', type: 'success' });
        setShowLogoutModal(false);
        setBotStatus({ state: 'connecting', qr: null });
        setCountdown(QR_EXPIRE_SECONDS);
        await handleRefreshQR(false);
      } else {
        setToast({ msg: res?.message || 'Gagal logout dari host WhatsApp.', type: 'error' });
      }
    } catch (err) {
      setToast({ msg: 'Terjadi kesalahan saat memutuskan sambungan.', type: 'error' });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // 4. Request Pairing Code (Nomor Telepon)
  const handleRequestPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) {
      setToast({ msg: 'Silakan masukkan nomor WhatsApp Anda.', type: 'error' });
      return;
    }

    setIsRequestingCode(true);
    setPairingCode(null);
    try {
      const res = await BackendApi.requestPairingCode(phoneInput.trim());
      if (res && res.success && res.code) {
        setPairingCode(res.code);
        setToast({ msg: 'Kode pairing berhasil didapatkan!', type: 'success' });
      } else {
        setToast({
          msg: res?.message || 'Gagal mendapatkan kode pairing. Pastikan nomor benar dan bot belum terhubung.',
          type: 'error',
        });
      }
    } catch (err) {
      setToast({ msg: 'Terjadi kesalahan saat meminta kode pairing.', type: 'error' });
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Initial fetch and polling loop
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const initialTimer = setTimeout(() => {
      fetchStatus();
    }, 0);
    const interval = setInterval(fetchStatus, 3000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isAuthenticated, isLoading, router, fetchStatus]);

  // Auto-refresh polling saat BELUM connected
  useEffect(() => {
    if (botStatus.state === 'connected' || healthData?.botState === 'connected') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Hanya sinkronisasi status/QR terbaru tanpa mereset sesi aktif di server
          handleRefreshQR(false);
          return QR_EXPIRE_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [botStatus.state, healthData?.botState, handleRefreshQR]);

  if (isLoading || !isAuthenticated) return null;

  const isConnected = botStatus.state === 'connected' || healthData?.botState === 'connected';
  const effectivePhoneNumber = botStatus.phoneNumber || healthData?.phoneNumber;

  return (
    <AppLayout>
      <Header
        title="Host WhatsApp Chatbot"
        subtitle="Kelola perangkat host penanggung jawab chatbot resmi SAPA BPS Kab. Bangka"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isConnected ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: '#ecfdf5',
                  border: '1px solid #10b981',
                  color: '#047857',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                  }}
                />
                ONLINE & TERHUBUNG
              </div>
            ) : botStatus.state === 'connecting' ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: '#eff6ff',
                  border: '1px solid #3b82f6',
                  color: '#1d4ed8',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <RefreshCw size={12} className="spin" />
                MENYAMBUNGKAN KE WHATSAPP...
              </div>
            ) : botStatus.state === 'qr_ready' ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: '#fffbeb',
                  border: '1px solid #f59e0b',
                  color: '#b45309',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#f59e0b',
                    boxShadow: '0 0 8px #f59e0b',
                  }}
                />
                MENUNGGU SCAN QR ({countdown}s)
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: '#f1f5f9',
                  border: '1px solid #94a3b8',
                  color: '#475569',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <RefreshCw size={12} className={isRefreshingQR ? 'spin' : ''} />
                MENYIAPKAN SOCKET...
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              icon={
                <RefreshCw
                  size={13}
                  className={isCheckingDiagnostics || isFetchingStatus ? 'spin' : ''}
                />
              }
              onClick={() => handleRunDiagnostics(true)}
              title="Periksa koneksi, latency ping, dan diagnosa status lengkap"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
            >
              <span>{isCheckingDiagnostics ? 'Memeriksa...' : 'Cek Status'}</span>
              {lastPing !== null && !isCheckingDiagnostics && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '2px 7px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 700,
                    background: lastPing < 60 ? '#ecfdf5' : lastPing < 200 ? '#fef3c7' : '#fee2e2',
                    color: lastPing < 60 ? '#047857' : lastPing < 200 ? '#b45309' : '#b91c1c',
                    border: `1px solid ${lastPing < 60 ? '#a7f3d0' : lastPing < 200 ? '#fde68a' : '#fca5a5'}`,
                  }}
                >
                  <Activity size={10} />
                  {lastPing}ms
                </span>
              )}
            </Button>
          </div>
        }
      />

      <div className="page-content" style={{ maxWidth: 1180 }}>
        {/* ============================================================ */}
        {/* KONDISI 1: BOT SUDAH TERHUBUNG (CONNECTED)                   */}
        {/* ============================================================ */}
        {isConnected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Card Hero Connected */}
            <div
              style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
                borderRadius: 16,
                padding: '32px 28px',
                color: '#ffffff',
                boxShadow: '0 12px 30px -10px rgba(6, 78, 59, 0.4)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 200,
                  height: 200,
                  background: 'radial-gradient(circle, rgba(52, 211, 153, 0.25) 0%, transparent 70%)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 16,
                      background: 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(8px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      flexShrink: 0,
                    }}
                  >
                    <Smartphone size={30} style={{ color: '#34d399' }} />
                  </div>
                  <div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(16, 185, 129, 0.3)',
                        border: '1px solid rgba(52, 211, 153, 0.4)',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11.5,
                        fontWeight: 600,
                        letterSpacing: 0.5,
                        marginBottom: 8,
                      }}
                    >
                      <CheckCircle2 size={12} style={{ color: '#34d399' }} />
                      PERANGKAT HOST AKTIF
                    </div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
                      {formatPhone(effectivePhoneNumber)}
                    </h2>
                    <p style={{ margin: 0, fontSize: 13.5, color: '#a7f3d0', maxWidth: 540, lineHeight: 1.5 }}>
                      Akun WhatsApp ini bertindak sebagai penanggung jawab resmi layanan chatbot <strong>SAPA BPS Kab. Bangka</strong>. Seluruh pesan masyarakat akan dijawab secara otomatis melalui nomor ini.
                    </p>
                  </div>
                </div>

                {/* Tombol Putuskan Sambungan */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Button
                    variant="danger"
                    size="md"
                    icon={<LogOut size={15} />}
                    onClick={() => setShowLogoutModal(true)}
                    style={{
                      boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
                      fontWeight: 600,
                    }}
                  >
                    Logout / Putuskan Sambungan
                  </Button>
                </div>
              </div>

              {/* Status Footer Chips */}
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 18,
                  borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  gap: 20,
                  flexWrap: 'wrap',
                  fontSize: 12.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#d1fae5' }}>
                  <Clock size={14} style={{ color: '#34d399' }} />
                  <span>Terhubung Sejak: <strong>{botStatus.connectedAt ? formatDate(botStatus.connectedAt) : 'Sesi Aktif'}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#d1fae5' }}>
                  <ShieldCheck size={14} style={{ color: '#34d399' }} />
                  <span>Enkripsi End-to-End: <strong>Aktif (Signal Protocol)</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#d1fae5' }}>
                  <Radio size={14} style={{ color: '#34d399' }} />
                  <span>Model Jawaban: <strong>Dinamis Website & Database BPS</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Actions & Live Simulator Banner */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 16,
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--slate-200)',
                  borderRadius: 14,
                  padding: 20,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                    Simulator Chatbot Admin
                  </h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                    Ingin menguji bagaimana bot membalas pertanyaan data tanpa mengirim chat ke nomor WhatsApp asli?
                  </p>
                  <Link href="/keywords">
                    <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}>
                      Buka Simulator Chatbot
                    </Button>
                  </Link>
                </div>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--slate-200)',
                  borderRadius: 14,
                  padding: 20,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: '#f0fdf4',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Layers size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                    Katalog & Input Data Baru
                  </h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                    Setiap dataset baru yang Anda input dan publikasikan otomatis disajikan oleh bot ke masyarakat.
                  </p>
                  <Link href="/input">
                    <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}>
                      Input Data Statistik
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* KONDISI 2: BOT BELUM TERHUBUNG (LOGIN QR / PAIRING)          */
          /* ============================================================ */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(340px, 480px) 1fr',
              gap: 24,
              alignItems: 'start',
            }}
          >
            {/* Kolom Kiri: Kartu Login Host */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--slate-200)',
                borderRadius: 16,
                boxShadow: '0 6px 20px -4px rgba(0, 0, 0, 0.05)',
                overflow: 'hidden',
              }}
            >
              {/* Tab Selector */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--slate-200)',
                  background: '#f8fafc',
                }}
              >
                <button
                  type="button"
                  onClick={() => setLoginMethod('qr')}
                  style={{
                    flex: 1,
                    padding: '14px 16px',
                    border: 'none',
                    background: loginMethod === 'qr' ? '#ffffff' : 'transparent',
                    borderBottom: loginMethod === 'qr' ? '2px solid var(--primary-color)' : 'none',
                    fontWeight: loginMethod === 'qr' ? 600 : 500,
                    color: loginMethod === 'qr' ? 'var(--primary-color)' : '#64748b',
                    cursor: 'pointer',
                    fontSize: 13.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <QrCode size={16} />
                  Scan QR Code
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMethod('pairing')}
                  style={{
                    flex: 1,
                    padding: '14px 16px',
                    border: 'none',
                    background: loginMethod === 'pairing' ? '#ffffff' : 'transparent',
                    borderBottom: loginMethod === 'pairing' ? '2px solid var(--primary-color)' : 'none',
                    fontWeight: loginMethod === 'pairing' ? 600 : 500,
                    color: loginMethod === 'pairing' ? 'var(--primary-color)' : '#64748b',
                    cursor: 'pointer',
                    fontSize: 13.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <PhoneCall size={16} />
                  Nomor HP (Pairing)
                </button>
              </div>

              {/* Tab Content: Scan QR Code */}
              {loginMethod === 'qr' && (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                      Scan QR Code dengan WhatsApp
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                      Buka WhatsApp di HP Anda &gt; <strong>Perangkat Tertaut</strong> &gt; arahkan kamera ke kode di bawah:
                    </p>
                  </div>

                  {/* QR Code Container */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '2px dashed #cbd5e1',
                      borderRadius: 16,
                      padding: 18,
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 280,
                      minHeight: 280,
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
                      margin: '8px 0 16px 0',
                    }}
                  >
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt="QR Code WhatsApp Bot"
                        style={{
                          width: 250,
                          height: 250,
                          borderRadius: 8,
                          display: 'block',
                        }}
                      />
                    ) : (
                      <div style={{ padding: '36px 16px', color: '#64748b' }}>
                        <RefreshCw size={32} className="spin" style={{ color: 'var(--primary-color)', marginBottom: 12 }} />
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Menyiapkan QR Code baru...</div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Mohon tunggu beberapa detik</div>
                      </div>
                    )}
                  </div>

                  {/* Countdown Timer Bar */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--slate-200)',
                      borderRadius: 12,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontSize: 12.5,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569' }}>
                      <Clock size={14} style={{ color: '#2563eb' }} />
                      <span>Refresh otomatis dalam:</span>
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: countdown <= 10 ? '#dc2626' : '#2563eb',
                        fontFamily: 'monospace',
                        fontSize: 14,
                      }}
                    >
                      {countdown} detik
                    </div>
                  </div>

                  {/* Refresh Button Manual */}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RefreshCw size={13} className={isRefreshingQR ? 'spin' : ''} />}
                    onClick={() => handleRefreshQR(true)}
                    disabled={isRefreshingQR}
                    style={{ width: '100%', color: 'var(--slate-600)' }}
                  >
                    {isRefreshingQR ? 'Sedang Memperbarui...' : 'Perbarui / Buat QR Baru Sekarang'}
                  </Button>
                </div>
              )}

              {/* Tab Content: Nomor HP (Pairing Code) */}
              {loginMethod === 'pairing' && (
                <div style={{ padding: 24 }}>
                  <div style={{ marginBottom: 18 }}>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                      Tautkan Tanpa Scan Kamera
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                      Masukkan nomor WhatsApp yang akan dijadikan bot, lalu masukkan kode 8-digit yang muncul di WhatsApp HP Anda.
                    </p>
                  </div>

                  <form onSubmit={handleRequestPairing}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Nomor WhatsApp Host:
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 081234567890 atau 6281234567890"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: '1px solid var(--slate-300)',
                          fontSize: 14,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                        Gunakan awalan 08 atau 62 (contoh: 081234567890)
                      </div>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      icon={<KeyRound size={14} />}
                      disabled={isRequestingCode}
                      style={{ width: '100%' }}
                    >
                      {isRequestingCode ? 'Meminta Kode ke WhatsApp...' : 'Dapatkan Kode Pairing'}
                    </Button>
                  </form>

                  {/* Display Kode Pairing Jika Didapatkan */}
                  {pairingCode && (
                    <div
                      style={{
                        marginTop: 20,
                        padding: 16,
                        background: '#f0fdf4',
                        border: '1px solid #86efac',
                        borderRadius: 12,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 12, color: '#166534', fontWeight: 600, marginBottom: 8 }}>
                        MASUKKAN KODE INI DI WHATSAPP HP ANDA:
                      </div>
                      <div
                        style={{
                          fontSize: 26,
                          fontWeight: 800,
                          letterSpacing: 4,
                          color: '#15803d',
                          fontFamily: 'monospace',
                          background: '#ffffff',
                          padding: '12px 16px',
                          borderRadius: 8,
                          border: '1px solid #bbf7d0',
                          marginBottom: 12,
                        }}
                      >
                        {pairingCode}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={copiedCode ? <Check size={13} /> : <Copy size={13} />}
                        onClick={handleCopyCode}
                        style={{ width: '100%' }}
                      >
                        {copiedCode ? 'Kode Berhasil Disalin!' : 'Salin Kode Pairing'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Kolom Kanan: Panduan Langkah Demi Langkah & Keamanan */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Petunjuk Langkah */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--slate-200)',
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
                }}
              >
                <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Smartphone size={18} style={{ color: '#2563eb' }} />
                  Panduan Menghubungkan WhatsApp
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: '#eff6ff',
                        color: '#2563eb',
                        fontWeight: 700,
                        fontSize: 12.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      1
                    </div>
                    <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.4 }}>
                      Buka aplikasi <strong>WhatsApp</strong> di smartphone Android atau iPhone Anda.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: '#eff6ff',
                        color: '#2563eb',
                        fontWeight: 700,
                        fontSize: 12.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      2
                    </div>
                    <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.4 }}>
                      Ketuk menu <strong>Titik Tiga (⋮)</strong> di kanan atas (Android) atau menu <strong>Pengaturan</strong> (iOS).
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: '#eff6ff',
                        color: '#2563eb',
                        fontWeight: 700,
                        fontSize: 12.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      3
                    </div>
                    <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.4 }}>
                      Pilih <strong>Perangkat Tertaut (Linked Devices)</strong>, lalu ketuk tombol <strong>Tautkan Perangkat</strong>.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: '#eff6ff',
                        color: '#2563eb',
                        fontWeight: 700,
                        fontSize: 12.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      4
                    </div>
                    <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.4 }}>
                      Arahkan kamera ke <strong>QR Code</strong> di layar ini. Dalam hitungan detik, bot akan langsung aktif dan terhubung!
                    </div>
                  </div>
                </div>
              </div>

              {/* Jaminan Privasi & Keamanan */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--slate-200)',
                  borderRadius: 14,
                  padding: 20,
                  fontSize: 13,
                  color: '#475569',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
                  <ShieldCheck size={16} style={{ color: '#10b981' }} />
                  Privasi & Keamanan Perangkat Host
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <li>Bot <strong>hanya membalas chat pribadi</strong> seputar pertanyaan data statistik resmi BPS.</li>
                  <li>Bot <strong>tidak pernah membaca atau membalas grup</strong> tempat nomor Anda berada.</li>
                  <li>Jika Anda ingin mengganti nomor host, cukup klik <strong>Logout</strong> dan scan dengan nomor baru.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Logout Host */}
      <Modal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Putuskan Sambungan WhatsApp Host?"
        variant="danger"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowLogoutModal(false)} disabled={isLoggingOut}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleConfirmLogout} disabled={isLoggingOut}>
              {isLoggingOut ? 'Memutuskan Sambungan...' : 'Ya, Putuskan & Buat QR Baru'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertCircle size={20} />
          </div>
          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: 13.5, color: '#334155', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin memutuskan sambungan nomor WhatsApp <strong>{formatPhone(effectivePhoneNumber)}</strong> dari bot SAPA BPS?
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: '#64748b', lineHeight: 1.4 }}>
              Setelah diputuskan, bot tidak akan lagi membalas pesan WhatsApp dari nomor ini sampai ada perangkat baru yang memindai QR code berikutnya.
            </p>
          </div>
        </div>
      </Modal>

      {/* Modal Diagnostik Status & Kesehatan Sistem */}
      <Modal
        open={showDiagnosticModal}
        onClose={() => setShowDiagnosticModal(false)}
        title="Diagnostik Status & Kesehatan Sistem"
        description="Pemeriksaan konektivitas real-time antara Frontend, Server Backend (Port 80), Socket WhatsApp, dan Tunnel Publik."
        maxWidth={620}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={copiedReport ? <Check size={14} /> : <Copy size={14} />}
              onClick={handleCopyReport}
            >
              {copiedReport ? 'Tersalin!' : 'Salin Laporan'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={isCheckingDiagnostics ? 'spin' : ''} />}
              onClick={() => handleRunDiagnostics(false)}
              disabled={isCheckingDiagnostics}
            >
              {isCheckingDiagnostics ? 'Menguji...' : 'Uji Ping Ulang'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowDiagnosticModal(false)}
            >
              Tutup
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card Hero Ringkasan Status */}
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: checkError
                ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                : botStatus.state === 'connected'
                ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: `1px solid ${
                checkError
                  ? '#fca5a5'
                  : botStatus.state === 'connected'
                  ? '#86efac'
                  : '#fde68a'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: checkError
                    ? '#dc2626'
                    : botStatus.state === 'connected'
                    ? '#16a34a'
                    : '#d97706',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  flexShrink: 0,
                }}
              >
                {checkError ? (
                  <AlertCircle size={24} />
                ) : botStatus.state === 'connected' ? (
                  <CheckCircle2 size={24} />
                ) : (
                  <Zap size={24} />
                )}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: checkError
                      ? '#b91c1c'
                      : botStatus.state === 'connected'
                      ? '#15803d'
                      : '#b45309',
                  }}
                >
                  {checkError
                    ? 'GANGGUAN KONEKSI'
                    : botStatus.state === 'connected'
                    ? 'SEMUA SISTEM NORMAL'
                    : 'MENUNGGU KONEKSI'}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#0f172a',
                    marginTop: 2,
                  }}
                >
                  {checkError
                    ? 'Backend Tidak Menjawab'
                    : botStatus.state === 'connected'
                    ? 'Bot WhatsApp & Server Siap'
                    : botStatus.state === 'qr_ready'
                    ? 'Perlu Pindai QR WhatsApp'
                    : 'Menyiapkan Socket WhatsApp...'}
                </div>
              </div>
            </div>

            {/* Latency Meter Pill */}
            {lastPing !== null && !checkError && (
              <div
                style={{
                  background: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: 20,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Activity
                  size={16}
                  style={{
                    color: lastPing < 60 ? '#16a34a' : lastPing < 200 ? '#d97706' : '#dc2626',
                  }}
                />
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>LATENCY</div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: lastPing < 60 ? '#16a34a' : lastPing < 200 ? '#d97706' : '#dc2626',
                    }}
                  >
                    {lastPing} ms{' '}
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#64748b' }}>
                      ({lastPing < 60 ? 'Optimal' : lastPing < 200 ? 'Sedang' : 'Lambat'})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Grid Komponen Sistem */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 10,
            }}
          >
            {/* 1. Server Express Backend */}
            <div
              style={{
                border: '1px solid var(--slate-200)',
                borderRadius: 10,
                padding: 12,
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  <Server size={15} style={{ color: '#2563eb' }} />
                  Server Backend Express
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: (healthData || botStatus.state) ? '#dcfce7' : '#fee2e2',
                    color: (healthData || botStatus.state) ? '#15803d' : '#b91c1c',
                  }}
                >
                  {(healthData || botStatus.state) ? 'PORT 80 AKTIF' : 'OFFLINE'}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div>Target: <strong style={{ wordBreak: 'break-all' }}>{getEffectiveBackendUrl()}</strong></div>
                <div>Uptime: <strong>{formatUptime(healthData?.uptime)}</strong></div>
              </div>
            </div>

            {/* 2. Socket Baileys WhatsApp */}
            <div
              style={{
                border: '1px solid var(--slate-200)',
                borderRadius: 10,
                padding: 12,
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  <Smartphone size={15} style={{ color: '#10b981' }} />
                  Socket Bot WhatsApp
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background:
                      botStatus.state === 'connected'
                        ? '#dcfce7'
                        : botStatus.state === 'qr_ready'
                        ? '#fef3c7'
                        : '#f1f5f9',
                    color:
                      botStatus.state === 'connected'
                        ? '#15803d'
                        : botStatus.state === 'qr_ready'
                        ? '#b45309'
                        : '#475569',
                  }}
                >
                  {botStatus.state === 'connected'
                    ? 'TERHUBUNG'
                    : botStatus.state === 'qr_ready'
                    ? 'SIAP QR'
                    : 'CONNECTING'}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div>Nomor: <strong>{formatPhone(botStatus.phoneNumber || healthData?.phoneNumber)}</strong></div>
                <div>Sesi: <strong>Signal Protocol (E2E Encrypted)</strong></div>
              </div>
            </div>

            {/* 3. Ngrok Public Tunnel */}
            <div
              style={{
                border: '1px solid var(--slate-200)',
                borderRadius: 10,
                padding: 12,
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  <Radio size={15} style={{ color: '#0284c7' }} />
                  Ngrok Public Tunnel
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: '#e0f2fe',
                    color: '#0369a1',
                  }}
                >
                  HTTPS TUNNEL
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  URL: <a href="https://footless-aptitude-caloric.ngrok-free.dev" target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'underline' }}>footless-aptitude-caloric.ngrok-free.dev</a>
                </div>
                <div>Target: <strong>Localhost Port 80</strong></div>
              </div>
            </div>

            {/* 4. AI & NLP Store */}
            <div
              style={{
                border: '1px solid var(--slate-200)',
                borderRadius: 10,
                padding: 12,
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  <Sparkles size={15} style={{ color: '#8b5cf6' }} />
                  Mesin NLP & Dataset BPS
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: '#f3e8ff',
                    color: '#7e22ce',
                  }}
                >
                  SIAP MELAYANI
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div>Dataset Aktif: <strong>{datasetCount !== null ? `${datasetCount} Dataset` : 'Tersinkronisasi'}</strong></div>
                <div>Model AI: <strong>Groq Compound Mini + Rule Matcher</strong></div>
              </div>
            </div>
          </div>

          {/* Footer Info / Petunjuk jika error */}
          {checkError ? (
            <div
              style={{
                padding: 12,
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: 8,
                fontSize: 12,
                color: '#9f1239',
                lineHeight: 1.4,
              }}
            >
              <strong>Langkah Perbaikan:</strong>
              <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                <li>Buka folder proyek SAPA BPS dan jalankan <code>START_SAPA_BPS.bat</code>.</li>
                <li>Pastikan port 80 tidak digunakan aplikasi web server lain (misal Apache/IIS).</li>
                <li>Setelah terminal server terbuka, klik tombol <strong>Uji Ping Ulang</strong> di bawah.</li>
              </ol>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11.5,
                color: '#64748b',
                paddingTop: 4,
              }}
            >
              <div>
                Terakhir dicek:{' '}
                <strong>
                  {lastCheckedAt
                    ? lastCheckedAt.toLocaleTimeString('id-ID')
                    : 'Baru saja'}{' '}
                  WIB
                </strong>
              </div>
              <a
                href="http://localhost:80/health"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--primary-color)',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Buka /health lokal <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>
      </Modal>

      {/* Toast Notifikasi */}
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
