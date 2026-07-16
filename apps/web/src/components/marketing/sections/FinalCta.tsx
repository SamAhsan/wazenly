import Link from "next/link";
import { ArrowRight, ImageIcon } from "lucide-react";
import { Reveal } from "../Reveal";

export function FinalCta() {
  return (
    <section className="bg-white py-4 pb-20 sm:pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-primary/[0.07] border border-primary/10 px-6 py-14 sm:px-12 sm:py-16">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <Reveal>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight text-balance">
                Ready to run WhatsApp like an enterprise?
              </h2>
              <p className="mt-4 text-gray-500 text-lg text-balance">
                Already have access? Sign in below. Otherwise, reach out and we'll get your workspace set up.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/auth/login"
                  className="group inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-600 text-white font-semibold px-6 py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-primary/25 w-full sm:w-auto"
                >
                  Sign In
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 border border-gray-300 hover:bg-white text-gray-700 font-semibold px-6 py-3.5 rounded-xl transition-colors w-full sm:w-auto"
                >
                  Contact Us
                </Link>
              </div>
            </Reveal>

            <Reveal direction="fade">
              <div className="hidden lg:flex rounded-2xl bg-white/60 border border-primary/10 aspect-[4/3] flex-col items-center justify-center gap-2 text-center px-6">
                <ImageIcon className="w-6 h-6 text-primary/40" />
                <p className="text-xs text-gray-400">Photo: team using Wazenly / customer support</p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
