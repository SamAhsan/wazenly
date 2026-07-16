import { Router } from "express";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { contactRateLimiter } from "../middleware/rate-limiter";
import { sendContactMail } from "../services/mailer.service";
import { contactNotificationEmail } from "../services/email-templates";

export const contactRouter = Router();

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(10).max(5000),
  // Honeypot -- a real visitor never sees or fills this field (hidden via CSS on
  // the form); bots that blindly fill every input trip this and get silently
  // dropped without revealing that a check happened. Deliberately unconstrained
  // here (no .max(0)) so a filled-in value doesn't fail validation before the
  // honeypot check below ever runs -- it just needs to be truthy or not.
  hp_check: z.string().optional(),
});

// POST /api/contact — public, no auth (called from the logged-out marketing site)
contactRouter.post("/", contactRateLimiter, async (req, res, next) => {
  try {
    const body = contactSchema.parse(req.body);

    if (body.hp_check) {
      // Honeypot tripped -- respond as if it succeeded so the bot doesn't learn anything.
      return res.status(200).json({ success: true });
    }

    const submission = await prisma.contactSubmission.create({
      data: {
        name: body.name,
        company: body.company || null,
        email: body.email,
        phone: body.phone || null,
        subject: body.subject,
        message: body.message,
        ipAddress: req.ip,
      },
    });

    const notifyTo = process.env.CONTACT_NOTIFY_EMAIL || "info@wazenlyapp.com";
    sendContactMail({
      to: notifyTo,
      subject: `[Wazenly Contact] ${body.subject}`,
      html: contactNotificationEmail(body),
      replyTo: body.email,
    }).catch((err) => console.error("[Contact] Failed to send notification email:", err.message));

    res.status(201).json({ success: true, id: submission.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Please check the form fields and try again.", details: err.errors });
    }
    next(err);
  }
});
