"use client";

import { useState } from "react";
import { Smartphone, Monitor, ChevronLeft, Phone, Video, MoreVertical } from "lucide-react";
import type { PreviewTemplate } from "./types";
import { HeaderRenderer } from "./HeaderRenderer";
import { ButtonsRenderer } from "./ButtonsRenderer";
import { CarouselPreview } from "./CarouselPreview";
import { MessageBubble } from "./MessageBubble";
import { formatWhatsAppText } from "./formatWhatsAppText";

const SAMPLE_OTP = "482913";

export function TemplatePreview({ template }: { template: PreviewTemplate }) {
  const [view, setView] = useState<"mobile" | "desktop">("mobile");
  const businessName = template.businessName || "Your Business";
  const isDesktop = view === "desktop";

  const isAuth = template.category === "AUTHENTICATION";
  const isCarousel = !isAuth && template.headerType === "CAROUSEL";

  // Authentication (OTP) templates ignore whatever header/footer/buttons are
  // configured -- Meta forces a fixed body + a single Copy Code button for
  // this category, so the preview reflects that reality instead of the form.
  const authBody = `*${SAMPLE_OTP}* is your verification code. For your security, do not share this code.`;
  const authButtons = [{ type: "COPY_CODE" as const, text: "Copy Code" }];

  return (
    <div>
      <div className="flex justify-end gap-1 mb-3">
        <button
          type="button"
          onClick={() => setView("mobile")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${view === "mobile" ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}`}
        >
          <Smartphone className="w-3.5 h-3.5" /> Mobile
        </button>
        <button
          type="button"
          onClick={() => setView("desktop")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${view === "desktop" ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}`}
        >
          <Monitor className="w-3.5 h-3.5" /> Desktop
        </button>
      </div>

      <div className={`mx-auto bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200 ${isDesktop ? "max-w-md" : "max-w-xs"}`}>
        {/* WhatsApp header bar */}
        <div
          className={`flex items-center gap-2.5 px-3 py-2.5 ${isDesktop ? "bg-[#F0F2F5] text-gray-900" : "bg-[#008069] text-white"}`}
        >
          {!isDesktop && <ChevronLeft className="w-5 h-5 flex-shrink-0" />}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-xs ${isDesktop ? "bg-gray-300 text-gray-600" : "bg-white/20 text-white"}`}>
            {businessName.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{businessName}</p>
            <p className={`text-[11px] ${isDesktop ? "text-gray-500" : "text-white/80"}`}>Business Account</p>
          </div>
          <Video className="w-4 h-4 flex-shrink-0 opacity-90" />
          <Phone className="w-4 h-4 flex-shrink-0 opacity-90" />
          <MoreVertical className="w-4 h-4 flex-shrink-0 opacity-90" />
        </div>

        {/* Chat area */}
        <div className="bg-[#E5DDD5] px-3 py-4" style={{ minHeight: isDesktop ? 280 : 340 }}>
          {isAuth ? (
            <MessageBubble buttons={<ButtonsRenderer buttons={authButtons} />}>
              <div className="px-3 py-2.5 text-sm text-gray-800 leading-relaxed">{formatWhatsAppText(authBody)}</div>
            </MessageBubble>
          ) : isCarousel ? (
            <CarouselPreview introBody={template.body} introBodyExamples={template.bodyExamples} cards={template.cards || []} buttons={template.buttons} />
          ) : (
            <MessageBubble buttons={<ButtonsRenderer buttons={template.buttons} />}>
              <HeaderRenderer type={template.headerType} headerText={template.headerText} mediaSrc={template.mediaSrc} documentFileName={template.documentFileName} bodyExamples={template.bodyExamples} />
              <div className="px-3 py-2.5 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {template.body ? formatWhatsAppText(template.body, template.bodyExamples) : <span className="text-gray-300">Your message body will appear here</span>}
              </div>
              {template.footer && <div className="px-3 pb-2 text-xs text-gray-400">{template.footer}</div>}
            </MessageBubble>
          )}
        </div>
      </div>

      {isAuth && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          Authentication templates use Meta&apos;s fixed one-time-passcode format — header, footer, and custom buttons aren&apos;t configurable.
        </p>
      )}
    </div>
  );
}
