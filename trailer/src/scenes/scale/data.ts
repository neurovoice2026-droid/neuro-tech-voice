/**
 * SCALE copy, verbatim from the site.
 *  · industries: lib/pages/industries/index.ts order, labels, and the lucide
 *    icons assigned in lib/site.ts (strokeWidth 1.75 as the header strip).
 *  · greetings: fragments of the Professional greetings the product's own
 *    generator writes (lib/voice/greetings.ts), set as two short lines.
 */
import {
  Car,
  Dumbbell,
  GraduationCap,
  Home,
  Hotel,
  KeyRound,
  Landmark,
  PawPrint,
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

export type Industry = { n: string; label: string; Icon: LucideIcon };

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
].map((d, i) => ({ ...d, n: String(i + 1).padStart(2, '0') }));

export type Lang = {
  name: string;
  /** the greeting, as the lines it is set in (16:9 cells) */
  lines: string[];
  /** narrower 9:16 cells: the same words, set in more lines */
  linesV?: string[];
  /** the AI-disclosure phrase that takes the site's underline (EN only) */
  disclose?: string;
  /** reveal per character (Japanese), as the site does */
  perChar?: boolean;
};

export const LANGS: Lang[] = [
  { name: 'English', lines: ['This is Ava,', 'an AI assistant.'], disclose: 'an AI assistant' },
  { name: 'Romanian', lines: ['Sunt Ava,', 'asistentul virtual.'], linesV: ['Sunt Ava,', 'asistentul', 'virtual.'] },
  { name: 'Spanish', lines: ['Soy Ava,', 'el asistente virtual.'], linesV: ['Soy Ava,', 'el asistente', 'virtual.'] },
  { name: 'French', lines: ['Ici Ava,', "l'assistant virtuel."], linesV: ['Ici Ava,', "l'assistant", 'virtuel.'] },
  { name: 'German', lines: ['Sie sprechen', 'mit Ava.'] },
  { name: 'Japanese', lines: ['Avaと申します。'], perChar: true },
];
