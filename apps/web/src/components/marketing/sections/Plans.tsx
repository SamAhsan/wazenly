import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Reveal } from "../Reveal";

const PLANS = [
  {
    name: "Growing Teams",
    tagline: "For businesses running WhatsApp campaigns and support from one workspace.",
    tint: "bg-primary/[0.06] border-primary/15",
    badgeTint: "bg-primary/10 text-primary-700",
    image: "/inbox-feature.jpg",
    features: [
      "Campaigns & broadcast messaging",
      "Shared team inbox",
      "Flow builder & automation",
      "Contact management & segmentation",
      "Message template library",
      "Analytics & delivery reports",
    ],
  },
  {
    name: "Enterprise & Multi-Company",
    tagline: "For agencies and larger organizations managing multiple WhatsApp numbers.",
    tint: "bg-sky-500/[0.06] border-sky-500/15",
    badgeTint: "bg-sky-500/10 text-sky-700",
    image: "/Enterprise & Multi-Company.jpeg",
    features: [
      "Everything in Growing Teams",
      "Multi-company & multi-number support",
      "Role-based permissions (Owner, Admin, Manager, Agent)",
      "Workspace isolation per company",
      "Documented REST API & webhooks",
      "Priority onboarding & support",
    ],
  },
];

export function Plans() {
  return (
    <section className="bg-[#F7FAF8] py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary mb-3">Plans</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight text-balance">
              A workspace sized to your business
            </h2>
            <p className="mt-4 text-gray-500 text-lg text-balance">
              Wazenly is invitation-only — reach out and we'll set up the right plan for your team.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.1}>
              <div className={`flat-card border h-full flex flex-col overflow-hidden ${plan.tint}`}>
                <div className="relative w-full aspect-[16/9]">
                  <Image
                    src={plan.image}
                    alt={plan.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                </div>
                <div className="p-8 flex flex-col flex-1">
                  <span className={`inline-block w-fit text-xs font-semibold px-3 py-1 rounded-full mb-5 ${plan.badgeTint}`}>
                    {plan.name}
                  </span>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6">{plan.tagline}</p>
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/contact"
                    className="group mt-8 inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                  >
                    Contact Sales
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
