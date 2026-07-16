"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Users, Megaphone, Clock, BarChart3, MessageCircle } from "lucide-react";
import { AnimatedCounter } from "../AnimatedCounter";

const BADGES = ["Official Meta WhatsApp API", "Secure & Reliable", "Trusted by Businesses"];

function PhoneMockup() {
  return (
    <div className="relative w-56 sm:w-64 mx-auto">
      <div className="rounded-[2.5rem] bg-white shadow-2xl shadow-black/20 border-[6px] border-white p-1">
        <div className="rounded-[2rem] overflow-hidden bg-[#ECE5DD]">
          <div className="bg-primary px-4 py-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold">Wazenlyapp</p>
              <p className="text-white/70 text-[10px]">online</p>
            </div>
          </div>
          <div className="p-3 space-y-2 min-h-[220px]">
            <div className="bg-white rounded-lg rounded-tl-sm px-3 py-2 text-[11px] text-gray-700 max-w-[80%] shadow-sm">
              Hello 👋 Welcome to Wazenlyapp!
            </div>
            <div className="bg-white rounded-lg rounded-tl-sm px-3 py-2 text-[11px] text-gray-700 max-w-[80%] shadow-sm">
              Hi, I need more info.
            </div>
            <div className="bg-primary/90 rounded-lg rounded-tr-sm px-3 py-2 text-[11px] text-white max-w-[80%] shadow-sm ml-auto">
              Sure! How can we help you today?
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, className }: { icon: typeof Users; label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flat-card px-4 py-3 flex items-center gap-3 ${className}`}>
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-[11px] text-gray-400 leading-none mb-1">{label}</p>
        <p className="text-sm font-bold text-gray-900 leading-none">{value}</p>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="bg-white pt-8 pb-4 sm:pt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-[#0B3D2E] px-6 py-14 sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
            <div className="absolute -top-24 -left-10 w-[26rem] h-[26rem] rounded-full bg-primary/20 blur-[110px]" />
            <div className="absolute bottom-0 right-0 w-[22rem] h-[22rem] rounded-full bg-emerald-400/10 blur-[110px]" />
          </div>

          <div className="relative grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-[1.12] text-balance"
              >
                The Best WhatsApp BSP Software to <span className="text-primary">Grow Your Business</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mt-6 text-white/60 leading-relaxed max-w-lg text-balance"
              >
                Wazenlyapp is a powerful WhatsApp Business Solution Provider platform that helps you run campaigns,
                manage a shared team inbox, automate conversations, and grow faster — built on the official Meta API.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-8 flex flex-col sm:flex-row gap-3"
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
                  className="inline-flex items-center justify-center gap-2 border border-white/25 hover:bg-white/10 text-white font-semibold px-6 py-3.5 rounded-xl transition-colors"
                >
                  Contact Us
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-8 flex flex-wrap gap-x-6 gap-y-2"
              >
                {BADGES.map((b) => (
                  <span key={b} className="flex items-center gap-1.5 text-xs text-white/60">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    {b}
                  </span>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative flex items-center justify-center py-6"
            >
              <PhoneMockup />
              <StatCard icon={Users} label="Team Inbox" value="12 agents" className="absolute left-0 top-4 hidden sm:flex" />
              <StatCard
                icon={Megaphone}
                label="Campaigns"
                value={<><AnimatedCounter value={98} suffix="%" /> Delivered</>}
                className="absolute right-0 top-16 hidden sm:flex"
              />
              <StatCard icon={Clock} label="Automations" value="24/7" className="absolute left-2 bottom-6 hidden sm:flex" />
              <StatCard icon={BarChart3} label="Analytics" value="Real-time" className="absolute right-2 bottom-0 hidden sm:flex" />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
