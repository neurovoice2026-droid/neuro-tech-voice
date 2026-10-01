/**
 * TYPE + ATMOSPHERE SPECIMEN — the shared foundation on its own, as frames
 * of the ad: every TYPE role (theme.ts) in context on NightRoom, PaperRoom
 * and EmberRoom, with the real components (Words, Captions on the real
 * voice timing, SpeakerLabel, Orb, ContactShadow, FilmGrain).
 *
 *   npx remotion still src/dev/specimen.tsx Specimen-16x9 out/dev/<dir>/s.png --frame=<f>
 *   (30 fps; each plate is PLATE frames: the entrance runs from its start + 4, the hold
 *   from + 48; HOLD_AT[i] is a good still)
 *   Specimen120-16x9 / -9x16: the same at 120 fps (frame = 4 × timeline frame) — to see
 *   sub-frame smoothness of the reveals.
 */
import React, { useState } from 'react';
import { AbsoluteFill, Composition, registerRoot } from 'remotion';
import { EmberRoom, NightRoom, PaperRoom } from '../components/Atmosphere';
import { Captions } from '../components/Captions';
import { FilmGrain } from '../components/Grain';
import { flowTime, Orb } from '../components/Orb';
import { Label, Reveal, Words } from '../components/Type';
import { waitForFonts } from '../lib/fonts';
import { useLayout } from '../lib/layout';
import { inkFor } from '../lib/lights';
import { useTimelineFrame } from '../lib/scene';
import { typeSize, typeStyle } from '../lib/type';
import { C, elevation, LIGHTS, TYPE, type TypeRole } from '../theme';
import { FPS, LANDSCAPE, VERTICAL, vWord } from '../timing';

const PLATE = 72;
const PLATES = ['roles-paper', 'roles-night', 'ava', 'caller', 'knowledge', 'after', 'asleep-booked', 'japanese', 'industries', 'display'] as const;
type PlateId = (typeof PLATES)[number];
export const HOLD_AT = PLATES.map((_, i) => i * PLATE + 60);

/* ── the role sheet ── */
const ROLE_LINES: [TypeRole, string][] = [
  ['display', 'Your business is closed.'],
  ['headline', 'Answers from your own documents.'],
  ['title', 'Price list · Dental clinic'],
  ['caption', 'Could I come in on Wednesday?'],
  ['label', 'Knowledge base'],
  ['meta', '#front-desk  3:00 PM'],
];

const Roles: React.FC<{ t: number; tone: 'paper' | 'night' }> = ({ t, tone }) => {
  const L = useLayout();
  const ink = tone === 'paper' ? C.ink : C.paper;
  const dim = tone === 'paper' ? C.muted : C.paperDim;
  const x = L.pick(150, 70);
  let y = L.pick(130, 330);
  return (
    <>
      {ROLE_LINES.map(([role, text], i) => {
        const st = typeStyle(role, L.vertical, { tone });
        const fs = st.fontSize as number;
        const top = y;
        // (9:16: the long samples wrap to two rows)
        const rows = L.vertical && (role === 'display' || role === 'headline' || role === 'caption') ? 2 : 1;
        y += rows * fs * (st.lineHeight as number) + L.pick(54, 70);
        const r = TYPE[role];
        return (
          <div key={role} style={{ position: 'absolute', left: x, top, width: L.width - 2 * x }}>
            <div style={{ ...typeStyle('label', L.vertical, { tone, size: 22 }), color: dim, position: 'absolute', top: -30 }}>
              {role} · {r.size[L.vertical ? 1 : 0]} px · {tone === 'night' ? r.weightOnDark : r.weight} · {r.tracking}
            </div>
            <Words
              text={text}
              start={4 + i * 4}
              stagger={2}
              role={role}
              tone={tone}
              color={role === 'meta' || role === 'label' ? dim : ink}
              align="left"
              frame={t}
              keys={role === 'headline' ? [{ text: 'your own documents.', color: tone === 'paper' ? LIGHTS.sunday.ink : inkFor('sunday', 'dark'), at: 0 }] : []}
              style={{ textWrap: 'wrap' }}
            />
          </div>
        );
      })}
    </>
  );
};

