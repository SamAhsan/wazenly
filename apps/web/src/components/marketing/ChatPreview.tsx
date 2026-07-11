"use client";

import { motion } from "framer-motion";
import { Check, CheckCheck } from "lucide-react";

const MESSAGES = [
  { from: "them", text: "Hi! Do you ship internationally?", time: "10:41" },
  { from: "us", text: "Yes! We ship to over 40 countries 🌍", time: "10:41", read: true },
  { from: "us", text: "Want me to send you our catalog?", time: "10:42", read: true },
  { from: "them", text: "Yes please, that'd be great", time: "10:44" },
];

export function ChatPreview() {
  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      className="glass rounded-2xl p-4 w-72 sm:w-80"
    >
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
        <div className="w-8 h-8 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold">S</div>
        <div>
          <p className="text-sm font-semibold text-white">Sarah Miller</p>
          <p className="text-[11px] text-white/50">via WhatsApp Business</p>
        </div>
      </div>
      <div className="space-y-2">
        {MESSAGES.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.25, duration: 0.4 }}
            className={`flex ${m.from === "us" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs leading-relaxed ${
                m.from === "us" ? "bg-primary text-white rounded-br-sm" : "bg-white/10 text-white/90 rounded-bl-sm"
              }`}
            >
              {m.text}
              <span className="flex items-center justify-end gap-1 mt-0.5 text-[9px] opacity-70">
                {m.time}
                {m.from === "us" && (m.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
