import { Fragment } from "react";

// Mirrors WhatsApp's own lightweight formatting (*bold*, _italic_, ~strike~)
// plus this app's {{n}} variable placeholders -- substituted with the given
// sample value (rendered bold, like WhatsApp does for resolved values) or
// left as a highlighted unresolved placeholder when no sample is set yet.
export function formatWhatsAppText(text: string, examples?: Record<string, string>): React.ReactNode {
  const substituted = text.replace(/\{\{(\d+)\}\}/g, (match, n: string) => {
    const value = examples?.[n];
    return value ? `*${value}*` : match;
  });

  const tokenPattern = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|\{\{\d+\}\})/g;
  const parts = substituted.split(tokenPattern).filter((p) => p !== "");

  return (
    <>
      {parts.map((part, i) => {
        if (/^\*[^*\n]+\*$/.test(part)) return <strong key={i}>{part.slice(1, -1)}</strong>;
        if (/^_[^_\n]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
        if (/^~[^~\n]+~$/.test(part)) return <span key={i} className="line-through">{part.slice(1, -1)}</span>;
        if (/^\{\{\d+\}\}$/.test(part)) return <span key={i} className="bg-amber-100 text-amber-700 px-1 rounded">{part}</span>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
