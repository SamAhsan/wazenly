"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, FileText } from "lucide-react";

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
      className={`sticky top-0 z-50 bg-white border-b transition-shadow duration-300 ${
        scrolled ? "border-gray-200 shadow-sm" : "border-gray-100"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image src="/logo-mark.png" alt="Wazenly" width={38} height={38} className="transition-transform group-hover:scale-105" priority />
          <span className="text-lg font-bold text-gray-900 tracking-tight">Wazenlyapp</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors ${
                pathname === l.href ? "text-primary" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="/wazenly-deck.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 hover:text-gray-900 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            WhatsApp Marketing Solutions
          </a>
          <Link
            href="/auth/login"
            className="inline-flex items-center bg-primary hover:bg-primary-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>

        <button onClick={() => setMobileOpen((v) => !v)} className="md:hidden text-gray-700 p-2" aria-label="Toggle menu">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-5 py-4 space-y-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`block px-2 py-2.5 text-sm font-medium ${pathname === l.href ? "text-primary" : "text-gray-600 hover:text-gray-900"}`}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="/wazenly-deck.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 text-sm font-medium px-5 py-2.5 rounded-lg mt-2"
          >
            <FileText className="w-4 h-4" />
            WhatsApp Marketing Solutions
          </a>
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
