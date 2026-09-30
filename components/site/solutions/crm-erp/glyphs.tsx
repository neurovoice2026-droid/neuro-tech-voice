import {
  BellRing,
  Boxes,
  Calculator,
  CalendarCheck,
  CalendarClock,
  ChartColumn,
  ChartLine,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Hand,
  Inbox,
  ListChecks,
  MessageSquareText,
  Package,
  Receipt,
  Truck,
  UserRound,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import { CheckGlyph } from "@/components/site/solutions/custom-saas-platforms/check-line";
import type { CheckKind, CoreId, Kind, LaneId, StepId } from "@/lib/pages/crm-erp";

/* ------------------------------------------------------------------ *
 * The page's marks: one glyph per step a customer's order passes
 * through, one per part of a CRM this platform runs, one per lane of who
 * does the work, the hand that marks work done twice, and the tag that
 * says whether a part runs on this platform already.
 *
 * The page's argument is that any CRM or ERP, whatever the business, is
 * the same few steps drawn around one customer's record, and that most
 * of the hard parts under them already run here. So a step looks the
 * same wherever it appears: a card or a paper on #process's lanes, a row
 * of its list, the rail, the index. A part looks the same on a #core
 * card and in its index; a lane the same in the caption's chip and on
 * the drawing. The glyph is never the only sign of any of them; its
 * label always sits beside it in words, so every glyph here is
 * aria-hidden.
 *
 * THE DRAWING. Lucide's line icons at 14px and a 1.75 stroke, as the
 * Automations and Mobile pages draw theirs, a touch finer than lucide's
 * own 2 so they sit with 11–13px labels without outweighing them, in
 * `currentColor`: the caller sets the colour for its ground (electric on
 * white, 5.70, and on the stage, 4.82; lilac on the night room; ember
 * for the hand; `--saas-tick` on a pearl light: marks, over the 3:1 a
 * mark needs). Chosen for what an owner would read into them, not for
 * the code behind them. A step's glyph is the thing it happens in: an
 * inbox for the enquiry, a document for the quote, a bell for the
 * follow-up, a ticked board for the order, boxes for the stock, a truck
 * for the delivery, a receipt for the invoice, a column chart for the
 * report. A part's is what it keeps: a person for the customer's
 * history, a ticked list for the details asked for, a calendar with a
 * tick for bookings, a speech bubble for messages, a parcel for what is
 * built for yours, a receipt for invoicing, a calendar with a clock for
 * usage counted by the period, a line chart for reports, a sheet for
 * exports. A lane's is who works it: people for sales, the truck for
 * operations, a calculator for accounts, the flow for what runs by
 * itself.
 *
 * THE KIND TAG. Whether a part runs here, in words, with the check
 * glyph the page already uses for it (check-line.tsx), and a third kind
 * the siblings never needed: "Runs here" with the filled node, the thing
 * itself; "Partly here" with the hollow node, there but thin (on this
 * platform a customer is their phone number); "Built for yours" with the
 * dotted ring, what you will hold. Filled, hollow and dotted, so the
 * answer never rests on colour. The words are the caller's (`copy`: the
 * data module's `kinds`), because every word on the page lives in the
 * data module; a caller whose rows never say "Built for yours" (#shape's
 * parts) hands only the two it uses. On white and on the stage "Runs
 * here" is settled green (5.50 on white, 4.65 at the stage's worst),
 * "Partly here" muted (6.37, 5.39) and "Built for yours" violet (7.10,
 * 6.01); on a pearl light, where only the light's measured tokens are
 * text, they are its text, its dim and its accent. The glyph takes the
 * words' colour. A reader hears the words only; a caller that sets the
 * tag after a label adds its own sr-only separator, as the Automations
 * legend does.
 *
 * `.erp-glyph` and `.erp-tag` (erp.css §2) keep a glyph and a tag their
 * full size beside a label long enough to wrap, and keep a tag's glyph
 * on its words' line; under forced colours a glyph takes its line's
 * system colour (erp.css §3). Any other size or alignment is the
 * caller's, through `className`.
 *
 * PURE. No "use client" and no hooks, and only types from the data
 * module, so a server section (#core, its cards and its index) and the
 * client islands (#process's stage, #shape) can all import it without
 * the server-only module reaching a client chunk. Lucide's icons are
 * client components; a server section rendering one renders it in
 * place, as the landing's #trust renders its ticks.
 * ------------------------------------------------------------------ */

const STEP_ICON: Record<StepId, LucideIcon> = {
  enquiry: Inbox,
  quote: FileText,
  followup: BellRing,
  order: ClipboardCheck,
  stock: Boxes,
  delivery: Truck,
  invoice: Receipt,
  report: ChartColumn,
};

const CORE_ICON: Record<CoreId, LucideIcon> = {
  history: UserRound,
  fields: ListChecks,
  bookings: CalendarCheck,
  messages: MessageSquareText,
  yours: Package,
  invoicing: Receipt,
  usage: CalendarClock,
  reports: ChartLine,
  exports: FileSpreadsheet,
};

const LANE_ICON: Record<LaneId, LucideIcon> = {
  sales: Users,
  ops: Truck,
  accounts: Calculator,
  auto: Workflow,
};

/** The size and stroke every glyph here is drawn at. */
const GLYPH = { size: 14, strokeWidth: 1.75 } as const;

/** A step's mark, in `currentColor`. Always beside the step's label in words. */
export function StepGlyph({ id, className }: { id: StepId; className?: string }) {
  const Icon = STEP_ICON[id];
  return <Icon aria-hidden {...GLYPH} className={cn("erp-glyph", className)} />;
}

/** A part's mark, in `currentColor`. Always beside the part's title in words. */
export function CoreGlyph({ id, className }: { id: CoreId; className?: string }) {
  const Icon = CORE_ICON[id];
  return <Icon aria-hidden {...GLYPH} className={cn("erp-glyph", className)} />;
}

/** A lane's mark, in `currentColor`. Always beside the lane's label in words. */
export function LaneGlyph({ id, className }: { id: LaneId; className?: string }) {
  const Icon = LANE_ICON[id];
  return <Icon aria-hidden {...GLYPH} className={cn("erp-glyph", className)} />;
}

/** "Typed again", "Counted by hand": a hand-off done by hand. Beside the mark's words. */
export function HandGlyph({ className }: { className?: string }) {
  return <Hand aria-hidden {...GLYPH} className={cn("erp-glyph", className)} />;
}

/** The ground a kind tag sits on: white (and a white card inside a light or the night room), #process's stage, or a pearl light. */
export type ErpTagTone = "white" | "stage" | "lit";

const KIND_TONE: Record<ErpTagTone, Record<Kind, string>> = {
  white: { does: "text-(--home-settled)", thin: "text-(--home-muted)", none: "text-(--home-violet)" },
  stage: { does: "text-(--home-settled)", thin: "text-(--home-muted)", none: "text-(--home-violet)" },
  lit: { does: "text-(--saas-text)", thin: "text-(--saas-dim)", none: "text-(--saas-accent)" },
};

/** Each kind's check glyph: the thing itself, there but thin, what you will hold. */
const KIND_GLYPH: Record<Kind, CheckKind> = { does: "site", thin: "call", none: "handover" };

/** Whether a part runs here: the check glyph for it and the words, in mono capitals. */
export function ErpTag({
  kind,
  copy,
  tone,
  className,
}: {
  kind: Kind;
  /** The words for each kind: "Runs here", "Partly here", "Built for yours" (at least the one `kind` names). */
  copy: Partial<Record<Kind, string>>;
  tone: ErpTagTone;
  className?: string;
}) {
  return (
    <span className={cn(TYPE.mono, "erp-tag inline-flex items-center gap-1.5 uppercase", KIND_TONE[tone][kind], className)}>
      <CheckGlyph kind={KIND_GLYPH[kind]} className="erp-glyph" />
      {copy[kind]}
    </span>
  );
}
