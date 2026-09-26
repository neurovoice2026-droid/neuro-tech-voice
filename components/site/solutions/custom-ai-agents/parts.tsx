import type { ReactNode } from "react";
import type { Seg, Status, Turn } from "@/lib/pages/custom-ai-agents";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Shared pieces of /solutions/custom-ai-agents.
 *
 * Five instruments on this page are built by different hands, and the
 * page only reads as one argument if they speak one visual grammar: the
 * same node for "a step", the same violet for "the product acting", the
 * same dotted line for "built for you", the same way a transcript is
 * set. So the grammar lives here, once, and every section borrows it.
 *
 * NO "use client", AND NO HOOKS. Everything below is a pure function of
 * its props, which makes it safe on both sides of the boundary: the
 * still Handover and the server-rendered Band can use a Node or a Legend
 * without dragging a client island in with them, and the client
 * instruments get the same markup the server painted.
 *
 * Types only from the data module. It is `server-only`; an `import type`
 * is erased at compile time, so nothing of it (and none of the supplier
 * strings it reads) can reach a browser chunk through this file.
 *
 * COLOUR, restated because it is the page's law rather than taste:
 *   · black is the platform today — a solid line, an inked node;
 *   · violet #551a89 is the product acting, and on this page also "built
 *     for you" — dotted when it is work done on the build;
 *   · green #1f8a55 (marks) / #1f6b3f (words) is a test that genuinely
 *     held, and nothing else. #1f6b3f because the dot colour at 11px on
 *     white would not clear 4.5:1; the darker step does;
 *   · muted #6b6878 is "not yet" — a hollow node, a label at rest.
 * No ember anywhere: nothing on this page is an emergency.
 * ------------------------------------------------------------------ */

/** The violet of the product's hand, as a literal for the few places a
 *  Tailwind token cannot reach (inline SVG strokes, arbitrary borders). */
export const VIOLET = "#551a89";
/** Green for a mark on a test that held. */
export const HELD = "#1f8a55";
/** Green for words on a test that held — the dot colour, dark enough to read at 11px. */
export const HELD_INK = "#1f6b3f";

/**
 * A reservation stack: the live variant laid over every variant.
 *
 * Each instrument swaps text — a draft, a caption, an aside — and nothing
 * below it may move when it does. Measuring the tallest variant would
 * need a layout effect and a first frame at the wrong height; laying
 * every variant into the same grid cell costs nothing and is right on
 * the server's first paint. The cell is as tall as its tallest child, at
 * every width, without a line of JavaScript.
 *
 * The sizers are `invisible` (they still take space), `aria-hidden` (a
 * screen reader hears the live copy once, not seven times) and `inert`:
 * a sizer may contain a button or a link, and an invisible control that
 * still takes Tab focus is a trap.
 *
 * `swap` re-keys the live cell on every change so it lands with the
 * house `ind-swap` rise; pass `swap={false}` where a section animates the
 * change itself and a second entrance would double it.
 */
export function Stack<T>({
  items,
  live,
  render,
  swap = true,
  className,
}: {
  items: readonly T[];
  live: number;
  render: (x: T, i: number) => ReactNode;
  swap?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid content-start", className)}>
      <div key={live} className={cn("[grid-area:1/1]", swap && "ind-swap")}>
        {render(items[live], live)}
      </div>
      {items.map((x, i) => (
        <div key={i} aria-hidden inert className="invisible [grid-area:1/1]">
          {render(x, i)}
        </div>
      ))}
    </div>
  );
}

type NodeState = "hollow" | "ink" | "violet" | "violet-hollow" | "green";

const CORE: Record<NodeState, string> = {
  hollow: "border-pp-muted bg-transparent",
  ink: "border-black bg-black",
  violet: "border-[#551a89] bg-[#551a89]",
  "violet-hollow": "border-[#551a89] bg-transparent",
  green: "border-[#1f8a55] bg-[#1f8a55]",
};

