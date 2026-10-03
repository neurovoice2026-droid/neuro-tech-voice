"use client";

import { useId, useSyncExternalStore, type MouseEvent } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSoundOn, isSounding, soundOff, subscribe, unlockFromGesture } from "./engine";
import { armFollow, endFollow } from "./show-said";
import "./sound.css";

/* ------------------------------------------------------------------ *
 * The sound control: one switch for every voice on the site.
 *
 * Every sound button on a page shows the same state (engine.ts keeps
 * it): pressing one turns sound on for the visit, pressing any again
 * turns it off. Its name is "Sound" in both states; `aria-pressed`, the
 * icon and the accent carry the state. The first press unlocks audio inside the click and hands
 * the stage `onChange(true)`, in the same click, to start its current
 * conversation; `onChange(false)` lets the stage finish the run silently.
 *
 * Two shapes: `round`, a 40px disc to sit beside the home RoundButton
 * (same tones: light, dark, deep), and `pill`, the product and industry
 * pages' icon-and-word pill. Both take a 44px tap, show their focus ring
 * on any ground, and carry the micro-caption the honesty rule asks of
 * every sound control: "AI-generated voices · sample call". A stage whose
 * own visible caption already says so may pass `caption="none"` with
 * `describedBy` pointing at it.
 * ------------------------------------------------------------------ */

/**
 * The control's name, the same in both states: `aria-pressed` carries the
 * state ("Sound, toggle button, pressed" is sound on). A name that changed
 * with the state ("Sound off, not pressed") would read as the opposite.
 */
export const SOUND_LABEL = "Sound";
export const SOUND_NOTE = "AI-generated voices · sample call";

const off = () => false;

export function SoundButton({
  variant = "pill",
  tone = "light",
  onChange,
  caption = "beside",
  describedBy,
  note = SOUND_NOTE,
  className,
}: {
  variant?: "round" | "pill";
  /** The ground it sits on, as RoundButton's tones: white stock, the dark band, the deep panel. */
  tone?: "light" | "dark" | "deep";
  /** Called inside the click, after sound is unlocked or turned off: start (or let go of) the stage's conversation. */
  onChange?: (on: boolean) => void;
  /** Where the micro-caption goes: beside the control (it wraps under it on a narrow column), read only, or nowhere. */
  caption?: "beside" | "sr" | "none";
  /** The id of a visible caption on the stage that already says the voices are generated (with `caption="none"`). */
  describedBy?: string;
  note?: string;
  className?: string;
}) {
  const on = useSyncExternalStore(subscribe, isSoundOn, off);
  const sounding = useSyncExternalStore(subscribe, isSounding, off);
  const noteId = useId();
  const Icon = on ? Volume2 : VolumeX;

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    if (isSoundOn()) {
      soundOff();
      endFollow();
      onChange?.(false);
    } else {
      unlockFromGesture();
      // What this press starts may bring its words on screen, keeping this control there too (show-said.ts).
      armFollow(e.currentTarget);
      onChange?.(true);
    }
  };

  return (
    <span className={cn("snd", className)} data-variant={variant} data-tone={tone}>
      <button
        type="button"
        className="snd-btn"
        aria-pressed={on}
        // The round control shows only an icon; the pill shows the same word, its
        // state in the icon (the bars, while sounding), the accent and the ring.
        aria-label={variant === "round" ? SOUND_LABEL : undefined}
        aria-describedby={caption === "none" ? describedBy : noteId}
        data-on={on || undefined}
        data-sounding={sounding || undefined}
        onClick={toggle}
      >
        {variant === "pill" ? (
          // The bars take the icon's place while a voice is sounding, in the same box: the pill
          // never changes width (a wider pill re-wrapped its caption and moved the page).
          <span className="snd-glyph">
            <Icon aria-hidden className="size-4 shrink-0" />
            <span className="snd-bars" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          </span>
        ) : (
          <Icon aria-hidden className="size-4 shrink-0" />
        )}
        {variant === "pill" && <span>{SOUND_LABEL}</span>}
      </button>
      {caption !== "none" && (
        <span id={noteId} className={cn("snd-note", caption === "sr" && "sr-only")}>
          {note}
        </span>
      )}
    </span>
  );
}
