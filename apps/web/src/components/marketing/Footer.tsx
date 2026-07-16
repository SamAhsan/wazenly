import Link from "next/link";
import Image from "next/image";
import { Mail, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#0f1117] border-t border-white/5 text-white/60">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
        <div className="lg:col-span-2">
          <Link href="/" className="flex items-center gap-2.5 mb-5">
            <Image src="/logo-mark.png" alt="Wazenly" width={38} height={38} />
            <span className="text-lg font-bold text-white tracking-tight">WAZENLY</span>
          </Link>
          <p className="text-sm leading-relaxed max-w-sm">
            The official Meta WhatsApp Business Platform for teams — campaigns, a shared inbox, automation, and analytics in one enterprise-grade workspace.
          </p>
          <Image src="/Meta logo.png" alt="Meta Business Partner" width={140} height={80} className="mt-6 rounded-lg" />
        </div>

        <div>
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-4">Quick Links</p>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
            <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
            <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</Link></li>
            <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-4">Contact</p>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 flex-shrink-0 text-primary" />
              <a href="mailto:info@wazenlyapp.com" className="hover:text-white transition-colors">info@wazenlyapp.com</a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 flex-shrink-0 text-primary" />
              <a href="https://wa.me/923004347067" className="hover:text-white transition-colors">+92 300 4347067</a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 flex-shrink-0 text-primary" />
              <a href="https://wa.me/905528738477" className="hover:text-white transition-colors">+90 552 873 8477</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 text-xs text-white/40">
          © {new Date().getFullYear()} Wazenly. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
