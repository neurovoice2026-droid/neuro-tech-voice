import { cn } from "@/lib/utils";
import { IntentLink } from "@/components/site/intent-link";
import { TYPE } from "@/components/site/home/type";
import type { Check, CheckKind } from "@/lib/pages/custom-saas-platforms";

/* ------------------------------------------------------------------ *
 * How to check a claim, where the claim is made: one line under a
 * credential, a scope part, a build stage or a part on the explorer.
 *
 * The page's argument is that its claims say how they can be checked —
 * now, in this browser; on the call; or in your build — so the line reads
 * the same everywhere: a glyph and a mono tag for when (the kind), then
 * what to do (the label: a link when there is somewhere to go, plain
 * words when it happens on the call), then, if there is one, the path to
 * follow in mono (`how`: "Developer tools → Network → …").
 *
 * PURE. No "use client", no hooks, and only types from the data module,
 * so the server sections (credentials, build) and the client islands
 * (the explorer, the scope instrument) can all import it without the
 * server-only module reaching a client chunk. The kinds' words arrive as
 * a prop (`data.checkKinds`, or the explorer's `data.kinds`), because
 * every word on the page lives in the data module. For the same reason
 * the focus ring is written out here rather than imported: controls.tsx
 * is a client module, and a server component would get a reference to
 * its constant, not the string.
 *
 * THE GLYPHS. Now, in this browser: a filled node, the thing itself.
 * On the call: a hollow node, to be shown. In your build: a dotted ring,
 * what you will hold. Marks, never text: the tick colour on a light
 * (3.4 at its worst, flowing), electric on white (5.70) and on a stage
 * (4.82). #checks draws its own rows but uses the same `CheckGlyph`.
 *
 * THE TONES. `lit` sits on a pearl light and uses only the light's
 * measured tokens (saas.css §2); `white` and `stage` use the landing's.
 * A link is `.home-link` everywhere: violet on white and on a stage, and
 * re-coloured to the light's accent inside `.saas-lit` by saas.css. An
 * in-page `#…` is a plain anchor; a route goes through IntentLink, which
 * prefetches on intent rather than on sight. Every link keeps a 24px
 * target (`min-h-6`).
 * ------------------------------------------------------------------ */

export type CheckTone = "lit" | "white" | "stage";

/** The tag, the words when there is no link, and the path to follow. */
const QUIET: Record<CheckTone, string> = {
  lit: "text-(--saas-dim)",
  white: "text-pp-muted",
  stage: "text-pp-muted",
};

const TEXT: Record<CheckTone, string> = {
  lit: "text-(--saas-text)",
  white: "text-pp-ink",
  stage: "text-pp-ink",
};

const MARK: Record<CheckTone, string> = {
  lit: "text-(--saas-tick)",
  white: "text-(--home-electric)",
  stage: "text-(--home-electric)",
};

/** A focus ring in the ground's ink (on a light, `--pp-ink` is the light's text token). */
const RING = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pp-ink";

/** Eight round dots on a 3.75-radius ring: its circumference, 23.56, cut in eight. */
const DOTS = "0 2.9452";

/** The kind of a check as a 10px mark, in `currentColor`. */
export function CheckGlyph({ kind, className }: { kind: CheckKind; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className={cn("size-2.5 shrink-0 overflow-visible", className)}>
      {kind === "site" ? (
        <circle cx="5" cy="5" r="4" fill="currentColor" />
      ) : kind === "call" ? (
        <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      ) : (
        <circle
          cx="5"
          cy="5"
          r="3.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray={DOTS}
        />
      )}
    </svg>
  );
}

export function CheckLine({
  check,
  kinds,
  tone,
  className,
}: {
  check: Check;
  kinds: Record<CheckKind, string>;
  tone: CheckTone;
  /** Spacing from the block above (`mt-4`, `mt-5`): the line sets none of its own. */
  className?: string;
}) {
  const { href } = check;
  const link = cn("home-link relative inline-flex min-h-6 items-center before:absolute before:inset-x-0 before:-inset-y-2.5", TYPE.body, RING);
  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={cn(TYPE.mono, "inline-flex shrink-0 items-center gap-1.5 uppercase", QUIET[tone])}>
          <CheckGlyph kind={check.kind} className={MARK[tone]} />
          {kinds[check.kind]}
          <span className="sr-only">:</span>
        </span>
        {!href ? (
          <span className={cn(TYPE.body, TEXT[tone])}>{check.label}</span>
        ) : href.startsWith("/") ? (
          <IntentLink href={href} className={link}>
            {check.label}
          </IntentLink>
        ) : (
          <a href={href} className={link}>
            {check.label}
          </a>
        )}
      </p>
      {check.how && <p className={cn(TYPE.mono, "mt-1", QUIET[tone])}>{check.how}</p>}
    </div>
  );
}
