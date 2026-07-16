import { ShoppingBag, GraduationCap, Building2, HeartPulse, Plane, Briefcase } from "lucide-react";
import { Reveal } from "../Reveal";

const INDUSTRIES = [
  { icon: ShoppingBag, label: "E-commerce" },
  { icon: GraduationCap, label: "Education" },
  { icon: Building2, label: "Real Estate" },
  { icon: HeartPulse, label: "Healthcare" },
  { icon: Plane, label: "Travel & Hospitality" },
  { icon: Briefcase, label: "Professional Services" },
];

export function Industries() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold text-primary mb-3">Industries</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight text-balance">
              Perfect for businesses of all sizes
            </h2>
            <p className="mt-4 text-gray-500 text-lg text-balance">
              Any business using WhatsApp to talk to customers can run it through Wazenly.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {INDUSTRIES.map((ind, i) => (
            <Reveal key={ind.label} delay={i * 0.05}>
              <div className="flat-card hover-lift h-full py-8 px-4 flex flex-col items-center text-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ind.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-gray-700">{ind.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
