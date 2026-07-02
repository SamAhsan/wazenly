import nodemailer, { Transporter } from "nodemailer";
import { prisma } from "@wazenly/db";

let transporter: Transporter | null = null;

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

export async function verifyConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
