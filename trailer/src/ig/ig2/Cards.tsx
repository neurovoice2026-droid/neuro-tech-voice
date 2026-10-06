/**
 * REEL 2 · THE GATE'S CARDS (docs/ig/SCRIPT.md ig2 b10 "The gate"; §5 "EventCard, PRO / BETA chips"): what the booking
 * left behind, landing on 16ths as the call panel folds away —
 *   EventCard   a neutral day column headed "Saturday" (no Google UI, no logo): the hour gutter and the block
 *               "Maya · 10:00" in her teal. On "Pro" the PRO chip (the app's violet outline) clips onto its top-right,
 *               the BETA badge (the app's own sky BetaBadge, as on "Connect Google Calendar") a 16th later.
 * (The call's record — SCRIPT's RecordCard: the Booked pill and ink bars — is the call panel itself, folded: Stage.tsx.)
 * Each card is a kit Panel landing on the house landing spring (SPRING.land, a contact shadow thickening as it settles),
 * placed by its own transform (`pose`: the act's camera and the end card's step-back, applied per card so every card
 * stays a small layer). Every string ≤ 32 px app chrome or a word she says.
 */
import React from 'react';
import { smooth, SPRING, springUnit, tween } from '../../lib/motion';
import { APP, measureText, Panel, ui, useKitFaces, W } from '../../kb/kit';
import { MOMENT_LIGHTS } from '../../kb/palettes';
import { IgIcon } from '../components/icons';
import { ZoneRect } from '../components/ZoneGuard';

const SUNDAY = MOMENT_LIGHTS.sunday;

/** a card's place under the act's camera / the end card's step: about its own centre */
export type CardPose = { dx: number; dy: number; scale: number; shade: number; opacity: number; moving: boolean };
export const REST: CardPose = { dx: 0, dy: 0, scale: 1, shade: 0, opacity: 1, moving: false };
export type Rect = { x: number; y: number; w: number; h: number };

export const EVENT: Rect = { x: 120, y: 794, w: 760, h: 290 };

/** the rect a card's pose puts on screen (for the zone guard) */
export const posed = (r: Rect, p: CardPose, inner: Rect): Rect => {
  const cx = r.x + r.w / 2 + p.dx;
  const cy = r.y + r.h / 2 + p.dy;
  return { x: cx + (inner.x - (r.x + r.w / 2)) * p.scale, y: cy + (inner.y - (r.y + r.h / 2)) * p.scale, w: inner.w * p.scale, h: inner.h * p.scale };
};

/** a card landing: from below on SPRING.land, OPAQUE ON ITS FIRST RENDER FRAME (a white card fading in on the night
 *  passes through a grey, frosted state — fix round 2) */
function landing(t: number, at: number, size = 56) {
  const s = springUnit(t - at, SPRING.land);
  return { dy: (1 - s) * size * 1.7, o: tween(t, [at - 0.25, at], [0, 1], (x) => x), moving: Math.abs(1 - s) > 2e-4, lift: 1.4 + 1.6 * Math.min(1, s) };
}

const PAD = 36;

/* ── the PRO and BETA chips ── */
/** the label role's 28 px (SCRIPT ig2 b10 "label 28"; fix round 2: 24 px caps were ≈ 1.5 mm on a phone) */
export const PRO_SPEC = { size: 28, weight: 620, tracking: 0.1 };
export const chipBox = (text: string) => ({ w: measureText(text.toUpperCase(), PRO_SPEC) + 32, h: 46 });

