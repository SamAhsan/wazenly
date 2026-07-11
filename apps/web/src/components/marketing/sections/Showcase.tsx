import { DashboardMockup } from "../DashboardMockup";
import { AnimatedCounter } from "../AnimatedCounter";
import { Reveal } from "../Reveal";

const STATS = [
  { value: 99, suffix: "%", label: "Delivery reliability" },
  { value: 40, suffix: "+", label: "Countries reached" },
  { value: 24, suffix: "/7", label: "Platform uptime monitoring" },
];

export function Showcase() {
  return (
    <section className="bg-[#0f1117] py-20 sm:py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold text-primary mb-3">Built for scale</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight text-balance">
              One workspace, the entire conversation
            </h2>
            <p className="mt-4 text-white/50 text-lg text-balance">
              Campaigns, inbox, contacts, and analytics — designed to feel like one product, not a bundle of tools.
            </p>
          </div>
        </Reveal>

        <Reveal direction="fade">
          <div className="mb-16">
            <DashboardMockup />
          </div>
        </Reveal>

        <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto text-center">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.1}>
              <p className="text-3xl sm:text-4xl font-bold text-white">
                <AnimatedCounter value={s.value} suffix={s.suffix} />
              </p>
              <p className="mt-2 text-xs sm:text-sm text-white/40">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
