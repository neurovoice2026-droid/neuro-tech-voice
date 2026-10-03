/* ------------------------------------------------------------------ *
 * The dock: the control pressed, within reach.
 *
 * A follow (show-said.ts) can carry the page away from the control that
 * was pressed, where the words being said and the control do not fit on
 * the screen together. Then, while sound is on and that control is off
 * screen, a copy of it (pressed) waits at the foot of the screen, so sound
 * can always be turned off where the reader is: pressing it presses the
 * control itself, so its stage hears the press as it would have.
 *
 * Fetched by show-said the first time a follow moves the page.
 * ------------------------------------------------------------------ */

import { isSoundOn, soundOff, subscribe } from "./engine";
import { endFollow, type Press } from "./show-said";
import { SOUND_LABEL, SOUND_NOTE } from "./sound-button";

let current: Press | null = null;
let dock: HTMLElement | null = null;
/** The pressed control is on screen, below the header. */
let keepSeen = true;
let seen: IntersectionObserver | null = null;
let heard = false;

/** Shows the dock while sound is on, a follow has moved the page since the press, and the control pressed is off screen. */
function sync() {
  const show = !!current?.moved && isSoundOn() && !(current.keep?.isConnected && keepSeen);
  if (show && !dock) dock = make();
  if (dock) dock.hidden = !show;
}

/** The press being followed is `p` (a new press, or a follow that moved the page). */
export function dockFor(p: Press) {
  if (!heard) {
    heard = true;
    subscribe(sync);
  }
  if (p !== current) {
    current = p;
    seen?.disconnect();
    keepSeen = true;
    if (p.keep) {
      // Under the header is not on screen.
      seen = new IntersectionObserver(
        ([e]) => {
          keepSeen = !!e?.isIntersecting;
          sync();
        },
        { rootMargin: "-64px 0px 0px 0px" },
      );
      seen.observe(p.keep);
    }
  }
  sync();
}

/**
 * A pressed sound pill with the caption every sound control carries, its
 * icon borrowed from the page's own (sound is on, so they all show it).
 */
function make() {
  const wrap = document.createElement("span");
  wrap.className = "snd snd-dock";
  wrap.dataset.variant = "pill";
  wrap.dataset.tone = "light";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "snd-btn";
  button.setAttribute("aria-pressed", "true");
  button.setAttribute("aria-describedby", "snd-dock-note");
  button.dataset.on = "";
  const icon = document.querySelector(".snd-btn[aria-pressed='true'] svg")?.cloneNode(true);
  if (icon) button.append(icon);
  button.append(SOUND_LABEL);
  const note = document.createElement("span");
  note.id = "snd-dock-note";
  note.className = "snd-note";
  note.textContent = SOUND_NOTE;
  button.onclick = () => {
    const keep = current?.keep;
    if (keep instanceof HTMLElement && keep.isConnected && keep.matches(".snd-btn[aria-pressed='true']")) keep.click();
    else {
      soundOff();
      endFollow();
    }
  };
  wrap.append(button, note);
  document.body.append(wrap);
  return wrap;
}
