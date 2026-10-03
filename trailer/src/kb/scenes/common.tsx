/**
 * PLACEHOLDER act cards (the infrastructure phase, docs/kb/PIPELINE.md §12 step 2): every act is a clean,
 * on-brand title card in its room — the act's part and beats as an eyebrow, its title in the house
 * heading (Title, TYPE.headline, sentence case, the key phrase two-tone), and its voices as live captions
 * on the real word timings (the Captions fork) — so the whole film plays end to end, in sync with the mix,
 * before the real scenes are built (§12 step 4). A small accent dot pulses on the act's sound moments.
 *
 * Nothing here is final design; it only uses the house parts as they are (rooms, type roles, inks).
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { NightRoom, PaperRoom } from '../../components/Atmosphere';
import { Label } from '../../components/Type';
import { useLayout } from '../../lib/layout';
import { EASE, tween } from '../../lib/motion';
import { typeStyle } from '../../lib/type';
import { Title } from '../../scenes/knowledge/Title';
import { C } from '../../theme';
import { Captions } from '../components/Captions';
import { useKbSceneFrame } from '../scene';
import { ACCENT, SPEAKER_OF } from '../theme';
import { b, FPS, SCENES, VOICES, vFrames, type Caption, type KbSceneKey } from '../timing';
import { VOICE, type VoiceId } from '../voice.generated';

/**
 * A line's captions: one per sentence, a long sentence split at its commas into chunks of ≤ 7 words
 * (a clause longer than that evenly); each chunk starts on its first spoken word.
 */
export function autoCaptions(id: VoiceId): Caption[] {
  const words = VOICE.lines[id].words;
  const sentences: number[][] = [];
  let cur: number[] = [];
  words.forEach((w, i) => {
    cur.push(i);
    if (/[.?!]$/.test(w.w)) {
      sentences.push(cur);
      cur = [];
    }
  });
  if (cur.length) sentences.push(cur);
  const chunks: number[][] = [];
  for (const s of sentences) {
    const clauses: number[][] = [];
    let c: number[] = [];
    s.forEach((i) => {
      c.push(i);
      if (/,$/.test(words[i].w)) {
        clauses.push(c);
        c = [];
      }
    });
    if (c.length) clauses.push(c);
    let chunk: number[] = [];
    for (const cl of clauses) {
      if (chunk.length && chunk.length + cl.length > 7) {
        chunks.push(chunk);
        chunk = [];
      }
      chunk.push(...cl);
    }
    if (chunk.length) chunks.push(chunk);
  }
  return chunks.flatMap((ch) => {
    const parts = Math.ceil(ch.length / 7);
    const per = Math.ceil(ch.length / parts);
    return Array.from({ length: parts }, (_, p) => ch.slice(p * per, (p + 1) * per)).map((idx) => ({ text: idx.map((i) => words[i].w).join(' '), word: idx[0] }));
  });
}

/** narrator lines (Ava to the owner) carry no speaker tag; calls and the desk do (SCRIPT.md) */
const isNarration = (id: VoiceId) => /^kb2-(vo-\d+|brand)$/.test(id);

/** The act's voices as live captions: two rows (consecutive lines alternate), each on its real word timings. */
export const ActCaptions: React.FC<{ act: KbSceneKey; tone: 'paper' | 'night'; rows: readonly [number, number]; maxWidth: number }> = ({ act, tone, rows, maxWidth }) => {
  const L = useLayout();
  const s = SCENES[act];
  // the captions run on the absolute timeline (VOICES' frames): inside the act's Sequence the frame is local
  const t = useKbSceneFrame(act) + s.from;
  const lines = VOICES.filter((v) => v.at >= s.from && v.at < s.to);
  return (
    <>
      {lines.map((v, i) => {
        const role = VOICE.lines[v.id].voice;
        // a line holds a second after it ends, but leaves a beat after the next speaker starts (and before its row's next line)
        const holdUntil = Math.min(v.at + vFrames(v.id) + b(2), (lines[i + 1]?.at ?? Infinity) + b(1), (lines[i + 2]?.at ?? Infinity) - 4, s.to);
        return (
          <Captions
            key={`${v.id}@${v.at}`}
            t={t}
            lineAt={v.at}
            voice={v.id}
            captions={autoCaptions(v.id)}
            x={L.cx}
            y={rows[i % 2]}
            maxWidth={maxWidth}
            tone={tone}
            speaker={isNarration(v.id) ? undefined : SPEAKER_OF[role]}
            holdUntil={holdUntil}
            echoY={null}
          />
        );
      })}
    </>
  );
};

