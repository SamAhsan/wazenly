import { ShieldCheck, Building2, Users, Zap, Radio, BarChart3 } from "lucide-react";
import { Reveal } from "../Reveal";

const ITEMS = [
  { icon: ShieldCheck, label: "Official Meta WhatsApp API" },
  { icon: Building2, label: "Enterprise Security" },
  { icon: Users, label: "Multi-Workspace" },
  { icon: Zap, label: "Team Collaboration" },
  { icon: Radio, label: "Reliable Messaging" },
  { icon: BarChart3, label: "High Performance" },
];

export function TrustBar() {
  return (
    <section className="bg-white border-b border-gray-100 py-10 sm:py-12">
      <Reveal>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 sm:gap-4">
            {ITEMS.map((item) => (
              <div key={item.label} className="flex flex-col items-center text-center gap-2">
                <item.icon className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
