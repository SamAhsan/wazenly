"use client";

import { motion } from "framer-motion";
import { MessageSquare, Users, Send, TrendingUp } from "lucide-react";

const BARS = [38, 62, 45, 78, 55, 90, 68];

export function DashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="relative w-full max-w-3xl mx-auto"
    >
      <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/30 border border-white/10 bg-[#0f1117] flex">
        {/* fake sidebar */}
        <div className="hidden sm:flex w-14 flex-col items-center gap-4 py-5 bg-[#0f1117] border-r border-white/5">
          <div className="w-7 h-7 rounded-lg bg-primary/90" />
          {[MessageSquare, Users, Send, TrendingUp].map((Icon, i) => (
            <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${i === 0 ? "bg-white/10" : ""}`}>
              <Icon className="w-4 h-4 text-white/50" />
            </div>
          ))}
        </div>

        <div className="flex-1 bg-white p-5 sm:p-6">
          {/* fake topbar */}
          <div className="flex items-center justify-between mb-5">
            <div className="h-3 w-28 rounded-full bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-200" />
              <div className="w-6 h-6 rounded-full bg-primary/20" />
            </div>
          </div>

          {/* fake stat cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Sent", value: "12,480", color: "text-primary" },
              { label: "Delivered", value: "98.2%", color: "text-blue-500" },
              { label: "Replies", value: "3,214", color: "text-purple-500" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-gray-50 p-3">
                <p className="text-[10px] text-gray-400 mb-1">{s.label}</p>
                <p className={`text-sm sm:text-base font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* fake chart */}
          <div className="rounded-xl bg-gray-50 p-4 flex items-end gap-2 h-24">
            {BARS.map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                whileInView={{ height: `${h}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
                className="flex-1 rounded-t-md bg-gradient-to-t from-primary to-primary/50"
              />
            ))}
          </div>
        </div>
      </div>

      {/* floating accent badge */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-4 -right-4 sm:-right-8 glass rounded-xl px-3 py-2 hidden sm:flex items-center gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-medium text-white">Live</span>
      </motion.div>
    </motion.div>
  );
}
