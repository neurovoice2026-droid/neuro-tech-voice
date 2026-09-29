"use client";

import type { MouseEvent, ReactNode } from "react";
import type { PartId } from "@/lib/pages/custom-saas-platforms";
import { markPartShown, requestPart } from "./part-bus";

/* ------------------------------------------------------------------ *
 * "See it on the map →": a link from a part named elsewhere on the page
 * (a grant in #credentials, a part in #scope) to the same part on the
 * explorer's drawing in #platform.
 *
 * A REAL LINK FIRST. It is an <a href="#part-<id>">, and the fragment is
 * the explorer's index entry for that part, inside its <details>: with no
 * script, or before the explorer has hydrated, the browser opens the
 * details itself and jumps there, and the part is described in words.
 * The index eases open like the landing's FAQ, which would leave the
 * entry without a box for the jump to land on; saas.css §14 opens it at
 * once whenever it holds the target.
 *
 * With script, a plain primary click is taken over, and the fragment
 * never reaches the address bar: the history entry gets a note that the
 * part has been shown (`markPartShown`) and loses any fragment it had
 * (a #credentials from the hero's link, say). On Back, Chrome takes the
 * reader to the entry's fragment, not to the place it saved: with
 * `#part-<id>` written there, a reader who went on to an in-page jump and
 * pressed Back landed in the index, opened for them, screens below the
 * drawing they had left. With the note and no fragment, neither Back to
 * this entry nor a reload carries the reader away from where they had
 * got to (part-bus.ts). The request goes to the explorer (part-bus.ts),
 * which selects the part on the drawing, scrolls #platform into view
 * and moves focus to its inspector. A jump would land on the index,
 * below the drawing, and a content-visibility box above can land a jump
 * short; the explorer's own scroll corrects for that. A modified click
 * (a new tab, a new window, a download) or any button but the first
 * falls through to the browser, untouched, and copying the link copies
 * the part's address.
 * ------------------------------------------------------------------ */

export function MapLink({ part, className, children }: { part: PartId; className?: string; children: ReactNode }) {
  const href = `#part-${part}`;
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    markPartShown(part);
    requestPart(part);
  };
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
