import type { ScenePosters } from "./trade-stage";
import { look as automotive } from "@/components/site/industry/scenes/posters/automotive";
import { look as clinicsDental } from "@/components/site/industry/scenes/posters/clinics-dental";
import { look as education } from "@/components/site/industry/scenes/posters/education";
import { look as financialServices } from "@/components/site/industry/scenes/posters/financial-services";
import { look as fitness } from "@/components/site/industry/scenes/posters/fitness";
import { look as homeServices } from "@/components/site/industry/scenes/posters/home-services";
import { look as hospitality } from "@/components/site/industry/scenes/posters/hospitality";
import { look as insurance } from "@/components/site/industry/scenes/posters/insurance";
import { look as lawFirms } from "@/components/site/industry/scenes/posters/law-firms";
import { look as logistics } from "@/components/site/industry/scenes/posters/logistics";
import { look as propertyManagement } from "@/components/site/industry/scenes/posters/property-management";
import { look as realEstate } from "@/components/site/industry/scenes/posters/real-estate";
import { look as restaurants } from "@/components/site/industry/scenes/posters/restaurants";
import { look as retail } from "@/components/site/industry/scenes/posters/retail";
import { look as salonsSpas } from "@/components/site/industry/scenes/posters/salons-spas";
import { look as veterinary } from "@/components/site/industry/scenes/posters/veterinary";
import { look as customAiAgents } from "@/components/site/solutions/custom-ai-agents/poster";

/*
  Every row's poster and alt for the trades window, without a shader in
  sight: what a posters-only stage (a lite or still device) shows, and
  what any device shows for a scene whose module failed to load.

  Fetched by the stage only when one of those needs it (trade-loaders.ts),
  never part of the page itself, so the other visitors, which draw the
  scenes, do not carry seventeen gradient stacks in their HTML.
*/

const pick = ({ poster, alt }: { poster: string; alt: string }) => ({ poster, alt });

export const TRADE_POSTERS: ScenePosters = {
  "home-services": pick(homeServices),
  "real-estate": pick(realEstate),
  restaurants: pick(restaurants),
  "law-firms": pick(lawFirms),
  automotive: pick(automotive),
  logistics: pick(logistics),
  "salons-spas": pick(salonsSpas),
  veterinary: pick(veterinary),
  insurance: pick(insurance),
  "property-management": pick(propertyManagement),
  hospitality: pick(hospitality),
  "financial-services": pick(financialServices),
  retail: pick(retail),
  education: pick(education),
  fitness: pick(fitness),
  "clinics-dental": pick(clinicsDental),
  "custom-ai-agents": pick(customAiAgents),
};
