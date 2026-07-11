import nodemailer, { Transporter } from "nodemailer";
import { prisma } from "@wazenly/db";

let transporter: Transporter | null = null;
let contactTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

// The contact form sends from a dedicated info@ mailbox once CONTACT_SMTP_* is
// configured; until then it falls back to the same transporter/identity used
// for account emails, so the feature works end-to-end from day one.
function getContactTransporter(): Transporter {
  if (!process.env.CONTACT_SMTP_HOST) return getTransporter();
  if (!contactTransporter) {
    contactTransporter = nodemailer.createTransport({
      host: process.env.CONTACT_SMTP_HOST,
      port: Number(process.env.CONTACT_SMTP_PORT) || 587,
      auth: { user: process.env.CONTACT_SMTP_USER, pass: process.env.CONTACT_SMTP_PASS },
    });
  }
  return contactTransporter;
}

export async function sendMail(options: { to: string; subject: string; html: string }): Promise<void> {
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    await prisma.emailLog.create({ data: { to: options.to, subject: options.subject, status: "sent" } }).catch(() => {});
  } catch (err) {
    await prisma.emailLog
      .create({ data: { to: options.to, subject: options.subject, status: "failed", error: (err as Error).message } })
      .catch(() => {});
    throw err;
  }
}

export async function sendContactMail(options: { to: string; subject: string; html: string; replyTo?: string }): Promise<void> {
  const from = process.env.CONTACT_SMTP_FROM || process.env.CONTACT_SMTP_USER || process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    await getContactTransporter().sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
    });
    await prisma.emailLog.create({ data: { to: options.to, subject: options.subject, status: "sent" } }).catch(() => {});
  } catch (err) {
    await prisma.emailLog
      .create({ data: { to: options.to, subject: options.subject, status: "failed", error: (err as Error).message } })
      .catch(() => {});
    throw err;
  }
}

export async function verifyConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
