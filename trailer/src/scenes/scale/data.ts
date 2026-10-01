/**
 * SCALE copy, verbatim from the product.
 *  · industries: lib/pages/industries/index.ts order and labels, with the
 *    lucide icons assigned in lib/site.ts.
 *  · greetings: the Professional greeting each language's generator writes
 *    (lib/voice/greetings.ts, `intro` with {agent} = Ava), as the lang-*
 *    voices say it — the AI disclosure is part of every one of them.
 *    Line breaks are set per orientation: never inside a word; German
 *    keeps "KI-Assistenten" whole.
 */
import {
  Car,
  Database,
  Dumbbell,
  GraduationCap,
  Hash,
  Home,
  Hotel,
  KeyRound,
  Landmark,
  PawPrint,
  Phone,
  Scale,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Stethoscope,
  Truck,
  Utensils,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { VOICE, type VoiceId } from '../../voice.generated';

/** an industry: its label, its lucide icon, and the label's line breaks on the card [16:9, 9:16] (never inside a word) */
export type Industry = { label: string; Icon: LucideIcon; lines: readonly [readonly string[], readonly string[]] };

/** in pop order: industry i sits on POP_CELL[i] (labels set at 52 px in a 425 px card · 30 px in a 228 px card) */
export const INDUSTRIES: Industry[] = [
  { label: 'Home services', Icon: Wrench, lines: [['Home services'], ['Home', 'services']] },
  { label: 'Real estate', Icon: Home, lines: [['Real estate'], ['Real estate']] },
  { label: 'Restaurants', Icon: Utensils, lines: [['Restaurants'], ['Restaurants']] },
  { label: 'Law firms', Icon: Scale, lines: [['Law firms'], ['Law firms']] },
  { label: 'Auto sales & service', Icon: Car, lines: [['Auto sales &', 'service'], ['Auto sales &', 'service']] },
  { label: 'Logistics & dispatch', Icon: Truck, lines: [['Logistics &', 'dispatch'], ['Logistics &', 'dispatch']] },
  { label: 'Salons & spas', Icon: Scissors, lines: [['Salons & spas'], ['Salons &', 'spas']] },
  { label: 'Veterinary', Icon: PawPrint, lines: [['Veterinary'], ['Veterinary']] },
  { label: 'Insurance', Icon: ShieldCheck, lines: [['Insurance'], ['Insurance']] },
  { label: 'Property management', Icon: KeyRound, lines: [['Property', 'management'], ['Property', 'management']] },
  { label: 'Hotels & hospitality', Icon: Hotel, lines: [['Hotels &', 'hospitality'], ['Hotels &', 'hospitality']] },
  { label: 'Financial services', Icon: Landmark, lines: [['Financial', 'services'], ['Financial', 'services']] },
  { label: 'Retail & e-commerce', Icon: ShoppingBag, lines: [['Retail &', 'e-commerce'], ['Retail &', 'e-commerce']] },
  { label: 'Schools & tutoring', Icon: GraduationCap, lines: [['Schools &', 'tutoring'], ['Schools &', 'tutoring']] },
  { label: 'Gyms & studios', Icon: Dumbbell, lines: [['Gyms &', 'studios'], ['Gyms &', 'studios']] },
  { label: 'Clinics & dental', Icon: Stethoscope, lines: [['Clinics &', 'dental'], ['Clinics &', 'dental']] },
];

/**
 * A greeting: the product's Professional greeting (lib/voice/greetings.ts,
 * `intro` with {agent} = Ava), as Ava SAYS it — its words are the voice's
 * own words (src/voice.generated.ts), so the text is verbatim and every word
 * is timed. English and Japanese are heard whole: their focus card shows the
 * whole greeting (`main`). The quick four are cut by the next voice right
 * after her name, so their focus card shows only what is HEARD (`heard`):
 * one glanceable line ("Sunt Ava," … "Sie sprechen mit Ava,") that matches
 * the voice and is read in its second.
 */
export type Lang = {
  name: string;
  /** the voice line */
  id: VoiceId;
  /** the AI disclosure, as word indices [first, last] (underlined; never its full stop) */
  ai: readonly [number, number];
  /** line breaks of the whole greeting in the focus card, as word counts [16:9, 9:16] (they must add up to its words) */
  main: readonly [readonly number[], readonly number[]];
  /** line breaks of the gallery card's line [16:9, 9:16] (its first words: what she said before the next voice) */
  gallery: readonly [readonly number[], readonly number[]];
  /** the big line's size in the focus card [16:9, 9:16] (px; Japanese: the CJK size) */
  size: readonly [number, number];
  /** the quick four: the heard fragment's line breaks in the focus card [16:9, 9:16] (its first words) */
  heard?: readonly [readonly number[], readonly number[]];
  /** Japanese: words join with no space and reveal per character */
  cjk?: boolean;
};

/**
 * The brief's six (each the product's Professional greeting). Line breaks never fall inside a word.
 * Set in Instrument Sans 460, −0.03em (the knowledge heading's face). English (a two-line card of its
 * own) 132 / 108 px; the quick four show the heard fragment on ONE line at one size, 120 / 90 px
 * ("Sie sprechen mit Ava," ≈ 1127 px in the 1148 px text box · 845 in 864); Japanese in Noto Sans JP
 * at the CJK size (TYPE_JP: × .86 of English). `main` stays the whole greeting (the record of what
 * the product says; not shown for the quick four). (The per-line widths noted below are the old
 * serif's; the cards are sized for the sans.)
 */
export const LANGS: Lang[] = [
  { name: 'English', id: 'lang-en', ai: [4, 5], main: [[3, 3], [3, 3]], gallery: [[3], [3]], size: [132, 108] },
  // "Sunt Ava, asistentul virtual / cu inteligență artificială." (1051 px) · "Sunt Ava, / asistentul virtual / cu inteligență artificială." (848)
  { name: 'Romanian', id: 'lang-ro', ai: [4, 6], main: [[4, 3], [2, 2, 3]], gallery: [[2], [2]], size: [120, 90], heard: [[2], [2]] },
  // "Soy Ava, el asistente virtual / con inteligencia artificial." (1061) · "Soy Ava, / el asistente virtual / con inteligencia artificial." (865)
  { name: 'Spanish', id: 'lang-es', ai: [5, 7], main: [[5, 3], [2, 3, 3]], gallery: [[2], [2]], size: [120, 90], heard: [[2], [2]] },
  // "Ici Ava, l'assistant virtuel / basé sur l'intelligence artificielle." (1103) · "Ici Ava, / l'assistant virtuel basé sur / l'intelligence artificielle." (856)
  { name: 'French', id: 'lang-fr', ai: [4, 7], main: [[4, 4], [2, 4, 2]], gallery: [[2], [2]], size: [120, 90], heard: [[2], [2]] },
  // "Sie sprechen mit Ava, / dem KI-Assistenten." (937 · 837)
  { name: 'German', id: 'lang-de', ai: [5, 5], main: [[4, 2], [4, 2]], gallery: [[2, 2], [2, 2]], size: [120, 90], heard: [[4], [4]] },
  // "AIアシスタントの / Avaと申します。" — the AI phrase comes first
  { name: 'Japanese', id: 'lang-ja', ai: [0, 1], main: [[3, 5], [3, 5]], gallery: [[3, 5], [3, 5]], size: [114, 94], cjk: true },
];

/** the spoken words of a greeting (verbatim, with their punctuation) */
export const wordsOf = (l: Lang): string[] => VOICE.lines[l.id].words.map((w) => w.w);

/** the underlined part of a word: the word, not its full stop / comma (nor the Japanese particle) */
export const underlined = (w: string) => w.replace(/[.,。]$/u, '');

/** split a run of text into Latin and CJK pieces (the Latin in Instrument Sans, the CJK in Noto Sans JP) */
export const scriptRuns = (s: string): { s: string; latin: boolean }[] => {
  const out: { s: string; latin: boolean }[] = [];
  for (const ch of Array.from(s)) {
    const latin = /[A-Za-z0-9 ]/.test(ch);
    const last = out[out.length - 1];
    if (last && last.latin === latin) last.s += ch;
    else out.push({ s: ch, latin });
  }
  return out;
};

/** the three after-call stations */
export const STATION_ICONS: LucideIcon[] = [Phone, Hash, Database];
export const STATION_NAMES = ['The call', 'Slack', 'CRM'];
