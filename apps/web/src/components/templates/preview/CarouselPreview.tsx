import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import type { PreviewButton, PreviewCard } from "./types";
import { HeaderRenderer } from "./HeaderRenderer";
import { ButtonsRenderer } from "./ButtonsRenderer";
import { formatWhatsAppText } from "./formatWhatsAppText";
import { MessageBubble } from "./MessageBubble";

interface CarouselPreviewProps {
  introBody: string;
  introBodyExamples?: Record<string, string>;
  cards: PreviewCard[];
  buttons: PreviewButton[];
}

export function CarouselPreview({ introBody, introBodyExamples, cards, buttons }: CarouselPreviewProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollByCard = (dir: 1 | -1) => scrollerRef.current?.scrollBy({ left: dir * 168, behavior: "smooth" });

  return (
    <div>
      <MessageBubble compact>
        <div className="px-3 py-2.5 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {introBody ? formatWhatsAppText(introBody, introBodyExamples) : <span className="text-gray-300">Your message body will appear here</span>}
        </div>
      </MessageBubble>

      {cards.length > 0 && (
        <div className="relative mt-1.5">
          <div ref={scrollerRef} className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1 [&::-webkit-scrollbar]:hidden">
            {cards.map((card, i) => (
              <div key={i} className="snap-start flex-shrink-0 w-40 bg-white rounded-lg shadow-sm overflow-hidden">
                <HeaderRenderer type={card.headerFormat} mediaSrc={card.mediaSrc} />
                <div className="px-2.5 py-2 text-[12.5px] text-gray-800 leading-snug min-h-[2.5rem]">
                  {card.body ? formatWhatsAppText(card.body, card.bodyExamples) : <span className="text-gray-300">Card body…</span>}
                </div>
                <ButtonsRenderer buttons={buttons} />
              </div>
            ))}
          </div>
          {cards.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => scrollByCard(-1)}
                className="hidden sm:flex absolute -left-3 top-1/3 w-6 h-6 rounded-full bg-white shadow items-center justify-center"
                aria-label="Previous card"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
              </button>
              <button
                type="button"
                onClick={() => scrollByCard(1)}
                className="hidden sm:flex absolute -right-3 top-1/3 w-6 h-6 rounded-full bg-white shadow items-center justify-center"
                aria-label="Next card"
              >
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
