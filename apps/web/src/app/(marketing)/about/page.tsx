import type { Metadata } from "next";
import { Target, Eye, ShieldCheck, Users, Rocket, Layers, Lock, Map } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";

const TITLE = "About Wazenly — Official WhatsApp Business API Platform";
const DESCRIPTION =
  "Learn about Wazenly's mission to make enterprise-grade WhatsApp Business messaging accessible to teams of every size, built on the official Meta WhatsApp Business Platform.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/about", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const VALUES = [
  { icon: ShieldCheck, title: "Trust", desc: "We build on official platforms and encrypt what matters — nothing about how we handle your data is a black box." },
  { icon: Users, title: "Customer-first", desc: "Every feature starts from a real workflow problem a business messaging team actually has." },
  { icon: Rocket, title: "Reliability", desc: "Business messaging doesn't get to be flaky. Uptime and delivery reliability come before new features." },
  { icon: Layers, title: "Simplicity", desc: "Enterprise capability shouldn't mean an enterprise-complexity interface." },
];

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://wazenlyapp.com" },
      { "@type": "ListItem", position: 2, name: "About", item: "https://wazenlyapp.com/about" },
    ],
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="bg-[#0f1117] pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
          <Reveal>
            <p className="text-sm font-semibold text-primary mb-3">About Wazenly</p>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight text-balance">
              Business messaging, built to be trusted
            </h1>
            <p className="mt-5 text-lg text-white/60 leading-relaxed text-balance max-w-2xl mx-auto">
              Wazenly exists because WhatsApp became the primary channel businesses use to talk to customers —
              but most teams were still managing it like a personal chat app.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 space-y-16">
          <Reveal>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Story</h2>
              <p className="text-gray-500 leading-relaxed">
                Wazenly started from a simple observation: businesses were running campaigns, customer support, and sales conversations
                through WhatsApp using tools that were never designed for a team, let alone a company managing multiple brands or numbers.
                Messages fell through the cracks, no one could see what a teammate had already replied, and there was no reliable way to
                measure whether a campaign actually worked. We built Wazenly on the official WhatsApp Business Cloud API to fix that —
                a single, dependable platform where campaigns, conversations, and analytics all live together.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-8">
            <Reveal>
              <div className="neu-card p-7 h-full">
                <Target className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Mission</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  To make enterprise-grade WhatsApp Business messaging accessible and dependable for teams of every size —
                  without requiring a technical team to operate it.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="neu-card p-7 h-full">
                <Eye className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Vision</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  A world where every business conversation on WhatsApp — from a first inquiry to a resolved support ticket —
                  happens on infrastructure built for that job, not repurposed for it.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Core Values</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {VALUES.map((v) => (
                  <div key={v.title} className="flex gap-4 p-5 rounded-xl bg-gray-50">
                    <v.icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm mb-1">{v.title}</h4>
                      <p className="text-sm text-gray-500 leading-relaxed">{v.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Why Wazenly</h2>
              <p className="text-gray-500 leading-relaxed">
                Most WhatsApp tools fall into one of two camps: a personal-chat app stretched past its limits, or a heavyweight
                enterprise suite that takes months to set up. Wazenly sits deliberately in between — the official API underneath,
                a shared team inbox, automation, and analytics on top, and an interface a new team member can pick up in an afternoon.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Technology &amp; Security</h2>
              <p className="text-gray-500 leading-relaxed">
                Wazenly is built entirely on Meta's official WhatsApp Business Cloud API — not an unofficial gateway. Every WhatsApp
                number connected to Wazenly gets fully isolated contacts, campaigns, and conversation data, access tokens are encrypted
                at rest, and every action in the platform is scoped by workspace and role.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2"><Map className="w-5 h-5 text-primary" /> Future Roadmap</h2>
              <p className="text-gray-500 leading-relaxed">
                We're continuing to invest in deeper automation, richer analytics, and broader integrations — always grounded in what
                official WhatsApp Business API constraints actually allow, so what we ship stays reliable, not just impressive on paper.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
