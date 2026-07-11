"use client";

import { motion } from "framer-motion";
import { Megaphone, CheckCheck, Eye } from "lucide-react";

export function ChatPreview() {
  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      className="glass rounded-2xl p-4 w-72 sm:w-80"
    >
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Summer Sale Campaign</p>
            <p className="text-[11px] text-white/50">Broadcast · WhatsApp</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/15 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Live
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="bg-primary text-white rounded-2xl rounded-bl-sm px-3.5 py-3 text-xs leading-relaxed mb-3"
      >
        🎉 <strong>Flash Sale — 30% off everything!</strong>
        <br />
        This weekend only. Reply <strong>SHOP</strong> to get your code.
        <span className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-70">
          09:41 <CheckCheck className="w-3 h-3" />
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="grid grid-cols-3 gap-2 text-center"
      >
        <div className="rounded-lg bg-white/5 py-2">
          <p className="text-sm font-bold text-white">12,480</p>
          <p className="text-[9px] text-white/40">Sent</p>
        </div>
        <div className="rounded-lg bg-white/5 py-2">
          <p className="text-sm font-bold text-white flex items-center justify-center gap-1">
            <CheckCheck className="w-3 h-3 text-blue-400" /> 98%
          </p>
          <p className="text-[9px] text-white/40">Delivered</p>
        </div>
        <div className="rounded-lg bg-white/5 py-2">
          <p className="text-sm font-bold text-white flex items-center justify-center gap-1">
            <Eye className="w-3 h-3 text-primary" /> 74%
          </p>
          <p className="text-[9px] text-white/40">Read</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
