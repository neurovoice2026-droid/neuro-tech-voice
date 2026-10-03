/* ------------------------------------------------------------------ *
 * The cue format the audio pipeline emits (CUE_SCHEMA.md v1, verbatim).
 *
 * assemble.py writes one cue file per surface at
 * lib/audio/cues/<surface>.json; the audio it describes is at
 * public/audio/v1/<path>.mp3. Every time below is in seconds on the cue
 * clock: cueTime = HTMLAudioElement.currentTime - offset.
 * ------------------------------------------------------------------ */

/** lib/audio/cues/<surface>.json */
export type CueFile = {
  v: 1;
  /** Surface id, e.g. "home-demo-call". */
  surface: string;
  /** Track id -> cue, e.g. "home-demo/night". Keys are sorted. */
  cues: Record<string, Cue>;
};

export type Cue = {
  v: 1;
  /** Track id (also the key in CueFile.cues). */
  id: string;
  /** Site URL of the MP3, e.g. "/audio/v1/home/demo/night.mp3". Shared clips: several cues, one src. */
  src: string;
  /** Seconds. Length of the track on the cue clock (the PCM before encoding, already padded to a whole MP3 frame). */
  dur: number;
  /**
   * Seconds, >= 0. MP3 decoder priming measured for this file:
   *   mediaTime = cueTime + offset        (HTMLAudioElement.currentTime)
   *   cueTime   = currentTime - offset
   * Every time in this object is on the cue clock. The decoded length is dur + offset (to within 20 ms).
   */
  offset: number;
  /** Non-speech sounds baked into the track (ring, pickup). Empty for clips without SFX. */
  sfx: CueSfx[];
  /** Spoken turns in time order. Empty for an SFX-only track (sfx/ring-uk). */
  turns: CueTurn[];
  /**
   * base64 of a Uint8Array RMS envelope at 25 frames per second, length ceil(dur * 25).
   * Byte k covers [k/25, (k+1)/25) s on the cue clock. Level: rmsDb = -60 + 60 * byte / 255
   * (0 = -60 dBFS or quieter, 255 = 0 dBFS). Speech at -16 LUFS sits around 150-200.
   */
  env: string;
};

export type CueSfx = {
  kind: "ring" | "pickup";
  /** Seconds on the cue clock. */
  start: number;
  /** Ring: where the pickup cuts the burst. Pickup: end of the click plus line-open noise (start + 0.12 s). */
  end: number;
};

export type CueTurn = {
  /** Index of the line in the surface's own script: the `turn` of its line id (surface/script/turn). */
  i: number;
  /** Speaker role. The use-cases console calls the caller "client"; map it there. */
  sp: "agent" | "caller";
  /** Cast key ("ava", "agent-us-m", "cory", ...), stable when a voice is recast. Not a Cartesia id. */
  voice: string;
  /** Seconds on the cue clock. start = where the clip begins (about 30 ms before the first word).
   *  end = where the clip ends (about 150 ms after the last word; a wall cut line ends exactly at the cut). */
  start: number;
  end: number;
  /**
   * One entry per DISPLAY word of the line, in order: words[k][0] === k.
   * Display words = the displayed line text split on single spaces, exactly as the site shows it
   * (`text.split(" ")`, the same split as SplitText "words"). A split turn (two requests joined
   * 120-200 ms apart) is ONE turn, so its indices run over the whole displayed line.
   * [k, start, end] in seconds on the cue clock; starts never decrease; end >= start.
   * A word with no letters or digits (a lone "—") gets a zero-length slot at the next word's start.
   * A display token said as several words ("15:00" -> "three o'clock") spans all of them.
   */
  words: CueWord[];
  /** Sounds that are not display words: caller fillers ("um", "uh", "hmm") and "laughter". */
  events: CueEvent[];
  /** Take(s) used: "t3", or "t2+t4" for a split turn (part 1 + part 2). */
  take: string;
};

export type CueWord = [index: number, start: number, end: number];
export type CueEvent = [kind: string, start: number, end: number];
