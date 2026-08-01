import { CheckCheck } from "lucide-react";

// Real WhatsApp order: header/body/footer content, then the timestamp +
// read-receipt inline at the bottom of that same content, THEN any buttons
// as separate full-width rows below -- buttons are not part of the timed
// message bubble itself.
export function MessageBubble({ children, buttons, compact = false }: { children: React.ReactNode; buttons?: React.ReactNode; compact?: boolean }) {
  return (
    <div className="relative">
      <div className={`bg-white rounded-lg shadow-sm overflow-hidden ${compact ? "" : "rounded-tl-none"}`}>
        {children}
        <div className="flex items-center justify-end gap-1 px-2.5 pb-1.5 -mt-1">
          <span className="text-[10.5px] text-gray-400">9:41 AM</span>
          <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
        </div>
        {buttons}
      </div>
      {!compact && (
        <div className="absolute -left-1.5 top-0 w-3 h-3 overflow-hidden">
          <div className="w-3 h-3 bg-white rotate-45 origin-top-left" />
        </div>
      )}
    </div>
  );
}
