"use client";

import { useEffect, useState } from "react";
import type { LazyCues } from "@/lib/audio";

/**
 * A P0 stage's cues for its render (lib/audio `lazyCues`): null until they
 * are here. They are fetched once sound is on (never before), and the
 * stage renders again when they arrive. Event handlers and frame loops
 * read `cues.get()` themselves, which is current at once.
 */
export function useLazyCues<T>(cues: LazyCues<T>, soundOn: boolean): T | null {
  const [, setHere] = useState(false);
  useEffect(() => {
    if (!soundOn) return;
    let live = true;
    void cues.load().then((v) => {
      if (live && v !== null) setHere(true);
    });
    return () => {
      live = false;
    };
  }, [cues, soundOn]);
  return cues.get();
}
