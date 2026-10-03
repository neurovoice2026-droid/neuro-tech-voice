"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { LazyCues } from "@/lib/audio";

const none = () => null;

/**
 * A P0 stage's cues for its render (lib/audio `lazyCues`): null until they
 * are here. They are fetched once sound is on (never before), and the
 * stage renders again when they arrive, whichever call fetched them (a
 * press retrying a fetch that failed calls `cues.load()` itself). Event
 * handlers and frame loops read `cues.get()` themselves, which is current
 * at once.
 */
export function useLazyCues<T>(cues: LazyCues<T>, soundOn: boolean): T | null {
  useEffect(() => {
    if (soundOn) void cues.load();
  }, [cues, soundOn]);
  return useSyncExternalStore(cues.subscribe, cues.get, none);
}
