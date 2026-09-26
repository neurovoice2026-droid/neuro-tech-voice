import type { DownCopy } from "@/lib/pages/custom-saas-platforms";
import { cn } from "@/lib/utils";
import { CHIP, RING_LIGHT } from "@/components/site/home/controls";
import { TYPE } from "@/components/site/home/type";

/* ------------------------------------------------------------------ *
 * #platform — "Take a part down": the four switches the reader flips to
 * see where the next call goes.
 *
 * Each switch is a real toggle — a 44px `aria-pressed` button whose
 * name says what being pressed means ("Voice gateway down") — so a
 * screen reader hears "Voice gateway down, toggle button, pressed" and
 * nothing has to be inferred from colour. Pressed, the pill inks in and
 * its dot lights ember (the landing's ember-lit on ink, 11.26:1, a mark);
 * released, it is the chip grey with a hollow dot. Only colours change,
 * over the house 180ms.
 *
 * "Put everything back" is always in the layout and only `invisible`
 * while nothing is down, so the switches never shift when it appears.
 * An invisible button can't take focus, so the explorer moves focus to
 * the first switch when the reader uses it.
 *
 * Under the switches, where the answer comes from — the platform's own
 * routing code, named by its path in mono — and the disclosure that
 * nothing here is really down. The answer itself is the explorer's
 * caption and the drawing; this panel only takes the reader's hand.
 *
 * PURE PRESENTATION: no "use client", no hooks, every word from
 * `DownCopy`. It takes callbacks, so only the explorer (a client island)
 * renders it.
 * ------------------------------------------------------------------ */

export function Switchboard({
  copy,
  mask,
  onToggle,
  onReset,
}: {
  copy: DownCopy;
  mask: number;
  onToggle: (bit: 1 | 2 | 4 | 8) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <div role="group" aria-label={copy.groupLabel} className="flex flex-col items-start gap-2">
        {copy.switches.map((s) => {
          const down = (mask & s.bit) !== 0;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={down}
              onClick={() => onToggle(s.bit)}
              className={cn(
                "saas-toggle group inline-flex h-11 max-w-full cursor-pointer items-center gap-3 rounded-full pr-5 pl-4 text-left text-[14px] leading-5",
                CHIP.ease,
                RING_LIGHT,
                down ? "bg-(--home-ink) text-white" : "bg-(--home-chip) text-(--home-ink) hover:bg-(--home-stage)",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full transition-colors duration-180",
                  down ? "bg-(--home-ember-lit)" : "bg-transparent shadow-[inset_0_0_0_1.5px_var(--home-muted)]",
                )}
              />
              <span className="min-w-0">{s.label}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onReset}
        className={cn(
          "home-link mt-3 inline-flex min-h-6 cursor-pointer items-center rounded-sm text-[14px] leading-5",
          RING_LIGHT,
          mask === 0 && "invisible",
        )}
      >
        {copy.reset}
      </button>

      <p className={cn(TYPE.meta, "mt-5 max-w-[34em] text-pretty")}>
        {copy.source}{" "}
        <code className={cn(TYPE.mono, "whitespace-nowrap text-pp-ink")} translate="no">
          {copy.sourcePath}
        </code>
      </p>
      <p className={cn(TYPE.meta, "mt-2 text-pp-ink")}>{copy.foot}</p>
    </div>
  );
}
