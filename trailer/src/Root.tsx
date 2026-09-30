import React from 'react';
import { Composition, Folder } from 'remotion';
import { DURATION, FPS, LANDSCAPE, VERTICAL, type SceneKey } from './timing';
import { ORDER, Trailer } from './Trailer';

const title = (k: SceneKey) => k[0].toUpperCase() + k.slice(1);

export const Root: React.FC = () => (
  <>
    <Composition
      id="Trailer-16x9"
      component={Trailer}
      durationInFrames={DURATION}
      fps={FPS}
      {...LANDSCAPE}
    />
    <Composition
      id="Trailer-9x16"
      component={Trailer}
      durationInFrames={DURATION}
      fps={FPS}
      {...VERTICAL}
    />
    {/* One scene at a time, on the real timeline (frame numbers are global). */}
    <Folder name="Scenes">
      {ORDER.map((k) => (
        <React.Fragment key={k}>
          <Composition
            id={`${title(k)}-16x9`}
            component={Trailer}
            defaultProps={{ only: k, audio: false }}
            durationInFrames={DURATION}
            fps={FPS}
            {...LANDSCAPE}
          />
          <Composition
            id={`${title(k)}-9x16`}
            component={Trailer}
            defaultProps={{ only: k, audio: false }}
            durationInFrames={DURATION}
            fps={FPS}
            {...VERTICAL}
          />
        </React.Fragment>
      ))}
    </Folder>
  </>
);
