# Keputusan Arsitektur

Dokumen ini mencatat keputusan teknis penting, alasan, dan konsekuensinya. Tujuannya agar perubahan berikutnya tidak membatalkan asumsi yang sudah dipilih.

---

## 1. Next.js 16 App Router + React Server Components

**Keputusan:** Seluruh halaman memakai App Router, server component untuk baca data, server action untuk mutasi.

**Alasan:** Mengurangi lapisan API untuk operasi internal, otorisasi dekat dengan data, dan bundle klien lebih kecil. Halaman toko yang selalu dinamis tidak cocok dengan cache statis.

**Konsekuensi:** `cacheComponents` dan partial prefetching dimatikan (`next.config.ts`). Semua query membaca SQLite terbaru. Route API tetap dibuat untuk webhook, PDF, polling status, dan cron karena dipanggil pihak eksternal.

---

## 2. SQLite + Drizzle ORM

**Keputusan:** Satu file SQLite (`data/app.db`) dengan `better-sqlite3` dan Drizzle ORM (mode sinkron).

**Alasan:** Deployment satu server sederhana, tanpa layanan database tambahan, transaksi lokal cepat, dan tipe schema diturunkan langsung ke TypeScript. Beban toko VPS kecil–menengah masih jauh di bawah kapasitas SQLite.

**Konsekuensi:** Operasi tulis diserialisasi; tidak cocok untuk multi-node tanpa migrasi ke Postgres. Backup = salin file DB (gunakan `VACUUM INTO`/backup SQLite untuk konsistensi). `db/core.ts` dipisahkan dari `db/index.ts` agar worker dan script tidak terkena `server-only`.

---

## 3. Harga dan brand sepenuhnya dari database

**Keputusan:** Tidak ada harga, nama brand, kontak, atau teks pengumuman yang di-hardcode di komponen. Semua berasal dari `plans`, `regions`, `os_images`, `promo_codes`, dan `settings`.

**Alasan:** Admin harus bisa mengubah katalog dan identitas toko tanpa deploy. Ini juga mencegah harga tampilan berbeda dari harga transaksi.

**Konsekuensi:** Setiap halaman publik melakukan query settings. Harga pesanan disimpan sebagai **snapshot** (`price_snapshot`) agar perubahan katalog tidak mengubah invoice yang sudah terbit. Perubahan harga paket dicatat di `plan_price_history`.

---

## 4. Palet gelap-hijau, tanpa gradien

**Keputusan:** Warna utama `#0B3D2E`, `#0E4D38`, `#06231A`, latar putih/off-white. Tidak ada CSS gradient, termasuk pada hero, tombol, kartu, atau chart.

**Alasan:** Identitas visual konsisten dan tegas; gradien mudah terlihat generik dan sulit dijaga kontrasnya.

**Konsekuensi:** Kedalaman visual dibuat lewat border, bayangan halus, tipografi, dan blok warna solid. Ikon hanya dari `lucide-react`.

---

## 5. Split database core vs server-only

**Keputusan:** `src/lib/db/core.ts` membuat koneksi dan schema; `src/lib/db/index.ts` menambahkan guard `server-only`. Script (`cron`, `smoke`, worker) mengimpor `core`.

**Alasan:** `server-only` sengaja melempar error di luar konteks React Server Component. Worker Baileys dan CLI bukan konteks Next.js.

**Konsekuensi:** Script `tsx` yang tetap mengimpor modul `server-only` (mis. service provisioning) harus dijalankan dengan `--conditions=react-server`. Ini sudah diterapkan pada `cron:run` dan didokumentasikan untuk smoke test.

---

## 6. Autentikasi sesi database, bukan JWT

**Keputusan:** Token sesi acak 32 byte, disimpan sebagai hash SHA-256 di tabel `sessions`; cookie `HttpOnly`, `SameSite=Lax`, `Secure` di produksi.

**Alasan:** Sesi bisa dicabut seketika (logout semua perangkat, suspend user, force logout admin) tanpa menunggu JWT kedaluwarsa.

**Konsekuensi:** Setiap request terautentikasi melakukan satu query sesi + user. Untuk skala besar, tambahkan cache atau pindah ke token pendek + refresh.

---

## 7. Proxy hanya pemeriksaan awal, otorisasi di server

**Keputusan:** `src/proxy.ts` hanya memeriksa keberadaan cookie dan mengarahkan ke login. Pemeriksaan sesi, status user, dan role dilakukan di layout/action (`requireUser`, `requireAdmin`).

