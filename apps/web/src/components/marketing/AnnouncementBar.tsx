"use client";

import { useState } from "react";
import { TrendingUp, X } from "lucide-react";

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="bg-primary text-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-9 flex items-center justify-center gap-2 relative text-xs sm:text-sm font-medium">
        <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-center">
          WhatsApp messages see <strong className="font-bold">98% open rates</strong> — built on the official Meta API, not a workaround.
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-4 sm:right-8 p-0.5 hover:bg-white/20 rounded-full transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
