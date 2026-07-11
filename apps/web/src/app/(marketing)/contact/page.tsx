import type { Metadata } from "next";
import { Mail, Phone } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { ContactForm } from "@/components/marketing/ContactForm";

const TITLE = "Contact Wazenly — Talk to Our Team";
const DESCRIPTION =
  "Get in touch with Wazenly to set up your WhatsApp Business API workspace, ask a question, or request enterprise access. Reach us by WhatsApp or email.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/contact", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ContactPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://wazenlyapp.com" },
      { "@type": "ListItem", position: 2, name: "Contact", item: "https://wazenlyapp.com/contact" },
    ],
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="bg-[#0f1117] pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
          <Reveal>
            <p className="text-sm font-semibold text-primary mb-3">Contact</p>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight text-balance">Let's talk</h1>
            <p className="mt-5 text-lg text-white/60 leading-relaxed max-w-xl mx-auto text-balance">
              Have a question, or ready to set up your workspace? Reach out and we'll respond as soon as we can.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-[#f6f8fa] py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Reveal direction="right">
              <a href="mailto:info@wazenlyapp.com" className="neu-card hover-lift flex items-center gap-4 p-5 block">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Email</p>
                  <p className="text-sm font-semibold text-gray-900">info@wazenlyapp.com</p>
                </div>
              </a>
            </Reveal>
            <Reveal direction="right" delay={0.1}>
              <a href="https://wa.me/923004347067" target="_blank" rel="noopener noreferrer" className="neu-card hover-lift flex items-center gap-4 p-5 block">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">WhatsApp</p>
                  <p className="text-sm font-semibold text-gray-900">+92 300 4347067</p>
                </div>
              </a>
            </Reveal>
            <Reveal direction="right" delay={0.2}>
              <a href="https://wa.me/905528738477" target="_blank" rel="noopener noreferrer" className="neu-card hover-lift flex items-center gap-4 p-5 block">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">WhatsApp</p>
                  <p className="text-sm font-semibold text-gray-900">+90 552 873 8477</p>
                </div>
              </a>
            </Reveal>
          </div>

          <div className="lg:col-span-3">
            <Reveal direction="left">
              <div className="neu-card p-6 sm:p-8">
                <ContactForm />
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