/**
 * A node on a line.
 *
 * A knock-out disc in the page colour with a small core inside it, so a
 * node sitting on a hairline cuts the line cleanly instead of the line
 * running through the dot — the same grammar the trades' figures draw in
 * SVG, here as HTML so a node can sit in a button, a list row or a
 * caption without a coordinate system around it. On a grey card pass
 * `className="bg-pp-card"` so the knock-out matches the card.
 *
 * The state change is a colour transition only; the node never changes
 * size, so filling one moves nothing around it.
 */
export function Node({
  state,
  size = "md",
  className,
}: {
  state: NodeState;
  size?: "md" | "sm";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-pp-bg",
        size === "md" ? "size-[19px]" : "size-[13px]",
        className,
      )}
    >
      <span
        className={cn(
          "block rounded-full border-[1.6px] transition-[background-color,border-color] duration-[420ms]",
          size === "md" ? "size-[9px]" : "size-[7px]",
          CORE[state],
        )}
      />
    </span>
  );
}

/**
 * The page's one legend: solid is on the platform today, dotted violet is
 * built for you on the build. It is stated once (in the wiring section)
 * and every other drawing on the page obeys it without restating it.
 * Written out in words, because a line style alone is not a meaning.
 * Each item is a flex row with the glyph as a fixed, centred first
 * column, so when a phrase wraps on a narrow phone its second line hangs
 * under the words rather than running back under the line sample.
 */
export function Legend({ solid, dotted, className }: { solid: string; dotted: string; className?: string }) {
  return (
    <p
      className={cn(
        "flex flex-wrap gap-x-5 gap-y-1 text-[11px] leading-4 tracking-[0.1em] text-pp-muted uppercase",
        className,
      )}
    >
      <span className="inline-flex items-baseline gap-2">
        <span aria-hidden className="inline-block h-[1.6px] w-6 shrink-0 self-center bg-black" />
        <span className="text-pretty">{solid}</span>
      </span>
      <span className="inline-flex items-baseline gap-2">
        <span aria-hidden className="caa-dots-h inline-block w-6 shrink-0 self-center" />
        <span className="text-pretty">{dotted}</span>
      </span>
    </p>
  );
}

/**
 * The "a made-up firm" tag every instrument carries: the sample is never
 * passed off as a client. `text-pretty` because these small caps wrap on
 * a 320px phone and a lone "FIRM" on its own line reads as a stray.
 *
 * A hyphenated word ("made-up") is kept whole in a nowrap span: left to
 * itself the browser breaks after the hyphen, and "MADE- / UP FIRM" is the
 * one place the honesty tag must not read as two thoughts. A span rather
 * than a U+2011 hyphen, so screen readers hear the word as written.
 */
export function MadeUp({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("text-[11px] leading-4 tracking-[0.06em] text-pretty text-pp-muted uppercase", className)}>
      {typeof children === "string"
        ? children.split(/(\S+-\S+)/).map((part, i) =>
            i % 2 === 1 ? (
              <span key={i} className="whitespace-nowrap">
                {part}
              </span>
            ) : (
              part
            ),
          )
        : children}
    </span>
  );
}

/**
 * A transcript, set the way the page sets every call.
 *
 * The caller is in the cinema italic inside quotation marks — a voice,
 * heard — and the agent in plain Inter, because what the agent says is
 * what was written for it. Speaker labels carry the colour (muted for
 * the caller, violet for the agent: the product acting), so the colour is
 * never the only thing telling them apart.
 *
 * Every turn is laid out from the first frame. Turns not yet `reached`
 * are `invisible`, never removed, so the transcript is its final height
 * before the first word lands and the call playing out moves nothing.
 *
 * `landKey` lets a section re-run the entrance: a reached turn is keyed
 * on it, so a turn that has just become visible (or every turn, when the
 * key changes with a new draft) mounts fresh and lands with `ind-land`,
 * while turns that were already showing keep their key and stay put.
 */
