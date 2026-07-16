"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Please enter your name"),
  company: z.string().optional(),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional(),
  subject: z.string().min(2, "Please add a subject"),
  message: z.string().min(10, "Tell us a bit more (min. 10 characters)"),
  hp_check: z.string().optional(), // honeypot, left blank by real users
});
type FormData = z.infer<typeof schema>;

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setStatus("loading");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
      const res = await fetch(`${apiUrl}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass mb-5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-gray-800">Thanks — your message has been sent. We'll get back to you shortly.</span>
          </motion.div>
        )}
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass mb-5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          >
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-gray-800">Something went wrong sending your message. Please try again in a moment.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* honeypot -- hidden from real users via CSS, bots fill every field blindly.
            Deliberately no aria-hidden here: combining aria-hidden with a still-
            focusable element (which browser autofill can target) makes Chrome
            block the interaction entirely -- it was silently breaking the whole
            form submission, not just the honeypot. */}
        <input
          {...register("hp_check")}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input {...register("name")} className="neu-input w-full px-4 py-3 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Your name" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
            <input {...register("company")} className="neu-input w-full px-4 py-3 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Company name" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
            <input {...register("email")} type="email" className="neu-input w-full px-4 py-3 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="you@company.com" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input {...register("phone")} className="neu-input w-full px-4 py-3 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="+1 234 567 8900" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject *</label>
          <input {...register("subject")} className="neu-input w-full px-4 py-3 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="How can we help?" />
          {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
          <textarea {...register("message")} rows={5} className="neu-input w-full px-4 py-3 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="Tell us about your business and what you're looking for..." />
          {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-8 py-3.5 rounded-xl disabled:opacity-70 transition-all hover:bg-primary-600 hover:shadow-lg hover:shadow-primary/25"
        >
          {status === "loading" ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
          ) : "Send Message"}
        </button>
      </form>
    </div>
  );
}