export const Badge: React.FC<{ t: number; at: number; text: string; bg: string; ring: string; ink: string; x: number; y: number }> = ({ t, at, text, bg, ring, ink, x, y }) => {
  if (t < at - 1) return null;
  const s = springUnit(t - at, SPRING.pop);
  const b = chipBox(text);
  // it clips on: from a touch above and a touch large, settling with the pop's one overshoot
  const dy = (1 - s) * -14;
  const sc = 1.12 - 0.12 * Math.min(1.08, s);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: b.w,
        height: b.h,
        borderRadius: b.h / 2,
        background: bg,
        boxShadow: `inset 0 0 0 1.75px ${ring}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif',
        fontSize: PRO_SPEC.size,
        fontWeight: PRO_SPEC.weight,
        letterSpacing: `${PRO_SPEC.tracking}em`,
        textTransform: 'uppercase',
        lineHeight: 1,
        color: ink,
        opacity: Math.min(1, smooth(0, 0.35, s)),
        transform: `translateY(${dy.toFixed(3)}px) scale(${sc.toFixed(5)})`,
        transformOrigin: '50% 100%',
      }}
    >
      <span style={{ transform: 'translateY(0.04em)' }}>{text}</span>
    </div>
  );
};

/* ── EventCard ── */
export const EventCard: React.FC<{ t: number; at: number; pro: number; beta: number; pose?: CardPose }> = ({ t, at, pro, beta, pose = REST }) => {
  const ready = useKitFaces();
  if (!ready || t < at - 0.5) return null;
  const R = EVENT;
  const L = landing(t, at);
  const head = 82;
  const rowH = 62;
  const gutter = 132;
  const rows = ['9:00', '10:00', '11:00'];
  const proB = chipBox('Pro');
  const betaB = chipBox('Beta');
  const betaX = R.w - PAD - betaB.w;
  const proX = betaX - 12 - proB.w;
  const chipY = (head - proB.h) / 2 + 6;
  const top0 = head + 44;
  const evY = top0 + rowH * 1 + 4;
  const titleSpec = { size: 32, weight: W.semibold };
  return (
    <>
      <Panel x={R.x} y={R.y} w={R.w} h={R.h} radius={34} lift={L.lift} ink="#1e0b38" k={1.3} dx={pose.dx} dy={L.dy + pose.dy} scale={pose.scale} shade={pose.shade} opacity={L.o * pose.opacity}>
        {/* the day */}
        <div style={{ position: 'absolute', left: PAD, top: 0, height: head + 12, display: 'flex', alignItems: 'center', gap: 16 }}>
          <IgIcon name="calendar" size={32} color={APP.mutedFg} stroke={2} />
          <span style={{ ...ui(titleSpec.size, titleSpec.weight, { tracking: -0.01 }), color: APP.foreground }}>Saturday</span>
        </div>
        <Badge t={t} at={pro} text="Pro" bg="#ffffff" ring={APP.primary} ink={APP.primary} x={proX} y={chipY} />
        <Badge t={t} at={beta} text="Beta" bg="#f0f9ff" ring="#b8e6fe" ink="#0069a8" x={betaX} y={chipY} />
        <div style={{ position: 'absolute', left: PAD, right: PAD, top: head + 10, height: 1.25, background: APP.border }} />
        {/* the day column: the hour gutter and its rules */}
        {rows.map((h, i) => (
          <React.Fragment key={h}>
            <div style={{ position: 'absolute', left: PAD, top: top0 + i * rowH - 14, ...ui(26, 460, { mono: true }), color: APP.mutedFg }}>{h}</div>
            <div style={{ position: 'absolute', left: PAD + gutter - 16, right: PAD, top: top0 + i * rowH, height: 1, background: APP.border, opacity: 0.9 }} />
          </React.Fragment>
        ))}
        {/* the booking */}
        <div
          style={{
            position: 'absolute',
            left: PAD + gutter,
            right: PAD,
            top: evY,
            height: rowH - 8,
            borderRadius: 14,
            background: SUNDAY.ink,
            boxShadow: `0 8px 18px -10px rgba(14, 116, 144, 0.55)`,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 24,
          }}
        >
          <span style={{ ...ui(30, W.active), color: '#ffffff' }}>Maya · 10:00</span>
        </div>
      </Panel>
      {L.o > 0.5 && pose.opacity > 0.5 ? (
        <>
          <ZoneRect what="event card “Saturday”" rect={posed(R, pose, { x: R.x + PAD, y: R.y + 22, w: 48 + measureText('Saturday', titleSpec), h: 40 })} />
          <ZoneRect what="event block “Maya · 10:00”" rect={posed(R, pose, { x: R.x + PAD + gutter + 24, y: R.y + evY + 9, w: measureText('Maya · 10:00', { size: 30, weight: W.active }), h: 36 })} />
          {t >= pro ? <ZoneRect what="PRO + BETA chips" rect={posed(R, pose, { x: R.x + proX, y: R.y + chipY, w: betaX + betaB.w - proX, h: proB.h })} /> : null}
        </>
      ) : null}
    </>
  );
};
