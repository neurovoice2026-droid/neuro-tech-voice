/* ------------------------------------------------------------------ *
 * A ledger's list: short statements, each after a violet dot, ink at 85%
 * on the page's white. The terms ledger's four columns (terms.tsx) and
 * the hero's range (hero.tsx) are both set with it, on both pages, so
 * the dot, its offset, the spacing and the colour can't drift apart.
 *
 * Statements, not controls: on these pages a chip is something to press,
 * so a list of what we build or what the terms are is never set as
 * chips. Below md, where columns stack into one long list, 8px between
 * items rather than 12.
 *
 * PURE. No "use client" and no hooks: a server section imports it, and
 * the words arrive as a prop, because every word on the page lives in
 * the data module. The heading over it is the caller's.
 * ------------------------------------------------------------------ */

export function LedgerList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-3 space-y-2 md:mt-4 md:space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          {/* 9px down centres a 4px dot on the x-height of a 21px line. */}
          <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-pp-accent" />
          <span className="min-w-0 text-[14px] leading-[21px] text-pretty text-pp-ink/85">{item}</span>
        </li>
      ))}
    </ul>
  );
}
