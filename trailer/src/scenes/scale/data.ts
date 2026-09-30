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

export type Lang = {
  name: string;
  /** the name line ("This is Ava,") */
  lead: string;
  /** the AI-disclosure phrase, as the lines it is set in (16:9 cells) */
  ai: string[];
  /** the same words for the narrower 9:16 cells, when they break differently */
  aiV?: string[];
  /** Japanese: the AI phrase comes first ("AIアシスタントの / Avaと申します。") */
  aiFirst?: boolean;
  /** reveal per character (Japanese), as the site does */
  perChar?: boolean;
  /** the AI phrase's size, when the face's optical size differs (CJK) [16:9, 9:16] */
  aiSize?: [number, number];
};

export const LANGS: Lang[] = [
  { name: 'English', lead: 'This is Ava,', ai: ['an AI assistant.'] },
  { name: 'Romanian', lead: 'Sunt Ava, asistentul virtual', ai: ['cu inteligență', 'artificială.'] },
  { name: 'Spanish', lead: 'Soy Ava, el asistente virtual', ai: ['con inteligencia', 'artificial.'] },
  { name: 'French', lead: "Ici Ava, l'assistant virtuel", ai: ['basé sur', "l'intelligence", 'artificielle.'] },
  { name: 'German', lead: 'Sie sprechen mit Ava,', ai: ['dem', 'KI-Assistenten.'] },
  // CJK glyphs fill the em: 66 / 56 px read as large as the 84 / 72 px Cormorant lines (and fit the cell)
  { name: 'Japanese', lead: 'Avaと申します。', ai: ['AIアシスタントの'], aiFirst: true, perChar: true, aiSize: [66, 56] },
];

/** the underlined part of an AI-phrase line: the words, not the full stop (nor the Japanese particle) */
export const underlined = (line: string) => line.replace(/[.,。の]$/u, '');

/** the three after-call stations */
export const STATION_ICONS: LucideIcon[] = [Phone, Hash, Database];
export const STATION_NAMES = ['The call', 'Slack', 'CRM'];
