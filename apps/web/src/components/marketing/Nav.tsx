"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/#features", label: "Features" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 bg-[#0f1117] border-b transition-shadow duration-300 ${
        scrolled ? "border-white/10 shadow-lg shadow-black/20" : "border-white/5"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image src="/logo-mark.png" alt="Wazenly" width={30} height={30} className="transition-transform group-hover:scale-105" priority />
          <span className="text-lg font-bold text-white tracking-tight">WAZENLY</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-white/70 hover:text-white transition-colors">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:block">
          <Link
            href="/auth/login"
            className="inline-flex items-center bg-primary hover:bg-primary-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>

        <button onClick={() => setMobileOpen((v) => !v)} className="md:hidden text-white p-2" aria-label="Toggle menu">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden bg-[#0f1117] border-t border-white/5 px-5 py-4 space-y-1">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="block px-2 py-2.5 text-sm font-medium text-white/70 hover:text-white">
              {l.label}
            </Link>
          ))}
          <Link
            href="/auth/login"
            className="block text-center bg-primary hover:bg-primary-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg mt-2"
          >
            Sign In
          </Link>
        </div>
      )}
    </header>
  );
}
