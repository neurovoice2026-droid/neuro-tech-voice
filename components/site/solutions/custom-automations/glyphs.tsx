import {
  Clock,
  Diamond,
  Hand,
  Hourglass,
  ListChecks,
  PenLine,
  RotateCw,
  ScanText,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserRound,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockKind } from "@/lib/pages/custom-automations";

/* ------------------------------------------------------------------ *
 * The block kinds as marks: one glyph per kind of block every flow on
 * the page is built from, the platform's and the samples' alike.
 *
 * The page's argument is that any automation, however hard, is made of
 * the same thirteen blocks, so a kind looks the same wherever it
 * appears: a card on the workbench's map, a row in its list, a block in
 * a #work sample, a line of that sample's legend, a lane in #breaks. The
 * glyph is never the only sign of the kind; its tag (`KINDS[kind].tag`,
 * "Retries", "A person") always sits beside it in words, so the glyph is
 * aria-hidden everywhere.
 *
 * THE DRAWING. Lucide's line icons at 14px and a 1.75 stroke, a touch
 * finer than lucide's own 2 so they sit with 10–13px mono tags without
 * outweighing them, in `currentColor`: the caller sets the colour for
 * its ground. On white and on a stage it is the landing's electric
 * (5.70 on white, 4.82 on the stage: marks, over the 3:1 a mark needs);
 * on the night room, lilac; on a pearl light, `--saas-tick`. Chosen for
 * what an operations manager would read into them, not for the code
 * behind them: a bolt for what starts a run, a clock for a schedule, a
 * diamond for a rule (the flowchart's decision), a shield for "never
 * twice", a turning arrow for a retry, an hourglass for a wait, a person
 * for a person told, a person with a tick for an approval.
 *
 * `.auto-kind` (auto.css §1) keeps a glyph its full size beside a label
 * long enough to wrap. Any other size or alignment is the caller's,
 * through `className`.
 *
 * PURE. No "use client" and no hooks, and only the `BlockKind` type from
 * the data module, so a server section (the ledger) and the client
 * islands (the workbench, #work, #breaks) can all import it without the
 * server-only module reaching a client chunk. Lucide's icons are client
 * components; a server section rendering one renders it in place, as the
 * landing's #trust (a server component) renders its ticks.
 * ------------------------------------------------------------------ */

const KIND_ICON: Record<BlockKind, LucideIcon> = {
  when: Zap,
  time: Clock,
  read: ScanText,
  ai: Sparkles,
  rule: Diamond,
  once: ShieldCheck,
  write: PenLine,
  send: Send,
  retry: RotateCw,
  wait: Hourglass,
  person: UserRound,
  approve: UserCheck,
  log: ListChecks,
};

/** The size and stroke every glyph here is drawn at. */
const GLYPH = { size: 14, strokeWidth: 1.75 } as const;

/** A block kind's mark, in `currentColor`. Always beside the kind's tag in words. */
export function KindGlyph({ kind, className }: { kind: BlockKind; className?: string }) {
  const Icon = KIND_ICON[kind];
  return <Icon aria-hidden {...GLYPH} className={cn("auto-kind", className)} />;
}

/** "By hand": the lane of steps a person does. Beside the lane's label in words. */
export function HandGlyph({ className }: { className?: string }) {
  return <Hand aria-hidden {...GLYPH} className={cn("auto-kind", className)} />;
}

/** "By itself": the flow that does them. Beside the lane's label in words. */
export function FlowGlyph({ className }: { className?: string }) {
  return <Workflow aria-hidden {...GLYPH} className={cn("auto-kind", className)} />;
}
