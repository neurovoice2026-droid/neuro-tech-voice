import type { Answer, Platform, SampleApp, ScreenId } from "@/lib/pages/custom-mobile-applications";
import { Screen, type ScreenLive } from "./screens";

/**
 * The screen a tour's iOS push leaves (mob-device.css §5): drawn once more,
 * a still picture, under the new one going forward and over it going back,
 * as it makes the push's other half; `onEnd` as it has gone.
 */
export type Leaving = {
  key: number;
  move: "mob-forward" | "mob-back";
  platform: Platform;
  screen: ScreenId;
  answer: Answer | null;
  arrived: boolean;
  onEnd: () => void;
};

/* ------------------------------------------------------------------ *
 * #hold's phone: the frame the sample app is held in, drawn for either
 * platform, with the live screen inside it (screens.tsx).
 *
 * A PICTURE OF A PHONE, NOT OF A MODEL. A dark bezel and a white glass,
 * a status bar with a grey bar where the time would be and drawn signal,
 * wifi and battery marks, the camera's cutout, and the bar at the foot
 * you swipe: an iOS phone has a pill-shaped cutout, rounder corners and
 * a home indicator; an Android phone a round punch-hole, tighter corners
 * and a gesture handle. No bitmap, no logo, no real device, no digit.
 * The radii are in px (a view transition clips to them, mob-device.css
 * §5); everything inside the glass is in container units (`.mob-glass`
 * is the container), so the screen scales like a picture from a 238px
 * glass to a 302px one and its text never drops under 12px.
 *
 * A FIXED ASPECT, 1 : 2.05. Every screen fills the same box, and the
 * sheet, the dialog and the notification sit inside it, so the phone is
 * as tall on the last step as on the first and nothing around it moves
 * when a screen changes or the platform switches: deferred.tsx reserves
 * the section's one height.
 *
 * THE GLASS'S GROUND follows the screen (`data-tone`): white; the night
 * behind the sheet's card on iOS, where the page scales back; dimmed as
 * the scrim dims the screen, while the dialog asks and under Android's
 * sheet, so the status bar's band never stays white over a dimmed
 * screen; the deep panel's gradient as the lock screen's wallpaper. It sits under the
 * screen, at the root of the page's picture, so it changes with a soft
 * fade while the screen's own view transition runs over it, and the
 * status bar's marks turn white on the dark two.
 *
 * ACCESSIBILITY. The device is a group named by `label` (the stage
 * passes the section's tag); its frame, status bar, cutout and home bar
 * are aria-hidden, and only the live screen exists, with its real
 * heading and real buttons. `data-platform`, `data-screen`,
 * `data-arrived` and `data-seen` (set once most of the phone has been
 * on screen: its hotspots pulse) are the CSS's hooks; the stage's
 * wrapper carries `data-enter` from the first press or tour arrival on,
 * so the dialog and the notification make their entries only then,
 * never on the server's first paint.
 *
 * THE SCREEN A TOUR'S PUSH LEAVES. A reader's press moves the screen as a
 * view transition, which pictures the old screen as well as the new; the
 * tour's own moves are the new screen's entry (mob-device.css §5), and on
 * iOS a push moves both screens, so for its 0.36s the stage hands in the
 * step it left (`leaving`), drawn once more as a still picture, aria-
 * hidden and inert, beside the live one: under it going forward, over it
 * going back. Android's shared axis passes through an empty frame by
 * design, so it has none.
 *
 * Pure: the stage (phone-stage.tsx) holds the state and hands the frame
 * in. Without `live` it is a still picture whose hotspots are spans.
 * ------------------------------------------------------------------ */

export type { ScreenLive };

/**
 * The glass's ground under each screen (mob-device.css §1): the lock
 * screen's wallpaper; the night behind iOS's sheet; dimmed with the scrim
 * while the dialog asks, and under Android's payment sheet; white.
 */
function toneOf(platform: Platform, screen: ScreenId, answer: Answer | null) {
  if (screen === "lock") return "deep";
  if (screen === "pay") return platform === "ios" ? "night" : "dim";
  if (screen === "booked" && answer === null) return "dim";
  return "light";
}

/** The status bar's marks: signal, wifi and battery, in the bar's colour. Drawn, aria-hidden. */
function StatusMarks() {
  return (
    <svg aria-hidden viewBox="0 0 66 12" className="mob-status-marks" fill="currentColor">
      {/* Signal: four bars, rising. */}
      <rect x="0" y="8" width="3" height="4" rx="1" />
      <rect x="4.5" y="6" width="3" height="6" rx="1" />
      <rect x="9" y="3.5" width="3" height="8.5" rx="1" />
      <rect x="13.5" y="1" width="3" height="11" rx="1" />
      {/* Wifi: a dot and two arcs over it. */}
      <path d="M29 11.5a1.6 1.6 0 1 0 0.01 0Z" />
      <path d="M24.8 7.6a6 6 0 0 1 8.4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M22.3 5a9.6 9.6 0 0 1 13.4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Battery: an outline, its charge, its nub. */}
      <rect x="41.5" y="1.5" width="20" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <rect x="43.5" y="3.5" width="14" height="6" rx="1.5" />
      <rect x="63" y="4.5" width="1.8" height="4" rx="0.9" opacity="0.5" />
    </svg>
  );
}

export function Device({
  platform,
  screen,
  answer,
  arrived,
  app,
  reminder,
  label,
  live,
  leaving,
}: {
  platform: Platform;
  screen: ScreenId;
  answer: Answer | null;
  arrived: boolean;
  app: SampleApp;
  reminder: { before: string; after: string };
  /** The group's name. */
  label: string;
  /** Absent: a still picture, every hotspot a <span>. */
  live?: ScreenLive;
  /** The screen a tour's iOS push is leaving, for the push's 0.36s. */
  leaving?: Leaving | null;
}) {
  const left = leaving && leaving.screen !== screen && (
    <Screen
      key={`out-${leaving.key}`}
      platform={leaving.platform}
      screen={leaving.screen}
      answer={leaving.answer}
      arrived={leaving.arrived}
      app={app}
      reminder={reminder}
      out={{ onEnd: leaving.onEnd }}
    />
  );
  return (
    <div
      role="group"
      aria-label={label}
      data-platform={platform}
      data-screen={screen}
      data-arrived={arrived ? "" : undefined}
      data-seen={live?.seen ? "" : undefined}
      className="mob-device"
    >
      <div className="mob-glass" data-tone={toneOf(platform, screen, answer)}>
        <span aria-hidden className="mob-wall" />
        {leaving?.move === "mob-forward" && left}
        {/* A new element for each step, so each is its own picture in a
            transition; the same one across a platform switch, which morphs it. */}
        <Screen
          key={screen}
          platform={platform}
          screen={screen}
          answer={answer}
          arrived={arrived}
          app={app}
          reminder={reminder}
          live={live}
        />
        {leaving?.move === "mob-back" && left}
        <div aria-hidden className="mob-status">
          <span className="mob-status-time" />
          <StatusMarks />
        </div>
        <span aria-hidden className="mob-cutout" />
        <span aria-hidden className="mob-home" />
      </div>
    </div>
  );
}
