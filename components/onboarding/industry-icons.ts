import {
  Briefcase, Building2, Car, Cpu, Dumbbell, GraduationCap, Hotel, House, KeyRound, PawPrint,
  Scale, Scissors, ShoppingBag, Stethoscope, TrendingUp, Truck, Umbrella, Utensils, Wrench,
  type LucideIcon,
} from 'lucide-react'

// Icons for lib/agent-prompts.ts INDUSTRY_OPTIONS. An industry added there
// without an icon here still renders, with the generic briefcase.
const INDUSTRY_ICONS: Record<string, LucideIcon> = {
  technology: Cpu,
  healthcare: Stethoscope,
  real_estate: House,
  finance: TrendingUp,
  retail: ShoppingBag,
  hospitality: Hotel,
  education: GraduationCap,
  legal: Scale,
  automotive: Car,
  home_services: Wrench,
  restaurants: Utensils,
  logistics: Truck,
  salons: Scissors,
  veterinary: PawPrint,
  insurance: Umbrella,
  property_management: KeyRound,
  fitness: Dumbbell,
  other: Building2,
}

export function industryIcon(value: string): LucideIcon {
  return INDUSTRY_ICONS[value] ?? Briefcase
}
