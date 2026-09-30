import {
  Activity,
  Bell,
  BellRing,
  Braces,
  CalendarClock,
  CalendarDays,
  Camera,
  CreditCard,
  Database,
  FileText,
  Fingerprint,
  KeyRound,
  MapPin,
  MessageSquareText,
  Navigation,
  Paperclip,
  RadioTower,
  ScanLine,
  ShoppingBag,
  Wallet,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/components/site/home/type";
import { CheckGlyph } from "@/components/site/solutions/custom-saas-platforms/check-line";
import type { FeatureId, PartId, PartKind } from "@/lib/pages/custom-mobile-applications";

/* ------------------------------------------------------------------ *
 * The page's marks: one glyph per part an app talks to, one per thing
 * an app asks of the phone, and the tag that says whether a part runs
 * on this platform already.
 *
 * The page's argument is that every app, whatever it does, talks to the
 * same nine parts behind it, and that eight of them already run here.
 * So a part looks the same wherever it appears: a card on #hold's
 * drawing, a row of its lane, a chip under the phone, a row in a #kinds
 * sample, a card in #server's night room. A phone feature looks the
 * same in a #kinds sample and in its index. The glyph is never the only
 * sign of either; the part's or the feature's label always sits beside
 * it in words, so every glyph here is aria-hidden.
 *
 * THE DRAWING. Lucide's line icons at 14px and a 1.75 stroke, as the
 * Automations page draws its block kinds, a touch finer than lucide's
 * own 2 so they sit with 11–13px labels without outweighing them, in
 * `currentColor`: the caller sets the colour for its ground (electric on
 * white, 5.70, and on the stage, 4.82; lilac on the night room;
 * `--saas-tick` on a pearl light: marks, over the 3:1 a mark needs).
 * Chosen for what a founder would read into them, not for the code
 * behind them: a key for signing in, braces for the API, a card for
 * payments, a paperclip for files, a mast for a live connection, a
 * calendar with a clock for the jobs that run on one, a bell ringing for
 * push. A feature's glyph is the thing on the phone: a camera, a
 * scanner's line, a pin, an arrow that follows the road with the phone
 * locked, a bell, no signal, a fingerprint, a wallet, a bag.
 *
 * THE KIND TAG. Whether a part runs here, in words, with the check
 * glyph the page already uses for it (check-line.tsx): "Runs here" with
 * the filled node, the thing itself; "Built for yours" with the dotted
 * ring, what you will hold. Filled against dotted, so the answer never
 * rests on colour. The words are the caller's (`copy`: the data
 * module's `kinds` or `ours`), because every word on the page lives in
 * the data module. On white and on the stage "Runs here" is settled
 * green (5.50 on white, 4.65 on the stage) and "Built for yours" violet
 * (7.10, 6.01); on a pearl light, where only the light's measured tokens
 * are text, they are its text and its accent. The glyph takes the
 * words' colour. A reader hears the words only; a caller that sets the
 * tag after a label adds its own sr-only separator, as the Automations
 * legend does.
 *
 * `.mob-glyph` and `.mob-tag` (mob.css §2) keep a glyph and a tag their
 * full size beside a label long enough to wrap, and keep a tag's glyph
 * on its words' line; under forced colours a glyph takes its line's
 * system colour (mob.css §3). Any other size or alignment is the
 * caller's, through `className`.
 *
 * PURE. No "use client" and no hooks, and only types from the data
 * module, so a server section (#server) and the client islands (the
 * phone's stage, #kinds) can all import it without the server-only
 * module reaching a client chunk.
 * ------------------------------------------------------------------ */

const PART_ICON: Record<PartId, LucideIcon> = {
  signin: KeyRound,
  api: Braces,
  data: Database,
  payments: CreditCard,
  files: Paperclip,
  live: RadioTower,
  jobs: CalendarClock,
  messages: MessageSquareText,
  push: BellRing,
};

const FEATURE_ICON: Record<FeatureId, LucideIcon> = {
  camera: Camera,
  scan: ScanLine,
  location: MapPin,
  background: Navigation,
  push: Bell,
  offline: WifiOff,
  biometric: Fingerprint,
  wallet: Wallet,
  purchase: ShoppingBag,
  calendar: CalendarDays,
  files: FileText,
  live: Activity,
};

/** The size and stroke every glyph here is drawn at. */
const GLYPH = { size: 14, strokeWidth: 1.75 } as const;

/** A part's mark, in `currentColor`. Always beside the part's label in words. */
export function PartGlyph({ id, className }: { id: PartId; className?: string }) {
  const Icon = PART_ICON[id];
  return <Icon aria-hidden {...GLYPH} className={cn("mob-glyph", className)} />;
}

/** A phone feature's mark, in `currentColor`. Always beside the feature's label in words. */
export function FeatureGlyph({ id, className }: { id: FeatureId; className?: string }) {
  const Icon = FEATURE_ICON[id];
  return <Icon aria-hidden {...GLYPH} className={cn("mob-glyph", className)} />;
}

/** The ground a kind tag sits on: white (and a white card inside a light), the `#hold` stage, or a pearl light. */
export type KindTagTone = "white" | "lit" | "stage";

const KIND_TONE: Record<KindTagTone, Record<PartKind, string>> = {
  white: { does: "text-(--home-settled)", none: "text-(--home-violet)" },
  stage: { does: "text-(--home-settled)", none: "text-(--home-violet)" },
  lit: { does: "text-(--saas-text)", none: "text-(--saas-accent)" },
};

/** Whether a part runs here: the check glyph for it and the words, in mono capitals. */
export function KindTag({
  kind,
  copy,
  tone,
  className,
}: {
  kind: PartKind;
  /** The words for each kind: "Runs here", "Built for yours". */
  copy: Record<PartKind, string>;
  tone: KindTagTone;
  className?: string;
}) {
  return (
    <span className={cn(TYPE.mono, "mob-tag inline-flex items-center gap-1.5 uppercase", KIND_TONE[tone][kind], className)}>
      <CheckGlyph kind={kind === "does" ? "site" : "handover"} className="mob-glyph" />
      {copy[kind]}
    </span>
  );
}
