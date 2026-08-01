import { ExternalLink, Phone, Copy } from "lucide-react";
import type { PreviewButton } from "./types";

const BUTTON_ICONS: Record<string, React.ComponentType<{ className?: string }> | null> = {
  QUICK_REPLY: null,
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
};

export function ButtonsRenderer({ buttons }: { buttons: PreviewButton[] }) {
  if (!buttons.length) return null;
  return (
    <div className="border-t border-gray-100">
      {buttons.map((b, i) => {
        const Icon = BUTTON_ICONS[b.type];
        return (
          <div
            key={i}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13.5px] text-[#00A5F4] font-medium ${i > 0 ? "border-t border-gray-100" : ""}`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span className="truncate">{b.text || "Button"}</span>
          </div>
        );
      })}
    </div>
  );
}
