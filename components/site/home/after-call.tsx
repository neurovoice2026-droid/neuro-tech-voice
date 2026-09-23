import { Frame, PillLink, Rule } from "@/components/site/product/primitives";
import { HOME } from "@/lib/pages/home";
import { AfterRelay, type AfterRelayData } from "./after-call-relay";
import { HomeHeading } from "./heading";
import { TYPE, WEIGHT } from "./type";

/* ------------------------------------------------------------------ *
 * #after — does anything happen after the call without me?
 *
 * The integrations relay, turned on its side: a call's record arrives at
 * the top, runs down a rail into the one rule it matches, the rule's steps
 * tick off in order, and what they produce lands at the bottom — a tag
 * flying back up onto the call itself. The four moments a rule can start
 * on sit in the left column and pick the sample.
 *
 * This shell stays on the server: the copy is resolved here (the run-done
 * line is a function in the source), so the client stage receives plain
 * strings and none of the landing's copy modules.
 * ------------------------------------------------------------------ */

export function AfterCall() {
  const a = HOME.after;
  const r = a.relay;
  // The picker follows the trigger list's order; each trigger has one sample.
  const scenes = a.triggers.map((t) => {
    const s = r.scenes.find((x) => x.trigger === t.id);
    if (!s) throw new Error(`#after: no sample run for the "${t.id}" trigger`);
    return { ...s, runDone: r.runDone(s.actions.length) };
  });
  const initial = Math.max(
    0,
    scenes.findIndex((s) => s.trigger === a.defaultScene),
  );

  const data: AfterRelayData = {
    triggers: a.triggers.map(({ id, label, body }) => ({ id, label, body })),
    scenes,
    initial,
    stepTitle: a.stepTitle,
    labels: {
      sample: r.sample,
      callTitle: r.callTitle,
      ruleTitle: r.ruleTitle,
      outTitle: r.outTitle,
      when: r.when,
      then: r.then,
      queued: r.queued,
      running: r.running,
      pick: r.pick,
      pause: r.pause,
      play: r.play,
      replay: HOME.call.controls.replay,
      noSummary: r.noSummary,
      sentiment: r.sentiment,
    },
  };

  // A hyphenated word never breaks at its hyphen ("follow- / up").
  const title = a.title.split(/(\S+-\S+)/).map((part, i) =>
    i % 2 ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );

  return (
    <section id="after" aria-labelledby="after-title" className="scroll-mt-28">
      {/* Phones: heading, picker, stage, link. From lg the stage takes the
          right column and the other three stack on the left. */}
      <Frame className="flex flex-col lg:grid lg:grid-cols-[384px_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-12">
        <HomeHeading
          id="after-title"
          eyebrow={a.eyebrow}
          title={title}
          sub={a.sub}
          className="lg:col-start-1 lg:row-start-1"
        />
        <AfterRelay data={data} />
        <div className="mt-8 lg:col-start-1 lg:row-start-3">
          <PillLink href={a.link.href} variant="secondary" size="sm">
            {a.link.label}
          </PillLink>
        </div>
      </Frame>

      <Rule className="mt-10 lg:mt-12" />

      <Frame className="mt-8 grid gap-4 lg:grid-cols-[384px_minmax(0,1fr)] lg:gap-x-12">
        <div>
          <h3 className={TYPE.h3} style={{ fontWeight: WEIGHT.h3 }}>
            {a.google.title}
          </h3>
          <p className={`mt-1 max-w-[560px] text-pretty ${TYPE.meta}`}>{a.google.body}</p>
        </div>
        <div className="flex max-w-[640px] flex-col gap-2 lg:pt-1">
          {a.trademarks.map((t) => (
            <p key={t} className="text-[12px] leading-[17px] text-pp-muted">
              {t}
            </p>
          ))}
        </div>
      </Frame>
    </section>
  );
}
