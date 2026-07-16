import type { Metadata } from "next";
import Image from "next/image";
import { Mail, Phone, MessageCircle } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { ContactForm } from "@/components/marketing/ContactForm";
import { PageHero } from "@/components/marketing/PageHero";

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

      <PageHero
        eyebrow="Contact"
        title="Let's talk"
        description="Have a question, or ready to set up your workspace? Reach out and we'll respond as soon as we can."
        icon={<MessageCircle className="w-6 h-6 text-primary" />}
      />

      <section className="bg-[#F7FAF8] py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Reveal direction="right">
              <a href="mailto:info@wazenlyapp.com" className="flat-card hover-lift flex items-center gap-4 p-5 block">
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
              <a href="https://wa.me/923004347067" target="_blank" rel="noopener noreferrer" className="flat-card hover-lift flex items-center gap-4 p-5 block">
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
              <a href="https://wa.me/905528738477" target="_blank" rel="noopener noreferrer" className="flat-card hover-lift flex items-center gap-4 p-5 block">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">WhatsApp</p>
                  <p className="text-sm font-semibold text-gray-900">+90 552 873 8477</p>
                </div>
              </a>
            </Reveal>
            <Reveal direction="right" delay={0.3}>
              <div className="flat-card relative w-full aspect-square overflow-hidden">
                <Image
                  src="/campaigns-feature.png"
                  alt="Wazenly WhatsApp campaigns and broadcast messaging"
                  fill
                  className="object-contain p-8"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-3">
            <Reveal direction="left">
              <div className="flat-card p-6 sm:p-8">
                <ContactForm />
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
