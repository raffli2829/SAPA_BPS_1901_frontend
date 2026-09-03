import type { NextConfig } from "next";
import os from "os";

// Ambil semua IPv4 lokal aktif di komputer (Wi-Fi, Ethernet, Hotspot, Tailscale)
const localIps = Object.values(os.networkInterfaces())
  .flat()
  .filter((iface): iface is os.NetworkInterfaceInfo => Boolean(iface && iface.family === 'IPv4' && !iface.internal))
  .map((iface) => iface.address);

const BACKEND_URL = (
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://127.0.0.1:80'
).replace(/\/$/, '');

const nextConfig: NextConfig = {
  // Izinkan akses dari IP lokal jaringan Wi-Fi/Ethernet dan domain ngrok agar tidak diblokir cross-origin oleh Next.js
  allowedDevOrigins: [
    'localhost',
    'localhost:3000',
    '127.0.0.1',
    '127.0.0.1:3000',
    'footless-aptitude-caloric.ngrok-free.dev',
    '*.ngrok-free.dev',
    '*.ngrok.app',
    '*.ngrok.io',
    '192.168.1.41',
    '192.168.1.41:3000',
    '192.168.1.100',
    '192.168.1.100:3000',
    ...localIps,
    ...localIps.map((ip) => `${ip}:3000`),
  ],
  async rewrites() {
    return [
      {
        source: '/health',
        destination: `${BACKEND_URL}/health`,
      },
      {
        source: '/api/backend/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: '/api/chat',
        destination: `${BACKEND_URL}/api/chat`,
      },
      {
        source: '/api/bot/:path*',
        destination: `${BACKEND_URL}/api/bot/:path*`,
      },
      {
        source: '/api/faqs/:path*',
        destination: `${BACKEND_URL}/api/faqs/:path*`,
      },
      {
        source: '/api/faqs',
        destination: `${BACKEND_URL}/api/faqs`,
      },
    ];
  },
};

export default nextConfig;
