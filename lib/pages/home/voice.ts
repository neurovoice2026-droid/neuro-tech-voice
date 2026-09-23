import { LANG_COUNT, PLATFORM } from "@/lib/pages/ai-agents";
import { TONES, TRUST } from "@/lib/site";
import { must, sentences } from "./source";

/* ─── #how: what the caller hears ────────────────────────────────── *
 * The greetings are the app's own output, built on the server
 * (home.server.ts buildGreetingTable); this is the section's frame.
 */

/** The register the greeting is written in; six tones collapse to three. */
export type HomeRegister = "formal" | "professional" | "casual";

const REGISTERS: readonly HomeRegister[] = ["formal", "professional", "casual"];

const disclosure = must(TRUST.items, "languages");

export const HOME_VOICE = {
  eyebrow: "What the caller hears", // src: components/site/register.tsx:184
  title: PLATFORM.design.title,
  key: "plain language",
  // NEW
  sub: `Pick a register and one of ${LANG_COUNT} languages. When you don't write your own greeting, this is the code that writes your agent's first line — and the sentence saying it's an AI is in every version.`,
  stageLabel: `${PLATFORM.design.greeting} · ${PLATFORM.design.company}, a made-up business`, // NEW after the ·
  tag: disclosure.label,
  customNote: sentences(disclosure.note, 0),
  toneLabel: PLATFORM.design.tone,
  languageLabel: PLATFORM.design.language,
  registers: REGISTERS.map((id) => ({ id, label: must(TONES, id).label })),
  meta: (lang: string, reg: string) => `${lang} · ${reg} · written by the app's own greeting code`, // NEW
} as const;
