import { Link2, FileEdit, Send, LineChart, Sparkles } from "lucide-react";
import { Reveal } from "../Reveal";

const STEPS = [
  { icon: Link2, title: "Connect WhatsApp", desc: "Link your official WhatsApp Business Account through the Meta Cloud API in minutes." },
  { icon: FileEdit, title: "Create a Campaign", desc: "Pick a template, select your audience, and set your schedule." },
  { icon: Send, title: "Send Messages", desc: "Launch at scale with automatic rate limiting and delivery handling." },
  { icon: LineChart, title: "Track Analytics", desc: "Watch delivery, read, and reply rates update in real time." },
  { icon: Sparkles, title: "Optimize Results", desc: "Refine templates and targeting based on what's actually working." },
];

export function HowItWorks() {
  return (
    <section className="bg-white py-4 pb-20 sm:pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-[#0B3D2E] px-6 py-16 sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
            <div className="absolute -bottom-24 -right-10 w-[26rem] h-[26rem] rounded-full bg-primary/20 blur-[110px]" />
          </div>

          <div className="relative">
            <Reveal>
              <div className="text-center max-w-2xl mx-auto mb-16">
                <p className="text-sm font-semibold text-primary mb-3">How It Works</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight text-balance">From connected to converting</h2>
              </div>
            </Reveal>

            <div className="relative grid sm:grid-cols-2 lg:grid-cols-5 gap-y-10 gap-x-4">
              <div
                className="hidden lg:block absolute top-7 left-[10%] right-[10%] h-px"
                style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.25) 0 8px, transparent 8px 16px)" }}
              />
              {STEPS.map((step, i) => (
                <Reveal key={step.title} delay={i * 0.08}>
                  <div className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
                    <div className="relative z-10 w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-4">
                      <step.icon className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-xs font-semibold text-primary mb-1">Step {i + 1}</p>
                    <h4 className="font-semibold text-white mb-1.5">{step.title}</h4>
                    <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
