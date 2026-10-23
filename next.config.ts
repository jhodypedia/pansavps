import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aplikasi toko ini selalu dirender dinamis dari SQLite, jadi Cache Components
  // tidak diaktifkan. Semua halaman membaca data terbaru dari database.
  cacheComponents: false,
  poweredByHeader: false,
  // Kompresi ditangani Nginx agar CPU Node tidak dipakai untuk gzip.
  compress: false,
  experimental: {
    serverActions: {
      // Bukti transfer maksimal 5 MB + overhead multipart.
      bodySizeLimit: "6mb",
    },
  },
  serverExternalPackages: [
    "better-sqlite3",
    "@whiskeysockets/baileys",
    "pino",
    "qrcode",
    "nodemailer",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=15552000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
