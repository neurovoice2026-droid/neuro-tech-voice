"use client";

import { useEffect, useRef, useState } from "react";
import { Hash, Tag, Timer, Webhook } from "lucide-react";
import { INT_ACTIONS, INT_PAYLOAD, type ActionKind } from "@/lib/pages/integrations";
import { cn } from "@/lib/utils";
import { Frame, Rule, SectionHeading } from "../primitives";
import { useInView, usePrefersReducedMotion } from "../timing";

/* ------------------------------------------------------------------ *
 * What a workflow can do today, and — for whoever builds the other end —
 * exactly what arrives.
 *
 * The four actions are cards, each showing what its step leaves behind.
 * The payload is an explorer: the field list on one side, the request
 * body on the other; pointing at a field lights its line in the body, and
 * left alone the explorer walks the fields itself.
 * ------------------------------------------------------------------ */

const ICON: Record<ActionKind, typeof Webhook> = { webhook: Webhook, slack: Hash, tag: Tag, wait: Timer };

/** What each action leaves behind, drawn as the smallest honest artefact. */
function Trace({ kind }: { kind: ActionKind }) {
  if (kind === "webhook")
    return (
      <p className="flex items-center gap-2 font-mono text-[12px] leading-4">
        <span className="rounded-md bg-[#17131f] px-2 py-1 text-[#b8a2dc]">POST</span>
        <span className="text-pp-muted">→</span>
        <span className="rounded-md bg-[#e6f4ea] px-2 py-1 text-[#1f6b3f]">200</span>
      </p>
    );
  if (kind === "slack")
    return (
      <p className="w-fit rounded-xl bg-white px-3 py-2 text-[12px] leading-4 shadow-[0_0_0_1px_rgb(24_16_40/0.06)]">
        <span className="text-pp-muted"># front-desk</span>
        <span className="mt-1 block">📞 inbound call from +1 555 0142</span>
      </p>
    );
  if (kind === "tag")
    return (
      <p className="w-fit rounded-md bg-[#551a89]/10 px-2 py-1 font-mono text-[12px] leading-4 text-[#551a89]">
        [tag:follow-up]
      </p>
    );
  return (
    <p className="flex items-center gap-2 text-[12px] leading-4 text-pp-muted">
      <span className="relative block h-1.5 w-28 overflow-hidden rounded-full bg-white">
        <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-[#551a89]/60" />
      </span>
      5 s
    </p>
  );
}

export function IntActions() {
  return (
    <>
      <Frame className="px-6 pb-10 md:px-12 md:pb-14">
        <SectionHeading eyebrow={INT_ACTIONS.eyebrow} className="max-w-[760px]">
          {INT_ACTIONS.title}
        </SectionHeading>
      </Frame>
      <Frame className="grid gap-4 px-4 md:grid-cols-2 md:px-6">
        {INT_ACTIONS.items.map((a) => {
          const Icon = ICON[a.id];
          return (
            <div
              key={a.id}
              className="group flex flex-col rounded-[24px] bg-pp-card p-6 transition-[background-color,box-shadow] duration-300 hover:bg-white hover:shadow-[0_0_0_1px_rgb(24_16_40/0.06),0_24px_48px_-32px_rgb(24_16_40/0.45)] md:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-10 place-items-center rounded-xl bg-white text-[#551a89] shadow-[0_0_0_1px_rgb(24_16_40/0.06)] transition-transform duration-300 group-hover:-translate-y-0.5">
                  <Icon className="size-5" strokeWidth={1.7} />
                </span>
                <Trace kind={a.id} />
              </div>
              <h3 className="mt-6 text-[18px] leading-7">{a.title}</h3>
              <p className="mt-1 text-[15px] leading-[22px] text-pp-muted">{a.body}</p>
              <p className="mt-auto pt-5 text-[13px] leading-[18px] text-pp-ink/70">{a.needs}</p>
            </div>
          );
        })}
      </Frame>
      <Frame className="px-6 pt-5 md:px-12">
        <p className="max-w-[760px] text-[12px] leading-[18px] text-pp-muted">{INT_ACTIONS.trademarks}</p>
      </Frame>
    </>
  );
}

/* ─── The payload ────────────────────────────────────────────────── */

type Line = { text: React.ReactNode; field?: string; depth: number };

function bodyLines(): Line[] {
  const f = INT_PAYLOAD.fields;
  const value = (key: string) => f.find((x) => x.key === key)!.example;
  const pair = (key: string, name: string, comma = true): Line => ({
    field: key,
    depth: key.startsWith("call.") ? 2 : 1,
    text: (
      <>
        <span className="text-[#b8a2dc]">&quot;{name}&quot;</span>: <span className="text-[#f2c6a0]">{value(key)}</span>
        {comma ? "," : ""}
      </>
    ),
  });
  return [
    { text: <span className="text-white/50">{"{"}</span>, depth: 0 },
    pair("event", "event"),
    {
      text: (
        <>
          <span className="text-[#b8a2dc]">&quot;call&quot;</span>: <span className="text-white/50">{"{"}</span>
        </>
      ),
      depth: 1,
    },
    pair("call.id", "id"),
    pair("call.conversation_id", "conversation_id"),
    pair("call.caller_number", "caller_number"),
    pair("call.direction", "direction"),
    pair("call.duration_seconds", "duration_seconds"),
    pair("call.status", "status"),
    pair("call.sentiment", "sentiment"),
    pair("call.summary", "summary"),
    pair("call.started_at", "started_at", false),
    { text: <span className="text-white/50">{"},"}</span>, depth: 1 },
    pair("timestamp", "timestamp", false),
    { text: <span className="text-white/50">{"}"}</span>, depth: 0 },
  ];
}

export function IntPayload() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "-15% 0px");
  const reduce = usePrefersReducedMotion();
  const fields = INT_PAYLOAD.fields;
  const [auto, setAuto] = useState(0);
  const [held, setHeld] = useState<number | null>(null);
  const lines = bodyLines();

  useEffect(() => {
    if (!inView || reduce || held !== null) return;
    const id = window.setInterval(() => setAuto((i) => (i + 1) % fields.length), 1800);
    return () => window.clearInterval(id);
  }, [inView, reduce, held, fields.length]);

  const active = held ?? (reduce ? -1 : auto);
  const activeKey = active >= 0 ? fields[active].key : null;

  return (
    <>
      <Frame className="grid gap-6 px-6 pb-10 md:px-12 md:pb-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <SectionHeading eyebrow={INT_PAYLOAD.eyebrow} className="max-w-[640px]">
          {INT_PAYLOAD.title}
        </SectionHeading>
        <p className="max-w-[380px] text-[15px] leading-[22px] text-pp-muted">{INT_PAYLOAD.body}</p>
      </Frame>

      <Frame className="px-4 md:px-6">
        <div ref={ref} className="grid overflow-hidden rounded-[24px] bg-pp-card lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)]">
          <ul className="flex flex-col p-3 md:p-4" onPointerLeave={() => setHeld(null)}>
            {fields.map((f, i) => (
              <li
                key={f.key}
                onPointerEnter={() => setHeld(i)}
                className={cn(
                  "grid items-baseline gap-x-4 gap-y-0.5 rounded-xl px-3 py-2 transition-colors duration-300 sm:grid-cols-[minmax(0,190px)_minmax(0,1fr)]",
                  i === active ? "bg-white shadow-[0_0_0_1px_rgb(24_16_40/0.06)]" : "",
                )}
              >
                <code className={cn("truncate font-mono text-[13px] leading-5", i === active ? "text-[#551a89]" : "text-pp-ink")}>
                  {f.key}
                </code>
                <span className="text-[14px] leading-5 text-pp-muted">{f.meaning}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col bg-[#17131f] text-white">
            <p className="border-b border-white/10 px-5 py-3 font-mono text-[12px] leading-4 text-white/60">{INT_PAYLOAD.method}</p>
            <pre className="flex-1 overflow-x-auto py-4 font-mono text-[12.5px] leading-[22px]">
              {lines.map((l, i) => {
                const on = !!l.field && l.field === activeKey;
                return (
                  <span
                    key={i}
                    className={cn(
                      "relative block pr-5 transition-colors duration-300",
                      on ? "bg-[#551a89]/35" : "",
                    )}
                    style={{ paddingLeft: `${20 + l.depth * 16}px` }}
                  >
                    {on && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-[#b8a2dc]" />}
                    {l.text}
                  </span>
                );
              })}
            </pre>
          </div>
        </div>
      </Frame>

      <Rule className="mt-4" />
      <Frame className="grid divide-y divide-pp-rule md:grid-cols-3 md:divide-x md:divide-y-0">
        {INT_PAYLOAD.notes.map((n) => (
          <div key={n.id} className="px-6 py-8 md:px-12 md:py-10">
            <h3 className="text-[15px] leading-[22px]">{n.title}</h3>
            <p className="text-[15px] leading-[22px] text-pp-muted">{n.body}</p>
          </div>
        ))}
      </Frame>
      <Rule />
    </>
  );
}
