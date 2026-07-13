"use client";

import { motion } from "framer-motion";

export function PageHero({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  // A rendered element, not a component reference -- passing the bare component
  // type across the server/client boundary isn't serializable and breaks the build.
  icon: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-[#0f1117] pt-20 pb-20 sm:pt-28 sm:pb-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[28rem] h-[28rem] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute top-10 right-0 w-[22rem] h-[22rem] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-5 sm:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.7, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl glass-dark mb-6"
          >
            {icon}
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-sm font-semibold text-primary mb-3"
        >
          {eyebrow}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-4xl sm:text-5xl font-bold text-white tracking-tight text-balance"
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-5 text-lg text-white/60 leading-relaxed max-w-xl mx-auto text-balance"
        >
          {description}
        </motion.p>
      </div>
    </section>
  );
}
