import { Reveal } from "./Reveal";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <section className="bg-[#0f1117] pt-20 pb-14 sm:pt-28 sm:pb-16">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
          <Reveal>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">{title}</h1>
            <p className="mt-4 text-sm text-white/40">Last updated: {updated}</p>
          </Reveal>
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
