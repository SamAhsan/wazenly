"use client";

import { useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";

export function FaqAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <Collapsible.Root
            key={item.question}
            open={isOpen}
            onOpenChange={(open) => setOpenIndex(open ? i : null)}
            className="neu-card overflow-hidden"
          >
            <Collapsible.Trigger asChild>
              <button className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-left">
                <span className="text-sm sm:text-base font-semibold text-gray-900">{item.question}</span>
                <ChevronDown className={`w-5 h-5 flex-shrink-0 text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </Collapsible.Trigger>
            <Collapsible.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
              <p className="px-5 sm:px-6 pb-4 sm:pb-5 text-sm text-gray-500 leading-relaxed">{item.answer}</p>
            </Collapsible.Content>
          </Collapsible.Root>
        );
      })}
    </div>
  );
}
