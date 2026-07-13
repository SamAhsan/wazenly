import { Reveal } from "./Reveal";

export function ProductVideo({
  title = "See why Wazenly is built different",
  description = "A quick walkthrough of how campaigns, the shared inbox, and automation come together — and why it's the smarter way to run WhatsApp marketing on the official Meta API.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
        <Reveal>
          <p className="text-sm font-semibold text-primary mb-3">See It In Action</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight text-balance mb-4">{title}</h2>
          <p className="text-gray-500 text-lg text-balance mb-10 max-w-2xl mx-auto">{description}</p>
        </Reveal>
        <Reveal direction="fade">
          <div className="rounded-2xl border-4 border-primary overflow-hidden shadow-xl shadow-primary/15">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video autoPlay muted loop playsInline controls className="w-full aspect-video bg-black">
              <source src="/wazenly-product-demo.mp4" type="video/mp4" />
            </video>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
