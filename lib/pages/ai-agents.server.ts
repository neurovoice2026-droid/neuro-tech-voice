import "server-only";
import { greetingFor } from "@/lib/voice/greetings";
import type { AgentTone } from "@/types";
import { PLATFORM, platformGreetingKey, type PlatformGreetings } from "./ai-agents";

/**
 * Every greeting the platform's settings card can show (each language it
 * offers, in each tone), written here by the app's own greeting code: the
 * card gets them as data, so no greeting code (nor its table of every
 * language the app speaks) ships to the browser.
 */
export function buildPlatformGreetings(): PlatformGreetings {
  const d = PLATFORM.design;
  const out: PlatformGreetings = {};
  for (const lang of d.langs) {
    for (const tone of d.tones) {
      out[platformGreetingKey(lang.code, tone.id)] = greetingFor({
        language: lang.code.toLowerCase(),
        tone: tone.id as AgentTone,
        company: d.company,
        agentName: d.agent,
      });
    }
  }
  return out;
}