/** A small accent dot that pulses on the act's sound moments (act-local frames). */
export const Pulse: React.FC<{ t: number; at: readonly number[]; color: string; x: number; y: number }> = ({ t, at, color, x, y }) => {
  const last = [...at].reverse().find((f) => t >= f);
  const k = last === undefined ? 0 : Math.exp(-(t - last) / 5);
  const ring = last === undefined ? 1 : tween(t, [last, last + 14], [0, 1], EASE.out3);
  return (
    <>
      <div style={{ position: 'absolute', left: x - 9, top: y - 9, width: 18, height: 18, borderRadius: '50%', background: color, transform: `scale(${(1 + 0.5 * k).toFixed(4)})` }} />
      {last !== undefined && ring < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: x - 9,
            top: y - 9,
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: `1.5px solid ${color}`,
            transform: `scale(${(1 + 3.5 * ring).toFixed(4)})`,
            opacity: 1 - ring,
          }}
        />
      ) : null}
    </>
  );
};

export type ActCardProps = {
  act: KbSceneKey;
  /** the eyebrow: 'PART I · THE REPEAT' */
  part: string;
  /** the script's beats: 'b01–b05' */
  beats: string;
  /** the act's title in the house heading */
  title: string;
  /** the key phrase (exact words of `title`), eased into the accent ink on `keyAt` (act-local) */
  keyPhrase?: string;
  keyAt?: number;
  /** the part's one accent ink (rose until Ava, sunday teal from her) */
  accent: string;
  /** PaperRoom (the paper acts) or NightRoom (the close) */
  room: 'paper' | 'night';
  /** act-local frames the accent dot pulses on (its sound moments) */
  moments?: readonly number[];
  children?: React.ReactNode;
};

/** One act as a title card in its room. */
export const ActCard: React.FC<ActCardProps> = ({ act, part, beats, title, keyPhrase, keyAt = 18, accent, room, moments = [], children }) => {
  const L = useLayout();
  const t = useKbSceneFrame(act);
  const s = SCENES[act];
  const tone = room === 'night' ? 'night' : 'paper';
  const ink = room === 'night' ? C.paper : ACCENT.ink;
  const dim = room === 'night' ? C.paperDim : ACCENT.muted;
  const len = s.to - s.from;
  const sec = (f: number) => (f / FPS).toFixed(2);
  const ground =
    room === 'night' ? (
      <NightRoom light={{ x: L.cx, y: L.pick(380, 640), color: accent, strength: 0.3, radius: L.pick(520, 640) }} vignette={0.55} />
    ) : (
      <PaperRoom light={{ x: L.pick(L.width * 0.62, L.cx), y: L.pick(360, 560), tint: accent, tintStrength: 0.05 }} horizon={{ y: L.pick(800, 1500), strength: 0.7 }} />
    );
  return (
    <AbsoluteFill>
      {ground}
      <div style={{ position: 'absolute', left: L.safe.x, top: L.pick(110, 230), display: 'flex', alignItems: 'center', gap: 18 }}>
        <Label tone={tone} color={accent}>
          {part}
        </Label>
        <Label tone={tone} color={dim}>
          {beats}
        </Label>
      </div>
      <Pulse t={t} at={moments} color={accent} x={L.width - L.safe.x - 9} y={L.pick(110, 230) + 18} />
      <Title
        t={t}
        lines={null}
        text={title}
        role="headline"
        vertical={L.vertical}
        size={typeStyle('headline', L.vertical).fontSize as number}
        width={L.pick(1500, 900)}
        cx={L.cx}
        cy={L.pick(380, 620)}
        start={4}
        stagger={2}
        keyPhrase={keyPhrase ? { text: keyPhrase, at: keyAt, color: accent } : undefined}
        color={ink}
      />
      {children}
      <ActCaptions act={act} tone={tone} rows={L.pick([650, 880] as const, [1060, 1310] as const)} maxWidth={L.pick(1560, 920)} />
      {/* the act's clock: where it sits on the timeline (a placeholder's slate), and a hairline filling over it */}
      <div
        style={{
          position: 'absolute',
          left: L.safe.x,
          bottom: L.pick(60, 200),
          ...typeStyle('meta', L.vertical, { tone }),
          color: dim,
          whiteSpace: 'nowrap',
        }}
      >
        {`${act.toUpperCase()} · ${sec(s.from)}–${sec(s.to)} s · frames ${s.from}–${s.to}`}
      </div>
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 4, width: L.width * Math.min(1, Math.max(0, t / len)), background: accent, opacity: 0.55 }} />
    </AbsoluteFill>
  );
};
