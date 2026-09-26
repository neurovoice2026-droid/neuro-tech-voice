import type { KbDocKind } from "@/lib/pages/knowledge-base";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Small pieces the knowledge-base page repeats.
 * ------------------------------------------------------------------ */

/**
 * The page's orb palette: ink violet into paper — the colours of a marked
 * page — in the mesh orb's slot order (deep low right … light upper left).
 */
export const KB_MESH = ["#3b1a6e", "#7b4fd0", "#c7a8f0", "#f2c6a0", "#fff6ec"] as const;

const KIND_STYLE: Record<KbDocKind, string> = {
  PDF: "bg-[#fbe9e4] text-[#a2391c]",
  DOCX: "bg-[#e6ecfb] text-[#2d4f9e]",
  MD: "bg-[#ecebf1] text-[#3b3a45]",
  TXT: "bg-[#eef3e6] text-[#3f6a24]",
  URL: "bg-[#efe7f8] text-[#551a89]",
};

/** A file's type, as a small coloured tab. */
export function DocBadge({ kind, small = false }: { kind: KbDocKind; small?: boolean }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md font-medium tracking-[0.04em]",
        small ? "h-4 min-w-7 px-1 text-[8.5px]" : "h-6 min-w-9 px-1.5 text-[10px]",
        KIND_STYLE[kind],
      )}
    >
      {kind === "URL" ? "WEB" : kind}
    </span>
  );
}
