import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock,
  Cloud,
  Cpu,
  Database,
  Globe2,
  KeyRound,
  Layers,
  Lock,
  MessageCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/shared/reveal";

export const metadata: Metadata = {
  title: "Fitur",
  description: "Fitur lengkap VPS: aktivasi otomatis, panel kontrol, snapshot, SSH key, saldo, dan notifikasi WhatsApp.",
};

const groups = [
  {
    title: "Provisioning & infrastruktur",
    items: [
      { icon: Zap, title: "Aktivasi otomatis", body: "Pembayaran terkonfirmasi langsung memicu pembuatan droplet. Tanpa menunggu jam kerja." },
      { icon: Cloud, title: "Infrastruktur cloud", body: "Server di region pilihan dengan monitoring dan tag per layanan untuk sinkronisasi." },
      { icon: Globe2, title: "Multi-region", body: "Singapore, New York, dan Frankfurt. Pilih region terdekat dengan penggunamu." },
      { icon: Database, title: "Snapshot", body: "Buat dan hapus snapshot kapan saja dari panel, sebelum perubahan besar." },
    ],
  },
  {
    title: "Kontrol & keamanan",
    items: [
      { icon: Terminal, title: "Aksi server", body: "Power on/off, reboot, power cycle, rebuild OS, dan rename langsung dari dashboard." },
      { icon: KeyRound, title: "SSH key & password", body: "Gunakan password acak atau SSH key sendiri. Kredensial disimpan terenkripsi AES-256-GCM." },
      { icon: Lock, title: "Audit trail", body: "Setiap aksi user dan admin dicatat lengkap dengan IP dan waktu." },
      { icon: ShieldCheck, title: "Role guard", body: "Halaman admin dilindungi pemeriksaan sesi dan role di server, bukan hanya UI." },
    ],
  },
  {
    title: "Billing & operasional",
    items: [
      { icon: Wallet, title: "Saldo akun", body: "Top up saldo untuk pembayaran instan dan perpanjangan otomatis." },
      { icon: RefreshCw, title: "Perpanjangan otomatis", body: "Aktifkan auto-renew agar layanan tidak terputus saat masa aktif habis." },
      { icon: Layers, title: "Upgrade prorata", body: "Naik paket tanpa kehilangan data, biaya dihitung berdasarkan sisa masa aktif." },
      { icon: Clock, title: "Pengingat jatuh tempo", body: "Notifikasi email dan WhatsApp dikirim sebelum masa aktif berakhir." },
    ],
  },
  {
    title: "Dukungan & notifikasi",
    items: [
      { icon: MessageCircle, title: "Tiket support", body: "Buka tiket dari dashboard dan pantau balasan tim support." },
      { icon: Server, title: "Status real-time", body: "Pantau progres provisioning dan status server tanpa refresh manual." },
      { icon: Cpu, title: "Monitoring spesifikasi", body: "Lihat vCPU, RAM, storage, dan transfer sesuai paket aktif." },
      { icon: Check, title: "Notifikasi lengkap", body: "Email dan WhatsApp untuk pembayaran, aktivasi, dan perubahan layanan." },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="border-b border-[#E3E8E4] bg-[#0B3D2E] text-white">
        <div className="ws-container py-16 md:py-24">
          <Badge className="border border-white/15 bg-white/5 text-white/80 hover:bg-white/5">Fitur</Badge>
          <h1 className="mt-5 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Dibangun untuk operasional nyata, bukan sekadar demo.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70">
            Semua fitur dirancang agar kamu bisa fokus ke aplikasi, bukan mengurus server. Kontrol tetap di
            tanganmu, dengan pengamanan berlapis.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="bg-white text-[#0B3D2E] hover:bg-[#E7F4EC]">
              <Link href="/pricing">
                Lihat paket <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link href="/register">Daftar gratis</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="ws-container space-y-16">
          {groups.map((group, groupIndex) => (
            <div key={group.title}>
              <Reveal>
                <h2 className="font-display text-2xl font-bold tracking-tight text-[#101613]">{group.title}</h2>
              </Reveal>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {group.items.map((item, index) => (
                  <Reveal key={item.title} delay={(groupIndex * 4 + index) * 0.03}>
                    <div className="card-lift h-full rounded-2xl border border-[#E3E8E4] bg-white p-5">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-[#E7F4EC] text-[#0B3D2E]">
                        <item.icon className="size-5" />
                      </span>
                      <h3 className="mt-4 text-sm font-bold text-[#101613]">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-[#5B6B60]">{item.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[#E3E8E4] bg-[#F7F8F7]">
        <div className="ws-container flex flex-col items-start justify-between gap-5 py-12 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#101613]">Siap mencoba?</h2>
            <p className="mt-1.5 text-sm text-[#5B6B60]">Buat akun dan deploy VPS pertamamu hari ini.</p>
          </div>
          <Button asChild size="lg" className="bg-[#0B3D2E] text-white hover:bg-[#0E4D38]">
            <Link href="/register">
              Mulai sekarang <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
