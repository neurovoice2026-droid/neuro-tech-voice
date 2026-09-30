import React, { useState } from 'react';
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from 'remotion';
import { Orb, flowTime } from '../components/Orb';
import { MeshOrb } from '../components/MeshOrb';
import { Words, Label, CornerDot } from '../components/Type';
import { Grain } from '../components/Grain';
import { waitForFonts } from '../lib/fonts';
import { C, FONT, NIGHT_ROOM, ORB, CLOCK_FILL } from '../theme';

const Probe: React.FC = () => {
  useState(() => waitForFonts());
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: NIGHT_ROOM, alignItems: 'center', justifyContent: 'center', gap: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
        <div style={{ fontFamily: FONT.ui, fontWeight: 440, fontSize: 220, backgroundImage: CLOCK_FILL, WebkitBackgroundClip: 'text', color: 'transparent', fontVariantNumeric: 'tabular-nums' }}>03</div>
        <Orb size={240} palette={ORB.ink} volume={0.4} time={flowTime(f, () => 0.3)} />
        <MeshOrb size={120} palette={ORB.ink} time={f / 30} />
      </div>
      <Words text="Your business is closed." start={0} style={{ fontSize: 110, color: C.paper }} keys={[{ text: 'closed.', color: C.lilac, at: 0 }]} />
      <div style={{ fontFamily: FONT.cinema, fontSize: 56, color: C.paper }}>Sunt Ava, inteligență artificială. <i>Three o'clock</i> · Avaと申します。</div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', color: C.lilac }}><CornerDot size={20} /><Label>Picked up on the first ring</Label><span style={{ fontFamily: FONT.mono, fontSize: 28, color: C.paper }}>POST 200 OK 01 02</span></div>
      <Grain />
    </AbsoluteFill>
  );
};
registerRoot(() => <Composition id="Probe" component={Probe} durationInFrames={60} fps={30} width={1920} height={1080} />);
