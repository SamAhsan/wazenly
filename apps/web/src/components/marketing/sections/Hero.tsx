"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";
import { ChatPreview } from "../ChatPreview";
import { DashboardMockup } from "../DashboardMockup";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0f1117] pt-16 pb-28 sm:pt-24 sm:pb-36">
      {/* subtle abstract background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[36rem] h-[36rem] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute top-20 right-0 w-[28rem] h-[28rem] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 glass-dark rounded-full px-4 py-1.5 mb-6"
            >
              <MessageCircle className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-white/80">Official Meta WhatsApp Business Platform</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] text-balance"
            >
              WhatsApp business messaging, run like an enterprise.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 text-lg text-white/60 leading-relaxed max-w-xl text-balance"
            >
              Wazenly is the official WhatsApp Business API platform for teams that need more than a chat app —
              campaigns, a shared team inbox, automation, and analytics, built on enterprise-grade security.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-9 flex flex-col sm:flex-row gap-3"
            >
              <Link
                href="/auth/login"
                className="group inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-600 text-white font-semibold px-6 py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-primary/25"
              >
                Sign In
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 glass-dark text-white font-semibold px-6 py-3.5 rounded-xl transition-colors hover:bg-white/10"
              >
                Contact Us
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-5 text-xs text-white/40"
            >
              Access is by invitation only — built for businesses, not open self-signup.
            </motion.p>
          </div>

          <div className="relative flex flex-col items-center gap-6">
            <DashboardMockup />
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="lg:absolute lg:-bottom-10 lg:-left-12"
            >
              <ChatPreview />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
