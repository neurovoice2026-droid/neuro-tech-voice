import { describe, expect, it } from "vitest";
import type { Cue, CueTurn } from "@/lib/audio/cue-types";
import {
  cueTime,
  envBytes,
  envelopeAt,
  mediaTime,
  remapAuthoredAxis,
  spokenSchedule,
  turnAt,
  wordsShownAt,
} from "./cue";

/** Base64 of some bytes, without Buffer, so the test runs wherever atob does. */
const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));

function turn(i: number, sp: CueTurn["sp"], start: number, end: number, words: [number, number][]): CueTurn {
  return {
    i,
    sp,
    voice: sp === "agent" ? "ava" : "cory",
    start,
    end,
    words: words.map(([s, e], k) => [k, s, e]),
    events: [],
    take: "t1",
  };
}

/** A phone call as the pipeline writes one: ring, pickup, three turns. */
function call(): Cue {
  return {
    v: 1,
    id: "test/call",
    src: "/audio/v1/test/call.mp3",
    dur: 10,
    offset: 0.0251,
    sfx: [
      { kind: "ring", start: 1.2, end: 1.9 },
      { kind: "pickup", start: 1.9, end: 2.02 },
    ],
    turns: [
      turn(0, "agent", 2, 4, [
        [2.03, 2.3],
        [2.4, 2.8],
        [2.9, 3.85],
      ]),
      turn(1, "caller", 4.5, 6, [
        [4.53, 5],
        [5.1, 5.85],
      ]),
      // Line 2 interrupts line 1's tail: a negative gap.
      turn(2, "agent", 5.9, 9, [[5.95, 8.8]]),
    ],
    // 10 s at 25 fps: 250 frames.
    env: b64(Array.from({ length: 250 }, (_, k) => (k === 1 ? 255 : k === 3 ? 128 : 0))),
  };
}

describe("cue clock", () => {
  it("converts between the element's clock and the cue's", () => {
    const cue = call();
    expect(cueTime(cue, 1.0251)).toBeCloseTo(1, 9);
    expect(mediaTime(cue, 1)).toBeCloseTo(1.0251, 9);
    expect(cueTime(cue, mediaTime(cue, 3.3))).toBeCloseTo(3.3, 9);
  });
});

describe("spokenSchedule", () => {
  it("gives each turn its start, end, hold and gap", () => {
    const s = spokenSchedule(call());
    expect(s.dur).toBe(10);
    expect(s.lead).toBe(2);
    expect(s.sfx.map((x) => x.kind)).toEqual(["ring", "pickup"]);
    expect(s.turns.map((t) => t.i)).toEqual([0, 1, 2]);
    expect(s.turns.map((t) => t.sp)).toEqual(["agent", "caller", "agent"]);
    expect(s.turns[0].hold).toBeCloseTo(2.5, 9);
    expect(s.turns[0].gap).toBeCloseTo(0.5, 9);
    expect(s.turns[1].hold).toBeCloseTo(1.4, 9);
    expect(s.turns[1].gap).toBeCloseTo(-0.1, 9);
    // The last turn holds for its own length, and its gap runs to the track's end.
    expect(s.turns[2].hold).toBeCloseTo(3.1, 9);
    expect(s.turns[2].gap).toBeCloseTo(1, 9);
  });

  it("gives word offsets from the turn's start", () => {
    const s = spokenSchedule(call());
    expect(s.turns[0].wordAt.map((x) => +x.toFixed(6))).toEqual([0.03, 0.4, 0.9]);
    expect(s.turns[0].wordEnd.map((x) => +x.toFixed(6))).toEqual([0.3, 0.8, 1.85]);
    expect(s.turns[1].wordAt.map((x) => +x.toFixed(6))).toEqual([0.03, 0.6]);
  });

  it("puts the whole track in the lead when nobody speaks", () => {
    const s = spokenSchedule({ ...call(), turns: [] });
    expect(s.turns).toEqual([]);
    expect(s.lead).toBe(10);
  });
});

describe("turnAt", () => {
  it("is undefined before the first turn", () => {
    expect(turnAt(call(), 0)).toBeUndefined();
    expect(turnAt(call(), 1.99)).toBeUndefined();
  });

  it("is the last turn to have started, through the gap after it", () => {
    const cue = call();
    expect(turnAt(cue, 2)?.i).toBe(0);
    expect(turnAt(cue, 4.2)?.i).toBe(0);
    expect(turnAt(cue, 4.5)?.i).toBe(1);
    expect(turnAt(cue, 5.95)?.i).toBe(2);
    expect(turnAt(cue, 99)?.i).toBe(2);
  });
});

