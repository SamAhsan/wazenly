import { BadgeCheck, ShieldCheck, Lock, KeyRound, FileLock2 } from "lucide-react";
import { Reveal } from "../Reveal";

const ITEMS = [
  { icon: BadgeCheck, title: "Official Meta Platform", desc: "Built entirely on the official WhatsApp Business Cloud API — no unofficial or gray-market integrations." },
  { icon: ShieldCheck, title: "Secure APIs", desc: "Every API request is authenticated and scoped to your workspace." },
  { icon: Lock, title: "Workspace Isolation", desc: "Each WhatsApp number's contacts, campaigns, and data are fully isolated by design." },
  { icon: KeyRound, title: "Role-Based Access", desc: "Owner, Admin, Manager, and Agent roles control exactly who can do what." },
  { icon: FileLock2, title: "Encrypted Communication", desc: "Access tokens and sensitive credentials are encrypted at rest." },
];

export function Security() {
  return (
    <section className="bg-[#f6f8fa] py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary mb-3">Enterprise Security</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight text-balance">
              Trusted infrastructure for business messaging
            </h2>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.06}>
              <div className="neu-card hover-lift h-full p-6">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1.5">{item.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
