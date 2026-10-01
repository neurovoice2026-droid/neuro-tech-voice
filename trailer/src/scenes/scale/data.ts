/**
 * SCALE copy, verbatim from the product.
 *  · industries: lib/pages/industries/index.ts order and labels, with the
 *    lucide icons assigned in lib/site.ts.
 *  · greetings: the Professional greeting each language's generator writes
 *    (lib/voice/greetings.ts, `intro` with {agent} = Ava) — the AI
 *    disclosure is part of every one of them, so it is the big line.
 *    Line breaks are set per orientation (a native speaker should check
 *    them): never inside a word; German keeps "KI-Assistenten" whole.
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

/** a greeting as it is set in one orientation: its lead lines, then its AI-phrase lines */
export type Setting = { lead: string[]; ai: string[] };

export type Lang = {
  name: string;
  /** 16:9 — 84 px in a 621 px cell (every line measured ≤ 557 px in Cormorant 500) */
  h: Setting;
  /** 9:16 — 80 px in a 1056 px cell (every line ≤ 1004 px) */
  v: Setting;
  /** Japanese: the AI phrase comes first ("AIアシスタントの / Avaと申します。") */
  aiFirst?: boolean;
  /** reveal per character (Japanese), as the site does */
  perChar?: boolean;
  /** the face size when its optical size differs (CJK fills the em) [16:9, 9:16] */
  size?: [number, number];
};

/**
 * The brief's six, each the product's Professional greeting (lib/voice/greetings.ts,
 * `intro` with {agent} = Ava), set whole — never trimmed — and never broken inside a
 * word; the AI disclosure is underlined. German keeps "KI-Assistenten" whole.
 */
export const LANGS: Lang[] = [
  { name: 'English', h: { lead: ['This is Ava,'], ai: ['an AI assistant.'] }, v: { lead: ['This is Ava,'], ai: ['an AI assistant.'] } },
  {
    name: 'Romanian',
    h: { lead: ['Sunt Ava,', 'asistentul virtual'], ai: ['cu inteligență', 'artificială.'] },
    v: { lead: ['Sunt Ava, asistentul virtual'], ai: ['cu inteligență artificială.'] },
  },
  {
    name: 'Spanish',
    h: { lead: ['Soy Ava, el', 'asistente virtual'], ai: ['con inteligencia', 'artificial.'] },
    v: { lead: ['Soy Ava, el asistente virtual'], ai: ['con inteligencia artificial.'] },
  },
  {
    name: 'French',
    h: { lead: ['Ici Ava,', "l'assistant virtuel"], ai: ['basé sur', "l'intelligence", 'artificielle.'] },
    v: { lead: ["Ici Ava, l'assistant virtuel"], ai: ["basé sur l'intelligence", 'artificielle.'] },
  },
  {
    name: 'German',
    h: { lead: ['Sie sprechen', 'mit Ava, dem'], ai: ['KI-Assistenten.'] },
    v: { lead: ['Sie sprechen mit Ava, dem'], ai: ['KI-Assistenten.'] },
  },
  // CJK glyphs fill the em: 66 px Noto Serif JP stands taller than 84 px Cormorant (ink height ≈ 58 vs 53 px cap)
  {
    name: 'Japanese',
    h: { lead: ['Avaと申します。'], ai: ['AIアシスタントの'] },
    v: { lead: ['Avaと申します。'], ai: ['AIアシスタントの'] },
    aiFirst: true,
    perChar: true,
    size: [66, 76],
  },
];

/** the underlined part of an AI-phrase line: the words, not the full stop (nor the Japanese particle) */
export const underlined = (line: string) => line.replace(/[.,。の]$/u, '');

/** the three after-call stations */
export const STATION_ICONS: LucideIcon[] = [Phone, Hash, Database];
export const STATION_NAMES = ['The call', 'Slack', 'CRM'];
