import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { Reveal } from "../Reveal";

const POINTS = [
  "Built entirely on the official Meta WhatsApp Business Cloud API",
  "Every API request authenticated and scoped to your workspace",
  "Each connected WhatsApp number's data fully isolated by design",
  "Role-based access — Owner, Admin, Manager, Agent",
  "Access tokens and credentials encrypted at rest",
];

function ShieldIllustration() {
  return (
    <div className="relative w-full h-64 sm:h-72 flex items-center justify-center">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border border-primary/15"
          style={{ width: 140 + i * 60, height: 140 + i * 60 }}
        />
      ))}
      <div className="relative w-28 h-28 rounded-[2rem] bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl shadow-primary/20">
        <ShieldCheck className="w-14 h-14 text-white" />
      </div>
    </div>
  );
}

export function Security() {
  return (
    <section className="bg-[#F7FAF8] py-20 sm:py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-center">
        <Reveal direction="right">
          <ShieldIllustration />
        </Reveal>
        <Reveal direction="left">
          <p className="text-sm font-semibold text-primary mb-3">Enterprise Security</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight text-balance mb-5">
            Trusted infrastructure for business messaging
          </h2>
          <ul className="space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-gray-600">
                <CheckCircle2 className="w-4.5 h-4.5 text-primary flex-shrink-0 mt-0.5" />
                {point}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