**Alasan:** Proxy berjalan di edge/runtime terbatas dan tidak selalu bisa mengakses database. Menaruh otorisasi sebenarnya di sana akan rapuh.

**Konsekuensi:** Setiap halaman/aksi wajib memanggil guard yang sesuai. `assertOwner` dipakai untuk resource milik pengguna.

---

## 8. Server actions mengembalikan `ActionResult`

**Keputusan:** Mutasi mengembalikan `{ ok, message, fieldErrors?, redirectTo? }`; form memakai `useActionState`. Navigasi dilakukan di klien setelah sukses, kecuali logout yang langsung redirect.

**Alasan:** Pesan error bisa ditampilkan dekat form tanpa melempar exception ke error boundary. Validasi Zod dapat dipetakan ke field.

**Konsekuensi:** Tidak memakai `redirect()` di dalam action untuk alur form (kecuali logout), sehingga state form tetap terkontrol. Setiap action memanggil `revalidatePath` yang relevan.

---

## 9. Mock DigitalOcean sebagai default

**Keputusan:** `do_mock_mode` default `true`; tanpa token DO, sistem otomatis memakai mock. Job provisioning mock menghasilkan IP `203.0.113.x` dan password acak.

**Alasan:** Proyek harus bisa dijalankan dan diuji tanpa biaya/kredensial cloud. Alur pesanan, pembayaran, provisioning, dan notifikasi tetap identik dengan mode nyata.

**Konsekuensi:** Provisioning memakai tabel `jobs` dengan langkah bertahap (bukan `setTimeout` di memori), sehingga tahan restart dan bisa dijalankan cron. ID droplet mock disimpan agar UI tetap menampilkan detail.

---

## 10. Antrean job + cron untuk pekerjaan latar

**Keputusan:** Provisioning, pengingat, renew, suspend, terminasi, dan pengiriman WhatsApp dijalankan oleh `runCron` (CLI atau `/api/cron`), bukan background thread di proses Next.js.

**Alasan:** Proses Next.js bisa restart kapan saja; pekerjaan persisten harus disimpan di DB. Memisahkan worker memudahkan observasi dan scaling.

**Konsekuensi:** Harus ada scheduler eksternal setiap menit. Setiap tugas mencatat hasil ke `cron_logs`; kegagalan satu tugas tidak menghentikan tugas lain.

---

## 11. Provisioning idempoten berbasis langkah

**Keputusan:** Job `provision_service` memiliki `step` dan `notBefore`. Langkah 0 membuat droplet, langkah 1 mengaktifkan layanan dan mengirim kredensial. Job yang sudah `done` tidak dijalankan ulang.

**Alasan:** Cron bisa berjalan bersamaan/berulang; droplet tidak boleh tercipta dua kali dan email kredensial tidak boleh terkirim berulang.

**Konsekuensi:** Retry manual memakai `retryProvisioning` yang mereset job dengan aman. Password root hanya dapat didekripsi selama layanan ada; ditampilkan lewat aksi terautentikasi dan dicatat di audit.

---

## 12. Snapshot harga dan promo saat checkout

**Keputusan:** `orders.price_snapshot` menyimpan harga satuan, diskon, setup fee, dan total. Promo dihitung pada subtotal (sebelum setup fee), dengan batas maksimum dan minimum.

**Alasan:** Invoice historis harus tetap dapat diaudit meski paket/promo berubah. Perhitungan promo di server mencegah manipulasi harga dari klien.

**Konsekuensi:** `validatePromoPreview` dan `createOrder` memakai logika yang sama; preview hanya untuk tampilan. Promo tidak dapat dipakai jika kuota habis, kedaluwarsa, atau di bawah minimum.

---

## 13. Idempotensi pembayaran

**Keputusan:** `settleInvoice` memeriksa status invoice dan `payments.provider_ref`; webhook memverifikasi signature dan nominal sebelum memanggil settlement. Callback berulang mengembalikan `alreadyPaid`.

**Alasan:** Gateway dapat mengirim callback berkali-kali. Provisioning dan notifikasi tidak boleh terduplikasi.

**Konsekuensi:** Provider ref harus unik per transaksi. Pembayaran manual diverifikasi admin dan memakai `settleInvoice` yang sama, sehingga semua jalur berbagi invariant.

---

## 14. Rahasia terenkripsi AES-256-GCM

**Keputusan:** Token DO, API key Tripay, password SMTP, dan secret Turnstile disimpan terenkripsi dengan `APP_ENCRYPTION_KEY` (32 byte hex). UI admin tidak pernah menerima nilai asli; hanya `masked`/flag `secrets`.

