import type { VoiceToolName } from "@/lib/voice/contracts";
import type { Trade } from "@/lib/pages/industries/schema";
import { TOOL_NEEDS } from "@/lib/pages/industries/schema";
import { TIERS } from "@/lib/site";
import { Eyebrow, Frame, PillLink, SectionTitle } from "../product/primitives";

/* ------------------------------------------------------------------ *
 * §7 — Go live.
 *
 * The objection: it'll take weeks and I'll be babysitting it. The
 * answer is three gates rather than three price cards, and which gate a
 * capability sits behind is read off the tools this trade's own page
 * just demonstrated — so the law-firm page honestly shows everything it
 * demonstrated working on any plan, and is stronger for it.
 *
 * Deliberately the only still section on the page. After five
 * instruments, stillness reads as the end.
 * ------------------------------------------------------------------ */

const WHAT: Record<VoiceToolName, string> = {
  get_call_context: "Knows the date, your hours and the caller's number",
  search_knowledge: "Answers questions from your own documents",
  check_availability: "Reads your real diary before it offers anything",
  book_appointment: "Puts the job in the calendar",
  find_booking: "Finds an existing booking to change",
  reschedule_appointment: "Moves a booking",
  cancel_appointment: "Cancels and frees the slot",
  add_to_waitlist: "Holds someone for a cancellation",
  send_sms: "Texts the caller a confirmation",
  take_message: "Takes a message, in the caller's words",
  notify_team: "Tells your team, during the call",
  transfer_call: "Puts the caller through to a person",
  save_lead_details: "Writes down the details you asked for",
  end_call: "Ends the call cleanly",
};

function toolsUsedBy(trade: Trade): VoiceToolName[] {
  const used = new Set<VoiceToolName>();
  for (const i of trade.intents) used.add(i.reaches);
  for (const f of trade.rig.fields) if (f.from !== "caller") used.add(f.from);
  for (const r of trade.toolRuns) used.add(r.tool);
  for (const b of trade.relay.by) used.add(b);
  return [...used];
}

export function GoLive({ trade }: { trade: Trade }) {
  const used = toolsUsedBy(trade);
  const starter = TIERS.find((t) => t.id === "starter");
  const pro = TIERS.find((t) => t.id === "pro");

  const floor = used.filter((t) => TOOL_NEEDS[t] === null || TOOL_NEEDS[t] === "knowledge" || TOOL_NEEDS[t] === "transfer" || TOOL_NEEDS[t] === "lead_fields");
  const onStarter = used.filter((t) => TOOL_NEEDS[t] === "sms");
  const onPro = used.filter((t) => TOOL_NEEDS[t] === "calendar" || TOOL_NEEDS[t] === "waitlist");

  const columns = [
    {
      head: "On any plan",
      note: "Nothing to connect beyond saving a contact and adding your documents.",
      tools: floor,
    },
    {
      head: starter ? `Starter — $${starter.monthly} a month` : "Starter",
      note: "Needs a text-capable number on your account.",
      tools: onStarter,
    },
    {
      head: pro ? `Pro — $${pro.monthly} a month` : "Pro",
      note: "Needs Google Calendar connected. Until it is, these calls become messages instead.",
      tools: onPro,
    },
  ].filter((c) => c.tools.length > 0);

  return (
    <section>
      <Frame className="px-6 md:px-12">
        <Eyebrow>Go live</Eyebrow>
        <SectionTitle className="mt-4 max-w-[820px]">
          A number of its own, briefed for your trade, this afternoon
        </SectionTitle>
        <p className="mt-5 max-w-[560px] text-base leading-[25px] text-pp-ink/80">
          Everything on this page works on some plan. Here is exactly which, so nothing you just
          watched turns out to be behind a wall you did not know about.
        </p>
      </Frame>

      <Frame className="mt-8 px-6 md:px-12">
        <div className="grid gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-pp-rule">
          {columns.map((c, i) => (
            <div key={c.head} className={i > 0 ? "md:pl-8" : "md:pr-8"}>
              <p className="text-[15px] leading-[22px] font-medium text-pp-ink">{c.head}</p>
              <p className="mt-1.5 text-[13px] leading-5 text-pp-muted">{c.note}</p>
              <ul className="mt-4 space-y-2">
                {c.tools.map((t) => (
                  <li key={t} className="flex gap-2.5 text-[14px] leading-[21px] text-pp-ink/85">
                    <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-pp-accent" />
                    {WHAT[t]}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Frame>

      <Frame className="mt-10 px-6 md:px-12">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-6">
          <PillLink href={`/register?trade=${trade.slug}`}>Start free</PillLink>
          <PillLink href="/#pricing" variant="secondary">
            See the plans
          </PillLink>
        </div>
        {/* The two things every vendor in this category leaves off the page. */}
        <p className="mt-5 max-w-[620px] text-[13px] leading-5 text-pp-muted">
          Your agent gets a new number; we cannot port your existing one, so the new number sits
          alongside your line and you forward to it when you are ready. Local numbers only — no mobile
          or toll-free yet.
        </p>
      </Frame>
    </section>
  );
}
