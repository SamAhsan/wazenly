import { Megaphone, Inbox, Workflow, BarChart3, Lock, Webhook, CheckCircle2 } from "lucide-react";
import { Reveal } from "../Reveal";

const MORE_ITEMS = [
  "Contact Management", "Message Templates", "Role-Based Permissions", "Multi-Company Support", "Broadcast Scheduling",
];

const FEATURES = [
  {
    icon: Megaphone,
    title: "Campaigns & Broadcast Messaging",
    description: "Plan, schedule, and launch campaigns to segmented contact lists — reach thousands of customers in one send, automatically paced within Meta's rate limits.",
  },
  {
    icon: Inbox,
    title: "Shared Team Inbox",
    description: "One inbox for the whole team — assign, resolve, and never double-reply.",
  },
  {
    icon: Workflow,
    title: "Flow Builder & Automation",
    description: "Design conversational flows visually — auto-reply, route, and tag without code.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description: "Delivery, read, and reply rates tracked in real time, exportable for stakeholders.",
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description: "Workspace isolation, role-based access, and encrypted credentials by design.",
  },
  {
    icon: Webhook,
    title: "API & Webhooks",
    description: "A documented REST API and event webhooks to integrate with your own stack.",
  },
];

export function Features() {
  return (
    <section id="features" className="bg-white py-20 sm:py-28">
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <div className="flat-card hover-lift h-full p-7 flex flex-col">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold text-gray-900 text-lg mb-2">{f.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3}>
          <div className="mt-6 rounded-2xl bg-primary px-6 py-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {MORE_ITEMS.map((item) => (
              <span key={item} className="flex items-center gap-2 text-sm text-white">
                <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