/* ── the call: Ava / the caller under the orb ── */
const CallPlate: React.FC<{ t: number; who: 'ava' | 'caller' }> = ({ t, who }) => {
  const L = useLayout();
  const orb = L.pick({ x: L.cx, y: 400, d: 300 }, { x: L.cx, y: 760, d: 380 });
  const capY = L.pick(830, 1250);
  const voice = who === 'ava' ? ('call-1' as const) : ('call-2' as const);
  const cap = who === 'ava' ? { text: 'This is Ava, an AI assistant.', word: 6 } : { text: 'Could I come in on Wednesday afternoon?', word: 1 };
  const lineAt = 6 - vWord(voice, cap.word);
  const vol = 0.28 + 0.08 * Math.sin(t / 5);
  const pal = who === 'ava' ? LIGHTS.night.orb : LIGHTS.night.listen;
  return (
    <NightRoom
      light={{ x: orb.x, y: orb.y, color: pal[2], radius: orb.d * 1.3 }}
      floor={{ y: orb.y + orb.d * 0.5 + L.pick(110, 150) }}
    >
      <Orb size={orb.d} palette={pal} volume={vol} time={flowTime(t, () => 0.3)} style={{ position: 'absolute', left: orb.x - orb.d / 2, top: orb.y - orb.d / 2 }} />
      <Captions
        t={t}
        lineAt={lineAt}
        voice={voice}
        captions={[cap]}
        x={L.cx}
        y={capY}
        maxWidth={L.pick(1500, 900)}
        tone="night"
        speaker={who}
        holdUntil={PLATE - 6}
        echoY={null}
      />
    </NightRoom>
  );
};

/* ── the knowledge heading (the client's reference) ── */
const Doc: React.FC<{ t: number; at: number; x: number; y: number; w: number; kind: string; name: string }> = ({ t, at, x, y, w, kind, name }) => {
  const L = useLayout();
  const h = L.pick(150, 140);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: 20,
          background: '#fff',
          boxShadow: elevation(0.6),
          padding: '24px 28px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ ...typeStyle('meta', L.vertical), fontSize: L.pick(26, 26), color: LIGHTS.sunday.ink }}>
          <Reveal t={t} start={at}>{kind}</Reveal>
        </div>
        <div style={{ ...typeStyle('title', L.vertical), fontSize: L.pick(44, 42), color: C.ink }}>
          <Reveal t={t} start={at + 3}>{name}</Reveal>
        </div>
      </div>
    </>
  );
};

const KnowledgePlate: React.FC<{ t: number }> = ({ t }) => {
  const L = useLayout();
  const cy = L.pick(560, 980);
  return (
    <PaperRoom light={{ x: L.cx, y: cy, tint: LIGHTS.sunday.orb[2], tintStrength: 0.05 }} horizon={{ y: L.pick(860, 1500) }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: L.pick(300, 640), textAlign: 'center' }}>
        <Label tone="paper" color={LIGHTS.sunday.ink} style={{ display: 'inline-block' }}>
          <Reveal t={t} start={2}>Knowledge base</Reveal>
        </Label>
      </div>
      <div style={{ position: 'absolute', left: L.pick(160, 60), width: L.width - 2 * L.pick(160, 60), top: cy, transform: 'translateY(-50%)' }}>
        <Words
          text="Answers from your own documents."
          lines={L.vertical ? ['Answers from', 'your own documents.'] : undefined}
          start={4}
          stagger={3}
          role="headline"
          tone="paper"
          color={C.ink}
          keys={[{ text: 'your own documents.', color: LIGHTS.sunday.ink, at: 0 }]}
          frame={t}
        />
      </div>
      {L.vertical ? (
        <>
          <Doc t={t} at={16} x={90} y={1240} w={420} kind="PDF" name="Price list" />
          <Doc t={t} at={20} x={570} y={1240} w={420} kind="DOCX" name="Cancellations" />
        </>
      ) : (
        <>
          <Doc t={t} at={16} x={520} y={720} w={420} kind="PDF" name="Price list" />
          <Doc t={t} at={20} x={980} y={720} w={420} kind="DOCX" name="Cancellations" />
        </>
      )}
    </PaperRoom>
  );
};

