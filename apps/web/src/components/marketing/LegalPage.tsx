import { Reveal } from "./Reveal";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <section className="bg-white pt-8 pb-4 sm:pt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-[#0B3D2E] px-6 py-14 sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
              <div className="absolute -top-20 left-1/3 w-[22rem] h-[22rem] rounded-full bg-primary/20 blur-[110px]" />
            </div>
            <div className="relative max-w-3xl mx-auto text-center">
              <Reveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">{title}</h1>
                <p className="mt-4 text-sm text-white/40">Last updated: {updated}</p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-white py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <Reveal>
            <div className="prose-legal space-y-10">{children}</div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
      <div className="text-sm sm:text-[15px] text-gray-500 leading-relaxed space-y-3">{children}</div>
    </div>
  );
}
