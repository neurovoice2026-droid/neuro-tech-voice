/**
 * Film 2's compositions (docs/kb/PIPELINE.md §3; entry point src/kb/index.ts). Ids start with KB- (H8:
 * film 1 already has Knowledge-16x9 / -9x16):
 *   KB-Trailer-16x9 / -9x16   120 fps (RENDER_FPS), DURATION × SUB — the masters
 *   KB-Preview-16x9 / -9x16   30 fps (FPS), DURATION — --frame=N is timeline frame N (previews / stills)
 *   folder KB-Scenes          one act at a time on the real timeline (global frame numbers), no audio
 */
import React from 'react';
import { Composition, Folder } from 'remotion';
import { KbFilm } from './Film';
import { DURATION, FPS, KB_ORDER, LANDSCAPE, RENDER_FPS, SUB, VERTICAL, type KbSceneKey } from './timing';

const title = (k: KbSceneKey) => k[0].toUpperCase() + k.slice(1);

export const KbRoot: React.FC = () => (
  <>
    <Composition id="KB-Trailer-16x9" component={KbFilm} durationInFrames={DURATION * SUB} fps={RENDER_FPS} {...LANDSCAPE} />
    <Composition id="KB-Trailer-9x16" component={KbFilm} durationInFrames={DURATION * SUB} fps={RENDER_FPS} {...VERTICAL} />
    <Composition id="KB-Preview-16x9" component={KbFilm} durationInFrames={DURATION} fps={FPS} {...LANDSCAPE} />
    <Composition id="KB-Preview-9x16" component={KbFilm} durationInFrames={DURATION} fps={FPS} {...VERTICAL} />
    <Folder name="KB-Scenes">
      {KB_ORDER.map((k) => (
        <React.Fragment key={k}>
          <Composition id={`KB-${title(k)}-16x9`} component={KbFilm} defaultProps={{ only: k, audio: false }} durationInFrames={DURATION} fps={FPS} {...LANDSCAPE} />
          <Composition id={`KB-${title(k)}-9x16`} component={KbFilm} defaultProps={{ only: k, audio: false }} durationInFrames={DURATION} fps={FPS} {...VERTICAL} />
        </React.Fragment>
      ))}
    </Folder>
  </>
);
