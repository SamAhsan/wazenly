import { Megaphone, Workflow, BarChart3, Lock, Webhook, CheckCircle2 } from "lucide-react";
import { Reveal } from "../Reveal";

const MORE_ITEMS = [
  "Contact Management", "Message Templates", "Role-Based Permissions", "Multi-Company Support", "Broadcast Scheduling",
];

function BurstIllustration() {
  return (
    <div className="relative w-full h-28 flex items-center justify-center">
      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center z-10">
        <Megaphone className="w-4 h-4 text-primary" />
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border border-primary/30"
          style={{ width: 56 + i * 30, height: 56 + i * 30, opacity: 0.5 - i * 0.15 }}
        />
      ))}
      {[
        { top: "10%", left: "20%" }, { top: "15%", right: "15%" }, { bottom: "12%", left: "25%" }, { bottom: "18%", right: "20%" },
      ].map((pos, i) => (
        <div key={i} className="absolute w-2.5 h-2.5 rounded-full bg-primary/60" style={pos} />
      ))}
    </div>
  );
}

function InboxIllustration() {
  return (
    <div className="relative w-full h-28 flex items-center justify-center gap-[-8px]">
      <div className="flex -space-x-3">
        {["bg-primary", "bg-blue-400", "bg-purple-400"].map((c, i) => (
          <div key={i} className={`w-10 h-10 rounded-full ${c} border-2 border-white flex items-center justify-center text-white text-xs font-bold`} style={{ zIndex: 3 - i }}>
            {String.fromCharCode(65 + i)}
          </div>
        ))}
      </div>
      <div className="absolute -bottom-1 right-[30%] w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
      </div>
    </div>
  );
}

function FlowIllustration() {
  return (
    <div className="relative w-full h-20 flex items-center justify-center gap-3">
      <div className="w-3 h-3 rounded-full bg-primary" />
      <div className="w-6 h-px bg-gray-300" />
      <div className="w-3 h-3 rounded-full border-2 border-primary" />
      <div className="w-6 h-px bg-gray-300" />
      <div className="w-3 h-3 rounded-full bg-gray-300" />
    </div>
  );
}

function ChartIllustration() {
  const bars = [40, 65, 50, 85, 60];
  return (
    <div className="w-full h-20 flex items-end justify-center gap-2">
      {bars.map((h, i) => (
        <div key={i} className="w-3 rounded-t-sm bg-gradient-to-t from-primary to-primary/40" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[minmax(0,1fr)]">
          <Reveal className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
            <div className="neu-card hover-lift h-full p-7 flex flex-col">
              <BurstIllustration />
              <h4 className="font-semibold text-gray-900 text-lg mt-2 mb-2">Campaigns &amp; Broadcast Messaging</h4>
              <p className="text-sm text-gray-500 leading-relaxed">
                Plan, schedule, and launch campaigns to segmented contact lists — reach thousands of customers in one send,
                automatically paced within Meta's rate limits.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.05} className="lg:col-span-2">
            <div className="neu-card hover-lift h-full p-6 flex flex-col">
              <InboxIllustration />
              <h4 className="font-semibold text-gray-900 mt-3 mb-1.5">Shared Team Inbox</h4>
              <p className="text-sm text-gray-500 leading-relaxed">One inbox for the whole team — assign, resolve, and never double-reply.</p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="neu-card hover-lift h-full p-6 flex flex-col">
              <Workflow className="w-5 h-5 text-primary mb-3" />
              <FlowIllustration />
              <h4 className="font-semibold text-gray-900 mt-3 mb-1.5">Flow Builder &amp; Automation</h4>
              <p className="text-sm text-gray-500 leading-relaxed">Design conversational flows visually — auto-reply, route, and tag without code.</p>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="neu-card hover-lift h-full p-6 flex flex-col">
              <BarChart3 className="w-5 h-5 text-primary mb-3" />
              <ChartIllustration />
              <h4 className="font-semibold text-gray-900 mt-3 mb-1.5">Analytics &amp; Reports</h4>
              <p className="text-sm text-gray-500 leading-relaxed">Delivery, read, and reply rates tracked in real time, exportable for stakeholders.</p>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="neu-card hover-lift h-full p-6 flex flex-col justify-center items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-1.5">Enterprise Security</h4>
              <p className="text-sm text-gray-500 leading-relaxed">Workspace isolation, role-based access, and encrypted credentials by design.</p>
            </div>
          </Reveal>

          <Reveal delay={0.25}>
            <div className="neu-card hover-lift h-full p-6 flex flex-col justify-center items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Webhook className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-1.5">API &amp; Webhooks</h4>
              <p className="text-sm text-gray-500 leading-relaxed">A documented REST API and event webhooks to integrate with your own stack.</p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.3}>
          <div className="mt-6 neu-card px-6 py-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {MORE_ITEMS.map((item) => (
              <span key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
