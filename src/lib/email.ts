import "server-only";

import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { emailLog } from "@/lib/db/schema";
import { getSettings, DEFAULT_EMAIL_TEMPLATES } from "@/lib/settings";
import { formatDateTime, uid } from "@/lib/format";

export type EmailVars = Record<string, string | number | null | undefined>;

export function renderPlaceholders(template: string, vars: EmailVars): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? `{${key}}` : String(value);
  });
}

export function isSmtpConfigured(): boolean {
  return (getSettings().smtp_host || "").trim().length > 0;
}

export function emailTemplate(key: string): { subject: string; body: string } {
  const s = getSettings();
  const fallback = DEFAULT_EMAIL_TEMPLATES[key];
  const customBody = s[`email_template_${key}`];
  const customSubject = s[`email_subject_${key}`];
  return {
    subject: customSubject || fallback?.subject || `Pembaruan dari ${s.site_name}`,
    body: customBody || fallback?.body || `Halo {nama},\n\nAda pembaruan untuk akun kamu.\n\n{link}\n\n{brand}`,
  };
}

type EmailInfoRow = { label: string; value: string };

function safeHref(url: string): string | null {
  const value = url.trim();
  if (!value || value.includes("{")) return null;
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
  if (value.startsWith("/")) {
    const base = process.env.APP_URL ?? "http://localhost:3000";
    return `${base.replace(/\/$/, "")}${value}`;
  }
  return null;
}

function inlineEmailText(text: string): string {
  const tokens: string[] = [];
  let working = text.replace(/\*\*([^*]+)\*\*/g, (_match, content: string) => {
    const token = `@@B${tokens.length}@@`;
    tokens.push(`<strong style="color:#101613;font-weight:700">${escapeHtml(content)}</strong>`);
    return token;
  });

  working = working.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) => {
    const href = safeHref(url);
    if (!href) return label;
    const token = `@@L${tokens.length}@@`;
    tokens.push(
      `<a href="${escapeHtml(href)}" style="color:#0B3D2E;font-weight:600;text-decoration:underline">${escapeHtml(label)}</a>`,
    );
    return token;
  });

  return escapeHtml(working).replace(/@@([BL])(\d+)@@/g, (_match, _type: string, index: string) => {
    return tokens[Number(index)] ?? "";
  });
}

function parseEmailCta(line: string): { label: string; url: string } | null {
  const markdown = line.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (markdown) return { label: markdown[1], url: markdown[2] };

  const labelled = line.match(/^([A-Za-z][A-Za-z0-9 /&().-]{1,38}):\s*(https?:\/\/\S+)$/);
  if (labelled) return { label: labelled[1].trim(), url: labelled[2].trim() };

  const raw = line.match(/^(https?:\/\/\S+)$/);
  if (raw) return { label: "Buka tautan", url: raw[1] };

  return null;
}

function parseEmailInfoRow(line: string): EmailInfoRow | null {
  const match = line.match(/^([A-Za-z][A-Za-z0-9 /&().-]{1,38}):\s+(.+)$/);
  if (!match) return null;
  const value = match[2].trim();
  if (/^(https?:\/\/|\/)/.test(value)) return null;
  return { label: match[1].trim(), value };
}

function renderEmailCta(label: string, url: string): string {
  const href = safeHref(url);
  if (!href) {
    return `<p style="margin:0 0 14px;font-size:14px;line-height:1.75;color:#405047">${inlineEmailText(label)}: ${inlineEmailText(url)}</p>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px">
    <tr>
      <td style="border-radius:12px;background:#0B3D2E">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 24px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1.2;color:#FFFFFF;text-decoration:none;border-radius:12px">${inlineEmailText(label)} &nbsp;→</a>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 18px;font-size:11px;line-height:1.6;color:#8A9A90">
    Jika tombol tidak berfungsi, salin tautan berikut:<br/>
    <a href="${escapeHtml(href)}" style="color:#0B3D2E;text-decoration:underline;word-break:break-all">${escapeHtml(href)}</a>
  </p>`;
}

function renderEmailInfo(rows: EmailInfoRow[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;background:#F3F8F5;border:1px solid #DDEBE2;border-radius:14px">
    <tr><td style="padding:6px 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows
          .map(
            (row, index) => `<tr><td style="padding:11px 0;${index < rows.length - 1 ? "border-bottom:1px solid #E3EDE7;" : ""}">
              <div style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#8A9A90">${inlineEmailText(row.label)}</div>
              <div style="margin-top:4px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1.55;color:#101613;word-break:break-word">${inlineEmailText(row.value)}</div>
            </td></tr>`,
          )
          .join("")}
      </table>
    </td></tr>
  </table>`;
}

function renderEmailNote(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px">
    <tr><td style="padding:13px 16px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#92400E">${inlineEmailText(text)}</td></tr>
  </table>`;
}

function renderEmailBody(body: string, siteName: string): string {
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let info: EmailInfoRow[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      `<p style="margin:0 0 14px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:1.75;color:#405047">${paragraph
        .map(inlineEmailText)
        .join(" ")}</p>`,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      `<ul style="margin:0 0 18px;padding-left:20px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:1.8;color:#405047">${list
        .map((item) => `<li style="margin:0 0 5px">${inlineEmailText(item)}</li>`)
        .join("")}</ul>`,
    );
    list = [];
  };

  const flushInfo = () => {
    if (!info.length) return;
    blocks.push(renderEmailInfo(info));
    info = [];
  };

  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      flushInfo();
      continue;
    }
    if (line === siteName) continue;

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      flushInfo();
      blocks.push(
        `<h2 style="margin:26px 0 10px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;line-height:1.35;color:#101613">${inlineEmailText(line.slice(3))}</h2>`,
      );
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("• ")) {
      flushParagraph();
      flushInfo();
      list.push(line.slice(2).trim());
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      flushInfo();
      blocks.push(renderEmailNote(line.slice(2).trim()));
      continue;
    }

    const cta = parseEmailCta(line);
    if (cta) {
      flushParagraph();
      flushList();
      flushInfo();
      blocks.push(renderEmailCta(cta.label, cta.url));
      continue;
    }

    const row = parseEmailInfoRow(line);
    if (row) {
      flushParagraph();
      flushList();
      info.push(row);
      continue;
    }

    flushList();
    flushInfo();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushInfo();
  return blocks.join("\n");
}

