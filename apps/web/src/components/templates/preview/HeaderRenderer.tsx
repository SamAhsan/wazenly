import { Image as ImageIcon, Play, FileText, MapPin } from "lucide-react";
import type { PreviewTemplate } from "./types";
import { formatWhatsAppText } from "./formatWhatsAppText";

type HeaderProps = Pick<PreviewTemplate, "headerText" | "mediaSrc" | "documentFileName" | "bodyExamples">;

// One entry per header type -- adding a future header type (e.g. a new Meta
// product type) means adding one entry here, nothing else in the preview
// system needs to change.
const HEADER_RENDERERS: Record<string, (p: HeaderProps) => React.ReactNode> = {
  NONE: () => null,

  TEXT: (p) =>
    p.headerText ? (
      <div className="px-3 pt-3 text-[15px] font-semibold text-gray-900 leading-snug">
        {formatWhatsAppText(p.headerText, p.bodyExamples)}
      </div>
    ) : null,

  IMAGE: (p) => (
    <div className="overflow-hidden">
      {p.mediaSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob/object URL preview, not a static asset
        <img src={p.mediaSrc} alt="" className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gray-200 flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-gray-400" />
        </div>
      )}
    </div>
  ),

  VIDEO: () => (
    <div className="w-full h-40 bg-gray-900 flex items-center justify-center relative">
      <div className="w-12 h-12 rounded-full bg-white/25 flex items-center justify-center">
        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
      </div>
    </div>
  ),

  DOCUMENT: (p) => (
    <div className="m-2 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
      <div className="w-9 h-11 bg-red-100 rounded flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-red-500" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-800 truncate">{p.documentFileName || "Document"}</p>
        <p className="text-xs text-gray-400">PDF</p>
      </div>
    </div>
  ),

  LOCATION: () => (
    <div className="w-full h-40 bg-[#E8ECEF] relative overflow-hidden">
      <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#B9C2C8" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <MapPin className="w-9 h-9 text-red-500 fill-red-500/20 drop-shadow" />
      </div>
    </div>
  ),
};

export function HeaderRenderer({ type, ...rest }: HeaderProps & { type: string }) {
  const render = HEADER_RENDERERS[type];
  return render ? <>{render(rest)}</> : null;
}