describe("wordsShownAt", () => {
  it("counts the words of a turn that have started", () => {
    const t0 = call().turns[0];
    expect(wordsShownAt(t0, 2)).toBe(0);
    expect(wordsShownAt(t0, 2.03)).toBe(1);
    expect(wordsShownAt(t0, 2.5)).toBe(2);
    expect(wordsShownAt(t0, 3.85)).toBe(3);
    expect(wordsShownAt(t0, 50)).toBe(3);
  });

  it("given a cue, counts the words of the turn on screen", () => {
    const cue = call();
    expect(wordsShownAt(cue, 1)).toBe(0);
    expect(wordsShownAt(cue, 2.5)).toBe(2);
    expect(wordsShownAt(cue, 4.4)).toBe(3);
    expect(wordsShownAt(cue, 5.05)).toBe(1);
    expect(wordsShownAt(cue, 5.2)).toBe(2);
  });

  it("shows a zero-length slot (a lone dash) with the word after it", () => {
    const t = turn(0, "agent", 0, 2, [
      [0.1, 0.5],
      [0.7, 0.7],
      [0.7, 1.2],
    ]);
    expect(wordsShownAt(t, 0.69)).toBe(1);
    expect(wordsShownAt(t, 0.7)).toBe(3);
  });
});

describe("envelopeAt", () => {
  it("decodes the envelope once per cue", () => {
    const cue = call();
    const a = envBytes(cue);
    expect(a.length).toBe(250);
    expect(a[1]).toBe(255);
    expect(envBytes(cue)).toBe(a);
  });

  it("reads a frame at its centre and interpolates between centres", () => {
    const cue = call();
    // Frame k covers [k/25, (k+1)/25); its centre is (k + 0.5)/25.
    expect(envelopeAt(cue, 1.5 / 25)).toBeCloseTo(1, 9);
    expect(envelopeAt(cue, 0.5 / 25)).toBeCloseTo(0, 9);
    expect(envelopeAt(cue, 1 / 25)).toBeCloseTo(0.5, 9);
    expect(envelopeAt(cue, 3.5 / 25)).toBeCloseTo(128 / 255, 9);
    expect(envelopeAt(cue, 3 / 25)).toBeCloseTo(64 / 255, 9);
  });

  it("is 0 outside the track, and for an empty envelope", () => {
    const cue = call();
    expect(envelopeAt(cue, -0.01)).toBe(0);
    expect(envelopeAt(cue, 10)).toBe(0);
    expect(envelopeAt(cue, Number.NaN)).toBe(0);
    expect(envelopeAt({ ...call(), env: "" }, 1)).toBe(0);
  });
});

describe("remapAuthoredAxis", () => {
  // Authored: lines at 0, 8, 16 s on a 20 s rail. Spoken: 2, 4.5, 5.9 on a 10 s track.
  const authored = [0, 8, 16];

  it("pins each line's authored start to its spoken start, and the end to the end", () => {
    const map = remapAuthoredAxis(authored, call(), 20);
    expect(map(0)).toBeCloseTo(2, 9);
    expect(map(8)).toBeCloseTo(4.5, 9);
    expect(map(16)).toBeCloseTo(5.9, 9);
    expect(map(20)).toBeCloseTo(10, 9);
  });

  it("moves anything between two pins in proportion", () => {
    const map = remapAuthoredAxis(authored, call(), 20);
    expect(map(4)).toBeCloseTo(3.25, 9);
    expect(map(12)).toBeCloseTo(5.2, 9);
    expect(map(18)).toBeCloseTo(7.95, 9);
  });

  it("runs at a slope of 1 past either end", () => {
    const map = remapAuthoredAxis(authored, call(), 20);
    expect(map(-1)).toBeCloseTo(1, 9);
    expect(map(21)).toBeCloseTo(11, 9);
  });

  it("inverts", () => {
    const map = remapAuthoredAxis(authored, call(), 20);
    for (const a of [-1, 0, 3, 8, 11.5, 16, 19, 20, 25]) expect(map.invert(map(a))).toBeCloseTo(a, 9);
  });

  it("is non-decreasing", () => {
    const map = remapAuthoredAxis(authored, call(), 20);
    let last = -Infinity;
    for (let a = -2; a <= 22; a += 0.25) {
      const s = map(a);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });

  it("pins 0 to 0 when the first line starts later on both clocks", () => {
    const map = remapAuthoredAxis([1, 8, 16], call());
    expect(map.knots[0]).toEqual([0, 0]);
    expect(map(0.5)).toBeCloseTo(1, 9);
    expect(map(1)).toBeCloseTo(2, 9);
  });

  it("skips lines with no turn, and pins that would run backwards", () => {
    const cue = call();
    // Line 1 is missing from the cue; line 2 is authored before line 0.
    const gappy = { ...cue, turns: [cue.turns[0], cue.turns[2]] };
    expect(remapAuthoredAxis([5, 8, 16], gappy).knots).toEqual([
      [0, 0],
      [5, 2],
      [16, 5.9],
    ]);
    expect(remapAuthoredAxis([5, 8, 3], cue).knots).toEqual([
      [0, 0],
      [3, 5.9],
    ]);
  });

  it("is the identity with nothing to pin", () => {
    const map = remapAuthoredAxis([], { ...call(), turns: [] });
    expect(map(7)).toBe(7);
    expect(map.invert(7)).toBe(7);
  });
});