/* ── after the call ── */
const AfterPlate: React.FC<{ t: number }> = ({ t }) => {
  const L = useLayout();
  const stations = [
    { label: 'The call', title: 'New caller', meta: null },
    { label: 'Slack', title: 'Booked · Wed 3 PM', meta: '#front-desk' },
    { label: 'CRM', title: 'Contact saved', meta: null },
  ];
  const ink = LIGHTS.closing.ink;
  return (
    <PaperRoom light={{ x: L.cx, y: L.pick(420, 760) }} horizon={{ y: L.pick(900, 1560) }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: L.pick(200, 330) }}>
        <Words text="After the call." start={4} role="headline" tone="paper" color={C.ink} keys={[{ text: 'call.', color: ink, at: 0 }]} frame={t} />
      </div>
      {stations.map((s, i) => {
        // (a 64 px title needs ≈ 600 px of card: "Booked · Wed 3 PM" ≈ 540 px)
        const w = L.pick(580, 860);
        const h = L.pick(260, 200);
        const x = L.pick(L.cx - 1.5 * w - 28 + i * (w + 28), L.cx - w / 2);
        const y = L.pick(470, 640 + i * (h + 70));
        const at = 12 + i * 6;
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 24, background: '#fff', boxShadow: elevation(0.5), padding: '30px 34px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Label tone="paper" color={i === 2 ? ink : C.muted}>
                  <Reveal t={t} start={at}>{s.label}</Reveal>
                </Label>
                {s.meta ? (
                  <div style={{ ...typeStyle('meta', L.vertical), color: C.muted }}>
                    <Reveal t={t} start={at + 2}>{s.meta}</Reveal>
                  </div>
                ) : null}
              </div>
              <div style={{ position: 'absolute', left: 34, right: 34, bottom: 30 }}>
                {/* multi-word text that may wrap: <Words> (each word its own mask), not one nowrap <Reveal> */}
                <Words text={s.title} start={at + 3} stagger={1.5} role="title" tone="paper" color={i === 2 ? ink : C.ink} align="left" frame={t} />
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </PaperRoom>
  );
};

/* ── Asleep. / Booked. ── */
const AsleepBooked: React.FC<{ t: number }> = ({ t }) => {
  const L = useLayout();
  const half = L.vertical ? { w: L.width, h: L.height / 2 } : { w: L.width / 2, h: L.height };
  const fs = typeSize('display', L.vertical) * L.pick(1.25, 1.15);
  const box = (i: number): React.CSSProperties =>
    L.vertical
      ? { position: 'absolute', left: 0, top: i * half.h, width: half.w, height: half.h, overflow: 'hidden' }
      : { position: 'absolute', left: i * half.w, top: 0, width: half.w, height: half.h, overflow: 'hidden' };
  const word = (text: string, color: string, at: number) => (
    <div style={{ position: 'absolute', left: 0, right: 0, top: '58%', transform: 'translateY(-50%)' }}>
      <Words text={text} start={at} role="display" tone="night" color={color} frame={t} style={{ fontSize: fs }} config={{ stiffness: 140, damping: 17 }} />
    </div>
  );
  return (
    <>
      <div style={box(0)}>
        <NightRoom light={{ x: half.w * 0.5, y: half.h * 0.32, color: '#8a93c9', strength: 0.16, radius: half.h * 0.45 }} vignette={0.6}>
          {word('Asleep.', '#c9c6d6', 4)}
        </NightRoom>
      </div>
      <div style={box(1)}>
        <EmberRoom light={{ x: half.w * 0.5, y: half.h * 0.32, color: C.ember, radius: half.h * 0.45 }}>
          {word('Booked.', C.emberLit, 12)}
        </EmberRoom>
      </div>
    </>
  );
};

/* ── Japanese ── */
const JapanesePlate: React.FC<{ t: number }> = ({ t }) => {
  const L = useLayout();
  const fs = typeSize('display', L.vertical, true);
  const st = typeStyle('display', L.vertical, { tone: 'night', jp: true });
  const chars = Array.from('AIアシスタントの');
  const chars2 = Array.from('Avaと申します。');
  const row = (cs: string[], at: number, key: boolean) => (
    <div style={{ whiteSpace: 'nowrap' }}>
      {cs.map((c, i) => (
        <Reveal key={i} t={t} start={at + i * 1.2} style={{ color: key && i < 2 ? C.lilac : C.paper }}>
          {c}
        </Reveal>
      ))}
    </div>
  );
  return (
    <NightRoom light={{ x: L.cx, y: L.cy - L.pick(60, 120), color: LIGHTS.night.orb[2], radius: L.pick(520, 640) }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: L.pick(330, 700), textAlign: 'center' }}>
        <Label tone="night" style={{ display: 'inline-block' }}>
          <Reveal t={t} start={2}>Japanese · 日本語</Reveal>
        </Label>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: L.cy, transform: 'translateY(-40%)', textAlign: 'center', ...st, fontSize: fs, color: C.paper }}>
        {row(chars, 4, true)}
        {row(chars2, 16, false)}
      </div>
    </NightRoom>
  );
};

