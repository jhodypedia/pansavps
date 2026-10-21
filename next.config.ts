import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aplikasi toko ini selalu dirender dinamis dari SQLite, jadi Cache Components
  // tidak diaktifkan. Semua halaman membaca data terbaru dari database.
  cacheComponents: false,
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
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