export function Turns({
  turns,
  labels,
  size = "md",
  reached,
  landKey,
  className,
}: {
  turns: readonly Turn[];
  labels: { caller: string; agent: string };
  size?: "md" | "sm";
  reached?: number;
  landKey?: string;
  className?: string;
}) {
  const upTo = reached ?? turns.length;
  return (
    <div className={cn(size === "md" ? "space-y-4" : "space-y-3", className)}>
      {turns.map((t, i) => {
        const shown = i < upTo;
        const caller = t.who === "caller";
        return (
          <div
            key={shown && landKey !== undefined ? `${landKey}:${i}` : `rest:${i}`}
            className={cn(!shown && "invisible", shown && landKey !== undefined && "ind-land")}
          >
            <p
              className={cn(
                "text-[11px] leading-4 font-medium tracking-[0.12em] text-pretty uppercase",
                caller ? "text-pp-muted" : "text-pp-accent",
              )}
            >
              {caller ? labels.caller : labels.agent}
            </p>
            {caller ? (
              <p
                className={cn(
                  "mt-1 font-[family-name:var(--font-pp-cinema)] text-pp-ink italic",
                  size === "md"
                    ? "text-[19px] leading-7 md:text-[21px] md:leading-8"
                    : "text-[17px] leading-[26px]",
                )}
              >
                &ldquo;{t.text}&rdquo;
              </p>
            ) : (
              <p className={cn("mt-1 text-pp-ink", size === "md" ? "text-[17px] leading-7" : "text-[15px] leading-[23px]")}>
                {t.text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A rule being redrafted: kept words plain, deleted words struck by the
 * red pen (violet here — the pen is ours), inserted words inked in with a
 * violet underline that draws on.
 *
 * All of it is inline so the redraft wraps like prose. The strike and the
 * underline are background layers with `box-decoration-break: clone` (see
 * caa.css), so on a line that wraps each fragment gets its own copy and
 * the sweep reads left to right in reading order instead of jumping.
 *
 * Words of an insertion fade in one after another, 30ms apart. Spaces are
 * left as plain text between the word spans so the browser still breaks
 * lines where it would have; a leading space sits outside the underlined
 * span so the underline starts on the first letter.
 *
 * The strike is decorative, so the meaning is in words too: each deleted
 * and inserted segment carries an sr-only "deleted:" / "added:". A sizer
 * copy must render the same Segs with `struck` and `inked` true, so it
 * reserves exactly the text the live copy will end on.
 */
export function Segs({ segs, struck, inked }: { segs: readonly Seg[]; struck: boolean; inked: boolean }) {
  return (
    <>
      {segs.map((s, i) => {
        if (s.op === "keep") return <span key={i}>{s.text}</span>;
        const lead = /^\s*/.exec(s.text)?.[0] ?? "";
        const body = s.text.slice(lead.length);
        if (s.op === "del") {
          return (
            <span key={i}>
              {lead}
              <span className="sr-only">deleted: </span>
              <span className={cn("caa-strike text-pp-muted", struck && "caa-strike-on")}>{body}</span>
            </span>
          );
        }
        let w = 0;
        return (
          <span key={i}>
            {lead}
            <span className="sr-only">added: </span>
            <span className={cn("caa-ins", inked && "caa-ins-on")}>
              {body.split(/(\s+)/).map((part, j) =>
                /^\s+$/.test(part) || part === "" ? (
                  part
                ) : (
                  <span key={j} className="caa-word" style={{ transitionDelay: `${w++ * 30}ms` }}>
                    {part}
                  </span>
                ),
              )}
            </span>
          </span>
        );
      })}
    </>
  );
}

/**
 * A test result, in words beside a dot. Green only when a test genuinely
 * held; every change — a rewrite, a brief, a document — is violet, because
 * a change is the product being worked on, not a failure to hide.
 */
export function StatusDot({ status, label, className }: { status: Status; label: string; className?: string }) {
  const held = status === "held";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] leading-4 font-medium tracking-[0.1em] text-pretty uppercase",
        held ? "text-[#1f6b3f]" : "text-pp-accent",
        className,
      )}
    >
      <Node state={held ? "green" : "violet"} size="sm" className="bg-transparent" />
      {label}
    </span>
  );
}

/**
 * Fill a `{key}` template from the data module. Numbers are grouped the
 * US way ("1,000") to match the rest of the site; a token with no value
 * is left as written so a typo shows on the page rather than vanishing.
 */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = vars[key];
    if (v === undefined) return whole;
    return typeof v === "number" ? v.toLocaleString("en-US") : v;
  });
}
