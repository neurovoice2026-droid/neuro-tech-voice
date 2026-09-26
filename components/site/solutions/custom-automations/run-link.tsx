"use client";

import type { MouseEvent, ReactNode } from "react";
import type { RunLensId } from "@/lib/pages/custom-automations";
import { requestRun } from "./run-bus";

/* ------------------------------------------------------------------ *
 * "Watch it run →": a link from a block kind named elsewhere on the page
 * (a line of #work's legend) to the workbench lens where that kind of
 * block really runs, in #running.
 *
 * A REAL LINK FIRST. It is an <a href="#running">: with no script, or
 * before the workbench has hydrated, the browser jumps to the section,
 * which shows its finished frame and describes every lens, in words, in
 * its index.
 *
 * With script, a plain primary click is taken over: the lens goes to the
 * workbench (run-bus.ts `requestRun`) with how the link was pressed. A
 * pointer's click plays the lens's tour, from by hand, as a pointer on
 * its chip does; Enter or Space (a click with none counted, `detail` 0)
 * shows its finished frame, as those keys on the chip do. Either way the
 * workbench brings the stage up clear of the header and moves focus to
 * the lens's chip. A jump would land on the section's heading, above the
 * lens rail, and a content-visibility box above can land a jump short;
 * the workbench's own scroll corrects for that and takes one more look
 * once it has settled.
 *
 * NO FRAGMENT LEFT BEHIND. The click leaves the history entry's address
 * at its path and query, without a jump, and takes off any fragment it
 * had (a #work from the header's menu, say), as the SaaS page's "Take a
 * part down" link does (its checks.tsx `RowLink`). On Back, Chrome takes
 * the reader to the entry's fragment, not to the place it saved: with
 * `#running` written there, a reader who read on to #faq, followed a link
 * away and came Back would land at the workbench, screens above where
 * they had got to, and a reload would do the same. With no fragment the
 * browser keeps their place. The link keeps its `#running` href, for a
 * new tab, a copied link and every jump with no script. `null` for the
 * state: Next's patched replaceState copies its own keys into the entry
 * and has its router follow the new address.
 *
 * A modified click (a new tab, a new window, a download) or any button
 * but the first falls through to the browser, untouched.
 * ------------------------------------------------------------------ */

export function RunLink({ lens, className, children }: { lens: RunLensId; className?: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    history.replaceState(null, "", location.pathname + location.search);
    requestRun(lens, e.detail === 0 ? "key" : "pointer");
  };
  return (
    <a href="#running" className={className} onClick={onClick}>
      {children}
    </a>
  );
}
