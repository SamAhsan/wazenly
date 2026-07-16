import Image from "next/image";
import { Reveal } from "../Reveal";

const ITEMS = [
  {
    title: "Engage Customers Better",
    description: "Reach customers on the app they already use every day, with 98% open rates and real conversations instead of ignored emails.",
    image: "/Engage customer better.png",
  },
  {
    title: "Empower Your Team",
    description: "A shared inbox with assignment and internal notes means your team works together instead of stepping on each other.",
    image: "/empower your team.png",
  },
  {
    title: "Track What Matters",
    description: "Delivery, read, and reply rates update in real time so you always know what's working.",
    image: "/track what matters.png",
  },
  {
    title: "Scale Without Limits",
    description: "From a single number to multiple companies and workspaces, Wazenly grows with your business.",
    image: "/Scale without limit.png",
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
                <div className="relative w-full aspect-[3/2] bg-gray-50 border-b border-gray-100">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
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