/* ── industries ── */
const INDUSTRIES = ['Dental clinics', 'Law firms', 'Salons', 'Auto repair', 'Veterinary', 'Real estate', 'Restaurants', 'Physiotherapy'];
const IndustriesPlate: React.FC<{ t: number }> = ({ t }) => {
  const L = useLayout();
  const cols = L.pick(2, 1);
  const list = L.vertical ? INDUSTRIES.slice(0, 6) : INDUSTRIES;
  const colW = L.pick(700, 900);
  const x0 = L.cx - (cols * colW + (cols - 1) * 80) / 2;
  const rowH = L.pick(104, 120);
  const top = L.pick(400, 720);
  const ink = LIGHTS.rush.ink;
  return (
    <PaperRoom light={{ x: L.cx, y: L.pick(380, 700) }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: L.pick(170, 400) }}>
        <Words
          text="Every front desk. One Ava."
          lines={L.vertical ? ['Every front desk.', 'One Ava.'] : undefined}
          start={4}
          role="headline"
          tone="paper"
          color={C.ink}
          keys={[{ text: 'One Ava.', color: ink, at: 0 }]}
          frame={t}
        />
      </div>
      {list.map((name, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = x0 + c * (colW + 80);
        const y = top + r * rowH;
        const at = 10 + i * 1.5;
        const line = Math.min(1, Math.max(0, (t - at) / 14));
        const e = 1 - Math.pow(1 - line, 3);
        return (
          <div key={name} style={{ position: 'absolute', left: x, top: y, width: colW, height: rowH }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: 1, width: colW * e, background: 'rgba(20,10,36,0.12)' }} />
            <div style={{ position: 'absolute', left: 0, top: rowH * 0.2, ...typeStyle('title', L.vertical), color: C.ink }}>
              <Reveal t={t} start={at + 2}>{name}</Reveal>
            </div>
            <div style={{ position: 'absolute', right: 0, top: rowH * 0.2 + typeSize('title', L.vertical) * 0.32, ...typeStyle('meta', L.vertical), color: C.muted }}>
              <Reveal t={t} start={at + 4}>{String(i + 1).padStart(2, '0')}</Reveal>
            </div>
          </div>
        );
      })}
    </PaperRoom>
  );
};

/* ── display on night ── */
const DisplayPlate: React.FC<{ t: number }> = ({ t }) => {
  const L = useLayout();
  return (
    <NightRoom light={{ x: L.cx, y: L.pick(330, 640), color: LIGHTS.night.orb[2], radius: L.pick(420, 520) }} floor={{ y: L.pick(700, 1300) }}>
      <div style={{ position: 'absolute', left: L.pick(160, 60), right: L.pick(160, 60), top: L.pick(L.cy + 80, L.cy + 120), transform: 'translateY(-50%)' }}>
        <Words
          text="Your business is closed."
          lines={L.vertical ? ['Your business', 'is closed.'] : undefined}
          start={4}
          stagger={3}
          role="display"
          tone="night"
          color={C.paper}
          keys={[{ text: 'closed.', color: C.lilac, at: 0 }]}
          frame={t}
          config={{ stiffness: 140, damping: 17 }}
        />
      </div>
    </NightRoom>
  );
};

const Plate: React.FC<{ id: PlateId; t: number }> = ({ id, t }) => {
  switch (id) {
    case 'roles-paper':
      return (
        <PaperRoom light={{ x: 640, y: 300 }}>
          <Roles t={t} tone="paper" />
        </PaperRoom>
      );
    case 'roles-night':
      return (
        <NightRoom light={{ x: 640, y: 300, color: LIGHTS.night.orb[2], radius: 600 }}>
          <Roles t={t} tone="night" />
        </NightRoom>
      );
    case 'ava':
      return <CallPlate t={t} who="ava" />;
    case 'caller':
      return <CallPlate t={t} who="caller" />;
    case 'knowledge':
      return <KnowledgePlate t={t} />;
    case 'after':
      return <AfterPlate t={t} />;
    case 'asleep-booked':
      return <AsleepBooked t={t} />;
    case 'japanese':
      return <JapanesePlate t={t} />;
    case 'industries':
      return <IndustriesPlate t={t} />;
    case 'display':
      return <DisplayPlate t={t} />;
  }
};

const Specimen: React.FC = () => {
  useState(() => waitForFonts());
  const g = useTimelineFrame();
  const i = Math.min(PLATES.length - 1, Math.floor(g / PLATE));
  const t = g - i * PLATE;
  const white = ['roles-paper', 'knowledge', 'after', 'industries'].includes(PLATES[i]) ? 1 : 0;
  return (
    <AbsoluteFill style={{ background: C.night, overflow: 'hidden' }}>
      <Plate id={PLATES[i]} t={t} />
      <FilmGrain white={white} />
    </AbsoluteFill>
  );
};

const N = PLATES.length * PLATE;
const SpecimenRoot: React.FC = () => (
  <>
    <Composition id="Specimen-16x9" component={Specimen} durationInFrames={N} fps={FPS} {...LANDSCAPE} />
    <Composition id="Specimen-9x16" component={Specimen} durationInFrames={N} fps={FPS} {...VERTICAL} />
    <Composition id="Specimen120-16x9" component={Specimen} durationInFrames={N * 4} fps={120} {...LANDSCAPE} />
    <Composition id="Specimen120-9x16" component={Specimen} durationInFrames={N * 4} fps={120} {...VERTICAL} />
  </>
);

registerRoot(SpecimenRoot);