**Alasan:** Backup database atau akses baca SQL langsung tidak langsung membocorkan kredensial pihak ketiga.

**Konsekuensi:** Kehilangan kunci berarti kehilangan rahasia. Rotasi kunci memerlukan dekripsi dengan kunci lama lalu enkripsi ulang. Nilai kosong tidak dienkripsi; pembacaan gagal mengembalikan string kosong agar aplikasi tetap hidup.

---

## 15. Pembayaran manual sebagai jalur default

**Keputusan:** `manual_enabled=true` dan gateway nonaktif secara default. Manual memakai transfer bank + unggah bukti; bukti disajikan lewat `/api/payments/[id]/proof` dengan otorisasi.

**Alasan:** Toko harus bisa menerima pembayaran tanpa onboarding gateway. Bukti transfer adalah data sensitif, jadi tidak boleh berada di `public/`.

**Konsekuensi:** Admin perlu memverifikasi pembayaran. File disimpan di direktori runtime (`data/`) dan divalidasi tipe/ukurannya.

---

## 16. WhatsApp via worker Baileys terpisah

**Keputusan:** Baileys berjalan di proses Node terpisah (`workers/wa-bot.ts`) dengan HTTP internal dan autentikasi `INTERNAL_SECRET`. Aplikasi hanya menulis ke `wa_outbox`.

**Alasan:** Baileys adalah proses long-running dengan state soket; menjalankannya di dalam Next.js akan rapuh saat hot reload/restart. Outbox DB memberi retry dan audit.

**Konsekuensi:** Worker harus dijalankan sebagai service terpisah dan folder `data/wa-auth` persisten. Pairing/QR hanya diekspos ke admin. Pesan macet (>5 menit) dikembalikan ke antrean oleh cron.

---

## 17. Tema dan komponen

**Keputusan:** Tailwind v4 via `@tailwindcss/turbopack`, shadcn/ui gaya `new-york`, komponen dasar Radix, ikon Lucide, animasi `motion`, chart Recharts.

**Alasan:** Konsistensi visual, aksesibilitas bawaan, dan kustomisasi mudah. Tailwind v4 menghilangkan konfigurasi JS dan mempercepat build.

**Konsekuensi:** Warna brand didefinisikan sebagai token di `globals.css`; jangan menambah utility gradien. `DataTable` memakai TanStack Table v8 (v9 belum stabil untuk API yang dipakai).

---

## 18. Validasi ganda dan pesan Bahasa Indonesia

**Keputusan:** Zod memvalidasi di klien (RHF) dan server (actions). Semua pesan pengguna, label status, dan format uang memakai Bahasa Indonesia; IDR diformat dengan `Intl.NumberFormat`.

**Alasan:** Validasi klien saja tidak cukup; pesan server harus bisa langsung ditampilkan.

**Konsekuensi:** Schema berada di `lib/validators.ts` dan dipakai kedua sisi. Format tanggal memakai locale `id-ID`.

---

## 19. Lint dan type safety

**Keputusan:** TypeScript `strict`, ESLint flat config Next 16, React Compiler aktif. Peringatan `react-hooks/incompatible-library` untuk TanStack Table dinonaktifkan per baris dengan alasan.

**Alasan:** Build harus bersih dari error; peringatan yang tidak dapat dihindari didokumentasikan daripada mematikan aturan global.

**Konsekuensi:** `npm run typecheck` dan `npm run build` harus lulus sebelum deploy. Impor yang tidak terpakai dihapus agar sinyal review tetap tinggi.

---

## 20. Refund otomatis saat provisioning gagal

**Keputusan:** Job provisioning yang gagal final (3 percobaan) atau ditolak permanen oleh DigitalOcean — termasuk pesan `exceed your droplet limit` — otomatis mengkredit saldo pengguna sebesar total pesanan. Refund menandai invoice `refunded`, order `cancelled`, dan layanan `terminated`. Tugas cron `refund_failed_provisioning` menjadi backfill idempoten untuk job gagal yang belum direfund.

**Alasan:** Pengguna tidak boleh menanggung pembayaran untuk server yang tidak pernah aktif, terutama saat penyedia cloud menolak karena batas akun. Refund ke saldo juga memberi jalur pemulihan tanpa menunggu proses gateway.

**Konsekuensi:** Refund hanya diproses jika invoice sudah `paid`, dan idempotensi dijaga lewat baris `balance_transactions` bertipe `refund` dengan `ref = order.id`. Order yang sudah direfund tidak dapat di-retry; pengguna harus membuat pesanan baru. `failJob` mengirim notifikasi `provisioning_failed` dengan info nominal refund.
