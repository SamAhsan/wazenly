import { ImageIcon } from "lucide-react";
import { Reveal } from "../Reveal";

const ITEMS = [
  {
    title: "Engage Customers Better",
    description: "Reach customers on the app they already use every day, with 98% open rates and real conversations instead of ignored emails.",
    placeholder: "Photo: customer support agent messaging on WhatsApp",
  },
  {
    title: "Empower Your Team",
    description: "A shared inbox with assignment and internal notes means your team works together instead of stepping on each other.",
    placeholder: "Photo: team collaborating in an office",
  },
  {
    title: "Track What Matters",
    description: "Delivery, read, and reply rates update in real time so you always know what's working.",
    placeholder: "Photo: analytics dashboard on a laptop screen",
  },
  {
    title: "Scale Without Limits",
    description: "From a single number to multiple companies and workspaces, Wazenly grows with your business.",
    placeholder: "Photo: growing business / warehouse or storefront",
  },
];

export function WhyChooseUs() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary mb-3">Why Choose Us</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight text-balance">
              Built for performance, designed for growth
            </h2>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <div className="flat-card hover-lift h-full flex flex-col overflow-hidden">
                <div className="relative w-full aspect-[4/3] bg-gray-50 border-b border-gray-100 flex flex-col items-center justify-center gap-2 px-4 text-center">
                  <ImageIcon className="w-6 h-6 text-gray-300" />
                  <p className="text-[11px] text-gray-400 leading-snug">{item.placeholder}</p>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1.5">{item.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
