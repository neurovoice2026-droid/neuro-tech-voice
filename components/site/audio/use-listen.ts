"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Cue } from "@/lib/audio/cue-types";
import { unlockFromGesture } from "./engine";
import type { VoiceTrack } from "./use-voice-track";

/**
 * Reduced motion: Listen says a figure's clips one after another (or
 * pauses them), turning sound on with the press; `at` is the clip being
 * said. Off screen it pauses, and the transport says Listen again: a
 * press carries on from where it stopped. Once another stage's press has
 * taken the sound, the rest is said only if nobody else is speaking
 * (otherwise it carries on silently, on the same clock).
 */
export function useListen(track: VoiceTrack, cues: readonly Cue[] | undefined, active: boolean, gap = 0.5) {
  const [state, setState] = useState<{ k: number; playing: boolean } | null>(null);
  const pending = useRef(false);
  /** Another stage's press took the sound during this Listen. */
  const yielded = useRef(false);
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
    if (track.preempted) yielded.current = true;
  });

  const start = (unlock: boolean) => {
    if (!cues?.length) return;
    yielded.current = false;
    setState({ k: 0, playing: true });
    trackRef.current.play(cues[0], 0, { press: true, unlock, next: cues[1]?.src });
  };
  const startPending = useEffectEvent(() => {
    if (!pending.current || !cues) return;
    pending.current = false;
    start(false);
  });
  // A press made before the clips had arrived: they are here.
  useEffect(() => {
    if (cues) startPending();
  }, [cues]);

  // The clip is over: the next one, after a breath; after the last, Listen is done.
  const ended = track.ended;
  useEffect(() => {
    if (!state?.playing || !ended || !cues) return;
    const id = window.setTimeout(() => {
      const k = state.k + 1;
      // The last clip has been said; or another stage's press took the sound, and the rest may not start by itself.
      if (k >= cues.length || yielded.current) {
        setState(null);
        return;
      }
      setState({ k, playing: true });
      trackRef.current.play(cues[k], 0, { press: true, next: cues[k + 1]?.src });
    }, gap * 1000);
    return () => window.clearTimeout(id);
  }, [state, ended, cues, gap]);

  // Off screen, the hook pauses the clip: Listen pauses with it, and only a press carries it on.
  const away = useEffectEvent(() => setState((s) => (s?.playing ? { ...s, playing: false } : s)));
  useEffect(() => {
    if (!active) away();
  }, [active]);

  const toggle = () => {
    if (state?.playing) {
      trackRef.current.pause();
      setState({ ...state, playing: false });
      return;
    }
    if (state && cues) {
      // Resuming is a press: it takes the sound back.
      yielded.current = false;
      setState({ ...state, playing: true });
      if (!trackRef.current.ended) trackRef.current.play(cues[state.k], undefined, { press: true, unlock: true });
      return;
    }
    if (!cues) {
      // The clips aren't here yet: sound goes on in this press, and Listen starts when they arrive.
      unlockFromGesture();
      pending.current = true;
      return;
    }
    start(true);
  };

  /**
   * The sound control turned on: a Listen under way (since sound went off, on a silent clock) is
   * heard again from where it is, a paused one carries on, and with none it starts. Never a pause.
   */
  const soundOn = () => {
    if (state && cues) {
      yielded.current = false;
      if (!state.playing) setState({ ...state, playing: true });
      if (!trackRef.current.ended) trackRef.current.play(cues[state.k], undefined, { press: true });
      return;
    }
    toggle();
  };

  /** Stops it where it is (another set was chosen). */
  const stop = () => {
    if (state) trackRef.current.pause();
    pending.current = false;
    setState(null);
  };

  return { at: state ? state.k : -1, playing: !!state?.playing, toggle, soundOn, stop };
}