function brandHtml(
  body: string,
  siteName: string,
  tagline: string,
  supportEmail: string,
  subject: string,
): string {
  const safeName = escapeHtml(siteName);
  const safeTagline = escapeHtml(tagline || "Cloud VPS & infrastruktur andal");
  const safeSupport = escapeHtml(supportEmail || "support");
  const content = renderEmailBody(body, siteName);
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F7F5;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#101613">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(subject)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F7F5">
    <tr><td align="center" style="padding:32px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E3E8E4;border-radius:22px;overflow:hidden">
        <tr><td style="height:5px;background:#16A34A;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr>
          <td style="background:#0B3D2E;background-image:linear-gradient(135deg,#0B3D2E 0%,#145A43 100%);padding:26px 30px 22px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:21px;font-weight:800;letter-spacing:-.4px;color:#FFFFFF">${safeName}</td>
                <td align="right" style="font-family:'Segoe UI',Arial,Helvetica,sans-serif">
                  <span style="display:inline-block;border:1px solid #4F7A65;border-radius:999px;padding:5px 10px;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#DDF3E5">Notifikasi Resmi</span>
                </td>
              </tr>
              <tr><td colspan="2" style="padding-top:6px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#BFE3CC">${safeTagline}</td></tr>
            </table>
          </td>
        </tr>
        <tr><td style="padding:30px 30px 24px;background:#FFFFFF">${content}</td></tr>
        <tr>
          <td style="padding:20px 30px 24px;background:#F7FAF8;border-top:1px solid #E3E8E4">
            <p style="margin:0 0 7px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#5B6B60">
              Butuh bantuan? Balas email ini atau hubungi <a href="mailto:${safeSupport}" style="color:#0B3D2E;font-weight:600;text-decoration:underline">${safeSupport}</a>.
            </p>
            <p style="margin:0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#8A9A90">
              Email ini dikirim otomatis oleh ${safeName}. Jangan bagikan data akses atau kode verifikasi kepada siapa pun.
            </p>
            <p style="margin:10px 0 0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#A3B0A7">© ${new Date().getFullYear()} ${safeName}. Hak cipta dilindungi.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
  templateKey?: string;
  vars?: EmailVars;
}): Promise<{ ok: boolean; logged: boolean; error?: string }> {
  const s = getSettings();
  const text = renderPlaceholders(input.body, {
    brand: s.site_name,
    year: String(new Date().getFullYear()),
    ...input.vars,
  });
  const subject = renderPlaceholders(input.subject, {
    brand: s.site_name,
    ...input.vars,
  });
  const host = (s.smtp_host || "").trim();
  const user = (s.smtp_user || "").trim();
  const pass = s.smtp_pass || "";
  const from =
    s.email_from?.trim() ||
    (user ? `${s.site_name} <${user}>` : `${s.site_name} <noreply@pansavps.id>`);

  try {
    if (!host) {
      db.insert(emailLog)
        .values({
          id: uid("eml_", 16),
          toEmail: input.to,
          subject,
          templateKey: input.templateKey ?? null,
          status: "logged",
        })
        .run();
      // Fallback tanpa SMTP: tampilkan di log server, bukan kredensial.
      console.info(`[email:logged] ${subject} -> ${maskEmail(input.to)}`);
      return { ok: true, logged: true };
    }

    const parsedPort = Number(s.smtp_port);
    const port =
      Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort <= 65535
        ? parsedPort
        : 587;
    const secure = s.smtp_secure === "true";

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    try {
      await transporter.sendMail({
        from,
        to: input.to,
        subject,
        html: brandHtml(text, s.site_name, s.site_tagline, s.support_email, subject),
        text,
      });
    } finally {
      transporter.close();
    }

    db.insert(emailLog)
      .values({
        id: uid("eml_", 16),
        toEmail: input.to,
        subject,
        templateKey: input.templateKey ?? null,
        status: "sent",
      })
      .run();
    return { ok: true, logged: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    db.insert(emailLog)
      .values({
        id: uid("eml_", 16),
        toEmail: input.to,
        subject,
        templateKey: input.templateKey ?? null,
        status: "failed",
        error: message.slice(0, 300),
      })
      .run();
    return {
      ok: false,
      logged: false,
      error: `Gagal mengirim email: ${message.slice(0, 180)}`,
    };
  }
}

export async function sendTemplatedEmail(
  to: string,
  key: string,
  vars: EmailVars,
): Promise<{ ok: boolean; logged: boolean; error?: string }> {
  const template = emailTemplate(key);
  return sendEmail({
    to,
    subject: template.subject,
    body: template.body,
    templateKey: key,
    vars,
  });
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}

export function getTestEmailBody(siteName: string): string {
  return `Halo,

Ini email uji dari ${siteName}. Konfigurasi SMTP dan alamat pengirim sudah bekerja.

Waktu pengujian: ${formatDateTime(new Date())}.`;
}
