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
    <section className="bg-white pt-8 pb-4 sm:pt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-[#0B3D2E] px-6 py-16 sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
            <div className="absolute -top-24 left-1/4 w-[26rem] h-[26rem] rounded-full bg-primary/20 blur-[110px]" />
            <div className="absolute bottom-0 right-0 w-[22rem] h-[22rem] rounded-full bg-emerald-400/10 blur-[110px]" />
          </div>

          <div className="relative max-w-2xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 border border-white/15 mb-6"
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
        </div>
      </div>
    </section>
  );
}
