import type { ReactNode, RefObject } from "react";
import { Check, Compass, CalendarDays, CalendarPlus, MessageSquareText, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { RING_DARK, RING_LIGHT } from "@/components/site/home/controls";
import type { Answer, Cta, GoId, Platform, SampleApp, ScreenId } from "@/lib/pages/custom-mobile-applications";

/* ------------------------------------------------------------------ *
 * #hold's sample app, screen by screen: what the phone shows at each of
 * the journey's five steps, on either platform, with the sheet, the
 * permission dialog and the notification that sit over them.
 *
 * WHAT IT IS. A booking app for no business in particular, drawn in HTML
 * and CSS: every word is the data module's (`MOB_HOLD.app`, types only
 * here), and a grey bar stands wherever a name, a time, a figure or a
 * price would be, so there is no digit anywhere. Nothing is a picture of
 * a real phone, a real app or a real system screen: the dialog and the
 * notification use the generic phrasing both platforms' own look like,
 * with no logo, no store badge and no wallet button. The iOS alert's
 * message is the system's own, which an app can't write (it only
 * chooses when to ask), so it is drawn as grey bars; its title and
 * answers are the words every app's alert shows.
 *
 * ONE SCREEN, THE LIVE ONE. Unlike the SaaS prototype, which lays every
 * screen in one cell to hold its tallest, the phone has a fixed aspect
 * (device.tsx): each screen fills the same box, and its overlays sit
 * inside it. So only the screen on show exists — no invisible copies,
 * but for the 0.36s of a tour's iOS push, when the screen it leaves is
 * drawn once more as a still picture sliding away (`out`) — and it is
 * the one element on the page that wears `saas-proto-screen`,
 * the name vt.ts's `"proto"` scope and saas-build.css §8 give the SaaS
 * prototype's screen: the phone's moves are that scope's view
 * transitions, each with its platform's own choreography
 * (mob-device.css §5). The #kinds mini phones draw their own screens
 * (sketch.tsx) and never wear it, so the name stays unique and never
 * aborts a transition.
 *
 * WHAT EACH PLATFORM DOES DIFFERENTLY, drawn, never said in a table:
 * iOS has a large left-aligned title, a tab bar, a filled rounded button,
 * a sheet that rises as a card (the page behind scales back), and a
 * centred alert with its two answers side by side; Android has a top app
 * bar, a navigation bar with a pill round the current tab, an outlined
 * field, a pill button, a bottom sheet with a drag handle, and a dialog
 * with its answers stacked. The sizes and radii are CSS, per
 * `[data-platform]` on the device (mob-device.css §1–§4), in container
 * units, so the whole screen scales like a picture with the glass.
 *
 * THE HOTSPOTS ARE REAL BUTTONS (`Hot`): the primary action of each
 * screen, the sheet's way back, the dialog's two answers, and the
 * notification. Each is named with its visible label first, then where
 * it goes ("Pay — opens You’re booked"), wears a dashed ring (an
 * aria-hidden child, so it can pulse without touching the button) and
 * reaches 44px through its ::before. The notification's name is its own
 * words, then where it goes, since its visible text is a message, not a
 * label. Every hotspot carries its `GoId` as `data-mob-go`: the tour's
 * finger reads its centre there. Without `live` (a still picture) each
 * is a <span>.
 *
 * THE HEADING of each screen is a real <h3> with the step's place said
 * first for a screen reader ("Step 3 of 5: Confirm and pay"), and with
 * `live` it is the focus target after a press, a −1 tab stop with the
 * house ring (RING_DARK on the lock screen), since the pressed button
 * has gone with its screen. Everything drawn — the status bar, the tab
 * and navigation bars, the check disc, every glyph and bar — is
 * aria-hidden; the page behind the sheet is aria-hidden and inert, a
 * picture of the screen before it.
 *
 * Pure: no state and no effects, so the stage (phone-stage.tsx) holds
 * all of it and the frame is `frameOf(...)` everywhere.
 * ------------------------------------------------------------------ */

/** What the stage hands a live phone: the heading's ref and its place, the presses, and the pulse's cue. */
export type ScreenLive = {
  titleRef: RefObject<HTMLHeadingElement | null>;
  /** "Step 3 of 5", said before the heading, for a screen reader only. */
  position: string;
  onGo: (go: GoId) => void;
  /** Most of the phone has been on screen once: its hotspots pulse. */
  seen: boolean;
};

type ScreenProps = {
  platform: Platform;
  screen: ScreenId;
  answer: Answer | null;
  arrived: boolean;
  app: SampleApp;
  reminder: { before: string; after: string };
  live?: ScreenLive;
  /**
   * The screen a tour's iOS push leaves, drawn once more as it slides away
   * (mob-device.css §5): a still picture, aria-hidden and inert, that
   * never wears the transition's name; `onEnd` as its slide ends.
   */
  out?: { onEnd: () => void };
};

/** The tab bar's glyphs, in the order of `app.tabs`: drawn, aria-hidden. */
const TAB_GLYPHS = [Compass, CalendarDays, UserRound] as const;

/** A grey bar where a name, a time, a figure or a price would be: sized by its class. */
function Bar({ className }: { className: string }) {
  return <span aria-hidden className={cn("mob-bar", className)} />;
}

/**
 * A hotspot: a button with its ring (and the ring's pulse, mob-device.css
 * §3), named with its visible label first. Its shape — the primary
 * button, a text button, the dialog's answers, the notification — is its
 * class's.
 */
function Hot({
  go,
  cta,
  live,
  className,
  dark,
  children,
}: {
  go: GoId;
  /** The accessible name; absent, the button's own words name it. */
  cta?: Cta;
  live?: ScreenLive;
  className: string;
  /** On the lock screen: the dark ground's focus ring. */
  dark?: boolean;
  children: ReactNode;
}) {
  const ring = <span aria-hidden className="mob-hot-ring" />;
  if (!live) {
    return (
      <span className={cn("mob-hot", className)}>
        {children}
        {ring}
      </span>
    );
  }
  return (
    <button
      type="button"
      data-mob-go={go}
      aria-label={cta?.aria}
      onClick={() => live.onGo(go)}
      className={cn("mob-hot cursor-pointer", className, dark ? RING_DARK : RING_LIGHT)}
    >
      {children}
      {ring}
    </button>
  );
}

/** The screen's heading: the step's place for a screen reader, then the title; with `live`, where focus lands after a press. */
function Title({ live, text, dark, className }: { live?: ScreenLive; text: string; dark?: boolean; className?: string }) {
  return (
    <h3
      ref={live?.titleRef}
      tabIndex={live ? -1 : undefined}
      className={cn("mob-title rounded-sm", dark ? RING_DARK : RING_LIGHT, className)}
    >
      {live && <span className="sr-only">{live.position}: </span>}
      {text}
    </h3>
  );
}

/** The top of a screen: iOS's large title, Android's top app bar (mob-device.css §1). */
function AppBar({ live, text }: { live?: ScreenLive; text: string }) {
  return (
    <div className="mob-appbar">
      <Title live={live} text={text} />
    </div>
  );
}

/** A labelled field, empty: drawn, nothing here takes a keystroke. Filled on iOS, outlined on Android. */
function Field({ label }: { label: string }) {
  return (
    <div className="mob-field">
      <p className="mob-meta">{label}</p>
      <span aria-hidden className="mob-field-box" />
    </div>
  );
}

/** The tab bar (iOS) or the navigation bar (Android), the app's current tab lit: drawn, aria-hidden. */
function Nav({ app }: { app: SampleApp }) {
  return (
    <div aria-hidden className="mob-nav">
      {app.tabs.map((tab, i) => {
        const Glyph = TAB_GLYPHS[i];
        return (
          <span key={tab} className="mob-nav-item" data-current={i === app.active ? "" : undefined}>
            <span className="mob-nav-pill">
              <Glyph className="mob-nav-glyph" strokeWidth={1.75} />
            </span>
            <span className="mob-nav-label">{tab}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ─── The five screens ─────────────────────────────────────────────── */

function SignIn({ app, live }: { app: SampleApp; live?: ScreenLive }) {
  const s = app.signin;
  return (
    <div className="mob-page">
      {/* The app's mark over the title: an electric square, no logo. */}
      <span aria-hidden className="mob-mark" />
      <AppBar live={live} text={s.title} />
      <div className="mob-body">
        <Field label={s.email} />
        <Field label={s.password} />
        <p className="mob-meta">{s.forgot}</p>
        <Hot go="signin.go" cta={s.go} live={live} className="mob-cta">
          {s.go.label}
        </Hot>
        {/* Another way in, drawn: a rule, then an outlined button with a grey
            bar where a provider's name would be. No logo, no words. */}
        <span aria-hidden className="mob-or">
          <Bar className="mob-or-dot" />
        </span>
        <span aria-hidden className="mob-alt">
          <span className="mob-alt-icon" />
          <Bar className="mob-bar-md" />
        </span>
        {/* The screen's foot: a line where "New here?" would be. */}
        <span aria-hidden className="mob-foot">
          <Bar className="mob-bar-sm" />
          <Bar className="mob-bar-sm" />
        </span>
      </div>
    </div>
  );
}

/**
 * "Book a time": the time of day, the free times with one picked, and
 * Continue. Drawn twice: live, and as the page behind the pay sheet,
 * where its button is a picture (`behind`), so no hotspot, heading or
 * view-transition name is ever doubled.
 */
function ChoosePage({ app, live, behind }: { app: SampleApp; live?: ScreenLive; behind?: boolean }) {
  const s = app.choose;
  return (
    <div className="mob-page">
      {behind ? (
        <div className="mob-appbar">
          <p className="mob-title">{s.title}</p>
        </div>
      ) : (
        <AppBar live={live} text={s.title} />
      )}
      <div className="mob-body">
        {/* The week, drawn: a grey bar where each day's name and date would
            be, the picked day electric. */}
        <div aria-hidden className="mob-week">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span key={i} className="mob-day" data-current={i === 2 ? "" : undefined}>
              <Bar className="mob-day-name" />
              <Bar className="mob-day-date" />
            </span>
          ))}
        </div>
        <div aria-hidden className="mob-segment">
          {s.parts.map((p, i) => (
            <span key={p} className="mob-segment-item" data-current={i === 1 ? "" : undefined}>
              {p}
            </span>
          ))}
        </div>
        <p className="mob-meta">{s.free}</p>
        {/* Six free times, one picked: grey bars where the times would be. */}
        <div aria-hidden className="mob-slots">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="mob-slot" data-current={i === 4 ? "" : undefined}>
              <Bar className="mob-slot-bar" />
            </span>
          ))}
        </div>
        {/* Who it's with, drawn: a grey disc and bars where a name and a place would be. */}
        <div aria-hidden className="mob-with">
          <span className="mob-with-disc" />
          <span className="mob-with-bars">
            <Bar className="mob-bar-md" />
            <Bar className="mob-bar-sm" />
          </span>
        </div>
        {behind ? (
          <span className="mob-cta">{s.go.label}</span>
        ) : (
          <Hot go="choose.go" cta={s.go} live={live} className="mob-cta">
            {s.go.label}
          </Hot>
        )}
      </div>
      <Nav app={app} />
    </div>
  );
}

function Pay({ app, platform, live }: { app: SampleApp; platform: Platform; live?: ScreenLive }) {
  const s = app.pay;
  const back = s.back[platform];
  return (
    <>
      {/* The page the sheet rose over: a picture of "Book a time", scaled back
          as a card on iOS, left full size on Android. */}
      <div aria-hidden inert className="mob-behind">
        <ChoosePage app={app} behind />
      </div>
      <span aria-hidden className="mob-scrim" />
      <div className="mob-sheet">
        <span aria-hidden className="mob-grab" />
        <div className="mob-sheet-head">
          <Hot go="pay.back" cta={back} live={live} className="mob-text-btn mob-sheet-back">
            {platform === "android" && (
              <span aria-hidden className="mob-arrow">
                ←
              </span>
            )}
            {back.label}
          </Hot>
        </div>
        <Title live={live} text={s.title} className="mob-sheet-title" />
        <div className="mob-sheet-rows">
          <div className="mob-sheet-row">
            <p className="mob-meta">{s.booking}</p>
            <span aria-hidden className="mob-sheet-bars">
              <Bar className="mob-bar-md" />
              <Bar className="mob-bar-sm" />
            </span>
          </div>
          <div className="mob-sheet-row">
            <p className="mob-meta">{s.deposit}</p>
            <Bar className="mob-bar-sm" />
          </div>
        </div>
        <Field label={s.card} />
        <Hot go="pay.go" cta={s.go} live={live} className="mob-cta">
          {s.go.label}
        </Hot>
      </div>
    </>
  );
}

/**
 * "You’re booked", and — while the reader hasn't answered — the system's
 * question over it. The dialog is a group named by its title; its two
 * answers are the hotspots. Answered (the reader came back from the lock
 * screen), the screen stands alone.
 */
function Booked({
  app,
  platform,
  answer,
  live,
  still,
}: {
  app: SampleApp;
  platform: Platform;
  answer: Answer | null;
  live?: ScreenLive;
  /** The picture of a screen leaving: no id, so none is ever doubled beside the live one's. */
  still?: boolean;
}) {
  const s = app.booked;
  const askId = still ? undefined : `mob-ask-${platform}`;
  return (
    <>
      <div className="mob-page">
        <AppBar live={live} text={s.title} />
        <div className="mob-body">
          <div className="mob-done">
            <span aria-hidden className="mob-done-disc">
              <Check className="mob-done-tick" strokeWidth={2.5} />
            </span>
            <p>{s.body}</p>
          </div>
          {/* The booking, drawn: grey bars where the time and the place would be. */}
          <div aria-hidden className="mob-summary">
            <Bar className="mob-bar-md" />
            <Bar className="mob-bar-lg" />
            <Bar className="mob-bar-sm" />
          </div>
          <p className="mob-cal">
            <CalendarPlus aria-hidden className="mob-cal-glyph" strokeWidth={1.75} />
            {s.calendar}
          </p>
        </div>
        <Nav app={app} />
      </div>
      {answer === null && (
        <div className="mob-ask">
          <span aria-hidden className="mob-scrim" />
          {platform === "ios" ? (
            <div role="group" aria-labelledby={askId} className="mob-dialog">
              <div className="mob-dialog-text">
                <p id={askId} className="mob-dialog-title">
                  {s.ask.ios.title}
                </p>
                {/* The system's own message, which an app can't write: drawn, not worded. */}
                <span aria-hidden className="mob-dialog-bars">
                  <Bar className="mob-bar-lg" />
                  <Bar className="mob-bar-md" />
                </span>
              </div>
              <div className="mob-dialog-actions">
                <Hot go="booked.deny" cta={{ label: s.ask.ios.deny, aria: s.denyAria }} live={live} className="mob-dialog-btn">
                  {s.ask.ios.deny}
                </Hot>
                <Hot
                  go="booked.allow"
                  cta={{ label: s.ask.ios.allow, aria: s.allowAria }}
                  live={live}
                  className="mob-dialog-btn mob-dialog-yes"
                >
                  {s.ask.ios.allow}
                </Hot>
              </div>
            </div>
          ) : (
            <div role="group" aria-labelledby={askId} className="mob-dialog">
              <p id={askId} className="mob-dialog-title">
                {s.ask.android.title}
              </p>
              <div className="mob-dialog-actions">
                <Hot
                  go="booked.allow"
                  cta={{ label: s.ask.android.allow, aria: s.allowAria }}
                  live={live}
                  className="mob-dialog-btn mob-dialog-yes"
                >
                  {s.ask.android.allow}
                </Hot>
                <Hot go="booked.deny" cta={{ label: s.ask.android.deny, aria: s.denyAria }} live={live} className="mob-dialog-btn">
                  {s.ask.android.deny}
                </Hot>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** What the text's grey bar stands for, to a screen reader: the reminder's time is cut out of it. */
const TIME_WORDS = "the time";

/**
 * The reminder as the notification reads to a screen reader, less its
 * "Open …" hint: who it's from and when, then its words (the app's own,
 * or this platform's text with the time cut out). The stage says it when
 * a press's hops land it on the lock screen (phone-stage.tsx), since it
 * arrives there after focus has.
 */
export function noteWords(app: SampleApp, answer: Answer, reminder: { before: string; after: string }): string {
  const s = app.lock;
  return answer === "deny"
    ? `${s.sms.app}, ${s.sms.when}: ${reminder.before}${TIME_WORDS}${reminder.after}`
    : `${s.push.app}, ${s.push.when}: ${s.push.text}`;
}

/**
 * Later, on the lock screen: the time as a bar, and — once the step has
 * arrived — the reminder. Allowed, the app's own notification; not
 * allowed, the text this platform really sends (`reminder`, word for
 * word, the time cut out as a grey bar), the way it sends its own.
 */
function Lock({
  app,
  answer,
  arrived,
  reminder,
  live,
}: {
  app: SampleApp;
  answer: Answer | null;
  arrived: boolean;
  reminder: { before: string; after: string };
  live?: ScreenLive;
}) {
  const s = app.lock;
  const text = answer === "deny";
  return (
    <div className="mob-lockface">
      <Title live={live} text={s.title} dark />
      <Bar className="mob-clock" />
      {arrived && answer !== null && (
        <Hot go="lock.open" live={live} dark className="mob-note">
          <span className="mob-note-head">
            {text ? (
              <span aria-hidden className="mob-note-icon" data-kind="text">
                <MessageSquareText className="mob-note-glyph" strokeWidth={1.75} />
              </span>
            ) : (
              <span aria-hidden className="mob-note-icon" data-kind="app" />
            )}
            <span className="mob-meta mob-note-from">
              {text ? s.sms.app : s.push.app}
              <span aria-hidden> · </span>
              <span className="sr-only">, </span>
              {text ? s.sms.when : s.push.when}
              <span className="sr-only">: </span>
            </span>
          </span>
          <span className="mob-note-text">
            {text ? (
              <>
                {reminder.before}
                <span className="mob-bar mob-note-when">
                  <span className="sr-only">{TIME_WORDS}</span>
                </span>
                {reminder.after}
              </>
            ) : (
              s.push.text
            )}
          </span>
          <span className="sr-only"> — {s.open}</span>
        </Hot>
      )}
      {/* The lock screen's two round buttons at the foot, drawn: iOS only (mob-device.css §4). */}
      <span aria-hidden className="mob-lock-keys">
        <span />
        <span />
      </span>
    </div>
  );
}

/**
 * The live screen: the one element the view transitions move (the
 * `"proto"` scope's name). The device keys it on the screen, so a step
 * change replaces it and a platform switch morphs the same one. With
 * `out`, the picture of the screen a tour's push leaves instead: no
 * name, no `data-live`, hidden and inert, its hotspots spans.
 */
export function Screen({ platform, screen, answer, arrived, app, reminder, live, out }: ScreenProps) {
  const now = out ? undefined : live;
  return (
    <div
      data-live={out ? undefined : ""}
      data-screen={screen}
      aria-hidden={out ? true : undefined}
      inert={out ? true : undefined}
      // Its own slide only: an animation inside it would bubble here too.
      onAnimationEnd={out ? (e) => e.target === e.currentTarget && out.onEnd() : undefined}
      className={cn("mob-screen", out ? "mob-screen-out" : "saas-proto-screen")}
    >
      {screen === "signin" && <SignIn app={app} live={now} />}
      {screen === "choose" && <ChoosePage app={app} live={now} />}
      {screen === "pay" && <Pay app={app} platform={platform} live={now} />}
      {screen === "booked" && <Booked app={app} platform={platform} answer={answer} live={now} still={Boolean(out)} />}
      {screen === "lock" && <Lock app={app} answer={answer} arrived={arrived} reminder={reminder} live={now} />}
    </div>
  );
}
