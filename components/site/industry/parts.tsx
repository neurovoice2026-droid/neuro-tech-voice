import type { Plan } from "@/types";
import type { VoiceToolName } from "@/lib/voice/contracts";
import { gateFor } from "@/lib/pages/industries/schema";

/* ------------------------------------------------------------------ *
 * Shared pieces of the industry pages.
 *
 * Two inks beyond the product palette, and both are semantic rather than
 * decorative. `EMBER` is urgency and is allowed only on the trades whose
 * system prompt defines a real emergency. `SETTLED` is confirmation and
 * is allowed only where something on the call is genuinely confirmed —
 * which is why the law, insurance, real-estate and financial-services
 * pages carry no green at all. On those calls nothing is confirmed, and
 * the missing colour is the page telling the truth rather than a gap.
 *
 * A sixteen-palette site stops being one site, so the trade's identity
 * is never a new hue: violet stays the product's hand on all sixteen.
 * ------------------------------------------------------------------ */

export const EMBER = "#e0663a";
export const SETTLED = "#1f8a55";

/**
 * Ember, dark enough to be read at label size.
 *
 * `EMBER` is a stroke and a headline colour: on white it clears 3:1, which
 * is the bar for large text and for a graphic, and it is the warmer of the
 * two. At 11px in a tracked uppercase label it comes out at 3.42:1 and
 * fails, so anything set smaller than 18px uses this instead — 5.05:1, the
 * same hue two steps down.
 */
export const EMBER_INK = "#bd4a1c";

const PLAN_LABEL: Record<Plan, string> = {
  trial: "Trial",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  custom: "Custom",
};

/**
 * The gate on a field, derived from the tool that produced it.
 *
 * Nothing here is typed per trade: a field names a real tool, the tool
 * needs a capability, the capability needs a plan or a connection. It is
 * structurally impossible for a page to show a booking without also
 * showing that booking needs a calendar connected.
 */
export function Gate({ tool, className }: { tool: VoiceToolName; className?: string }) {
  const gate = gateFor(tool);
  if (!gate) return null;
  const parts = [gate.plan ? PLAN_LABEL[gate.plan] : null, gate.setup].filter(Boolean);
  return (
    <span
      className={`text-[11px] leading-4 font-medium tracking-[0.06em] text-pp-muted uppercase ${className ?? ""}`}
    >
      {parts.join(" · ")}
    </span>
  );
}

/** The tool's own name, printed as the tool log prints it. */
export function ToolName({ tool, className }: { tool: VoiceToolName; className?: string }) {
  return (
    <span className={`font-[family-name:var(--font-geist-mono)] text-[11px] tracking-[0.02em] ${className ?? ""}`}>
      {tool}
    </span>
  );
}

/**
 * A figure we worked out rather than one we found published — always
 * shown with its reasoning, never as a bare statistic. Every vendor
 * number in this category that we checked dissolved on contact with its
 * source, so ours are labelled as ours and the reader is invited to
 * check their own call log instead of taking them.
 */
export function OurEstimate({ value, reasoning }: { value: string; reasoning: string }) {
  return (
    <div className="max-w-[420px]">
      <p className="text-[19px] leading-7 tracking-[-0.01em] text-pp-ink md:text-[21px] md:leading-8">{value}</p>
      <p className="mt-2 text-[13px] leading-5 text-pp-muted">
        <span className="text-pp-accent">Our figure, not a study.</span> {reasoning}
      </p>
    </div>
  );
}
