import {
  Megaphone, Radio, FileText, Users, Inbox, KeyRound, Building2,
  Zap, Workflow, BarChart3, FileBarChart, Code2, Webhook, Lock,
} from "lucide-react";
import { Reveal } from "../Reveal";

const GROUPS = [
  {
    title: "Messaging & Campaigns",
    items: [
      { icon: Megaphone, name: "WhatsApp Campaigns", desc: "Plan, schedule, and launch campaigns to segmented contact lists." },
      { icon: Radio, name: "Broadcast Messaging", desc: "Reach thousands of customers in one send, within Meta's rate limits." },
      { icon: FileText, name: "Templates", desc: "Build and sync Meta-approved message templates directly in-app." },
      { icon: Users, name: "Contact Management", desc: "Import, tag, segment, and track engagement across your audience." },
    ],
  },
  {
    title: "Team & Collaboration",
    items: [
      { icon: Inbox, name: "Shared Team Inbox", desc: "One inbox for the whole team — assign, resolve, and never double-reply." },
      { icon: KeyRound, name: "Role Management", desc: "Owner, Admin, Manager, Agent — granular permissions for every role." },
      { icon: Building2, name: "Multi-Company Support", desc: "Run multiple independent businesses from a single account." },
    ],
  },
  {
    title: "Automation & Analytics",
    items: [
      { icon: Zap, name: "Automation", desc: "Auto-reply, tag, route, and follow up without manual work." },
      { icon: Workflow, name: "Flow Builder", desc: "Design conversational flows visually — no code required." },
      { icon: BarChart3, name: "Analytics", desc: "Delivery, read, and reply rates, tracked in real time." },
      { icon: FileBarChart, name: "Reports", desc: "Exportable performance reports for stakeholders and clients." },
    ],
  },
  {
    title: "Enterprise & Security",
    items: [
      { icon: Code2, name: "API Access", desc: "A documented REST API to integrate Wazenly into your stack." },
      { icon: Webhook, name: "Webhooks", desc: "Push delivery, read, and reply events to your own systems." },
      { icon: Lock, name: "Workspace Isolation", desc: "Every WhatsApp number's data is fully isolated by design." },
    ],
  },
];

export function Features() {
  return (
    <section id="features" className="bg-[#f6f8fa] py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight text-balance">
              Everything a business messaging team needs
            </h2>
            <p className="mt-4 text-gray-500 text-lg text-balance">
              From your first campaign to enterprise-scale automation — one platform, built on the official WhatsApp Business API.
            </p>
          </div>
        </Reveal>

        <div className="space-y-14">
          {GROUPS.map((group, gi) => (
            <div key={group.title}>
              <Reveal delay={gi * 0.05}>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-5">{group.title}</h3>
              </Reveal>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {group.items.map((item, i) => (
                  <Reveal key={item.name} delay={gi * 0.05 + i * 0.05}>
                    <div className="neu-card hover-lift h-full p-6">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-1.5">{item.name}</h4>
                      <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
