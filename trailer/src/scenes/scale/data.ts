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

export type Industry = { label: string; Icon: LucideIcon };

/** in pop order: industry i sits on POP_CELL[i] */
export const INDUSTRIES: Industry[] = [
  { label: 'Home services', Icon: Wrench },
  { label: 'Real estate', Icon: Home },
  { label: 'Restaurants', Icon: Utensils },
  { label: 'Law firms', Icon: Scale },
  { label: 'Auto sales & service', Icon: Car },
  { label: 'Logistics & dispatch', Icon: Truck },
  { label: 'Salons & spas', Icon: Scissors },
  { label: 'Veterinary', Icon: PawPrint },
  { label: 'Insurance', Icon: ShieldCheck },
  { label: 'Property management', Icon: KeyRound },
  { label: 'Hotels & hospitality', Icon: Hotel },
  { label: 'Financial services', Icon: Landmark },
  { label: 'Retail & e-commerce', Icon: ShoppingBag },
  { label: 'Schools & tutoring', Icon: GraduationCap },
  { label: 'Gyms & studios', Icon: Dumbbell },
  { label: 'Clinics & dental', Icon: Stethoscope },
];

/**
 * A greeting: the product's Professional greeting (lib/voice/greetings.ts,
 * `intro` with {agent} = Ava), as Ava SAYS it — its words are the voice's
 * own words (src/voice.generated.ts), so the text is verbatim and every word
 * is timed. The big line is the words in `main` (the quick four: what she
 * says before the next voice cuts in).
 */
export type Lang = {
  name: string;
  /** the voice line */
  id: VoiceId;
  /** the AI disclosure, as word indices [first, last] (underlined; never its full stop) */
  ai: readonly [number, number];
  /** line breaks of the big line, as word counts [16:9, 9:16] */
  main: readonly [readonly number[], readonly number[]];
  /** line breaks of the big line in the gallery card [16:9, 9:16] (the gallery shows the big words only) */
  gallery: readonly [readonly number[], readonly number[]];
  /** the big line's size in the focus card [16:9, 9:16] (px; Japanese: the CJK size) */
  size: readonly [number, number];
  /** Japanese: words join with no space and reveal per character */
  cjk?: boolean;
};

/** The brief's six (each the product's Professional greeting). Line breaks never fall inside a word. */
export const LANGS: Lang[] = [
  { name: 'English', id: 'lang-en', ai: [4, 5], main: [[3, 3], [3, 3]], gallery: [[3], [3]], size: [150, 128] },
  { name: 'Romanian', id: 'lang-ro', ai: [4, 6], main: [[2], [2]], gallery: [[2], [2]], size: [156, 132] },
  { name: 'Spanish', id: 'lang-es', ai: [5, 7], main: [[2], [2]], gallery: [[2], [2]], size: [156, 132] },
  { name: 'French', id: 'lang-fr', ai: [4, 7], main: [[2], [2]], gallery: [[2], [2]], size: [156, 132] },
  // one line in 16:9 (≈ 1040 px at 134), two in 9:16
  { name: 'German', id: 'lang-de', ai: [5, 5], main: [[4], [2, 2]], gallery: [[2, 2], [2, 2]], size: [134, 118] },
  // "AIアシスタントの / Avaと申します。" — the AI phrase comes first
  { name: 'Japanese', id: 'lang-ja', ai: [0, 1], main: [[3, 5], [3, 5]], gallery: [[3, 5], [3, 5]], size: [110, 88], cjk: true },
];

/** the spoken words of a greeting (verbatim, with their punctuation) */
export const wordsOf = (l: Lang): string[] => VOICE.lines[l.id].words.map((w) => w.w);

/** the underlined part of a word: the word, not its full stop / comma (nor the Japanese particle) */
export const underlined = (w: string) => w.replace(/[.,。]$/u, '');

/** split a run of text into Latin and CJK pieces (the Latin set in Cormorant, the CJK in Noto Serif JP) */
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
