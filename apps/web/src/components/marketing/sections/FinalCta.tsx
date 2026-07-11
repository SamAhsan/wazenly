import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "../Reveal";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#0f1117] py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] rounded-full bg-primary/10 blur-[140px]" />
      </div>
      <div className="relative max-w-3xl mx-auto px-5 sm:px-8 text-center">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight text-balance">
            Ready to run WhatsApp like an enterprise?
          </h2>
          <p className="mt-4 text-white/50 text-lg text-balance">
            Already have access? Sign in below. Otherwise, reach out and we'll get your workspace set up.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/auth/login"
              className="group inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-600 text-white font-semibold px-6 py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-primary/25 w-full sm:w-auto"
            >
              Sign In
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 glass-dark text-white font-semibold px-6 py-3.5 rounded-xl transition-colors hover:bg-white/10 w-full sm:w-auto"
            >
              Contact Us
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
