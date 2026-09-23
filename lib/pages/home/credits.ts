import { PLATFORM } from "@/lib/pages/ai-agents";
import { INT_ACTIONS, INT_GOOGLE } from "@/lib/pages/integrations";
import { GOOGLE_PLAN, SMS_PLAN } from "./gates";
import { HOME_PRICING } from "./pricing";
import { sentences } from "./source";

/**
 * The colophon under the close: everything on the page that is a sample,
 * a fiction, in beta, on a plan of its own, or somebody else's
 * trademark. This is the one place the trademark lines are printed.
 * Terms are NEW; the details are read off the sections they describe.
 * Read by #start's server component only.
 */
export const HOME_CREDITS: readonly { term: string; detail: string }[] = [
  {
    term: `${PLATFORM.design.company} and ${PLATFORM.design.agent}`,
    detail: "A made-up business and agent name. They are used in the sample calls, the greeting and the knowledge base.",
  },
  { term: "The calls and the knowledge base", detail: "Written for this page, days and times included. There is no audio." },
  {
    term: "The trade callers",
    detail: "Sample lines written for the industry pages. The callers, and the people they mention, are made up.",
  },
  {
    term: "The follow-up runs",
    detail: "Sample calls and sample results, written for this page. The webhooks post to example.com addresses.",
  },
  {
    term: "Phone numbers and web addresses",
    detail: "From the 555-01xx range kept for fiction, and example.com.", // src: integrations.ts:25
  },
  { term: "The greetings", detail: "Written by the app's own greeting code for these sample names." },
  {
    term: "The trade instructions",
    detail: "Quoted from the template a new agent starts with. Owners can edit them.",
  },
  { term: "Trade scenes", detail: "Drawn live in WebGL for this site." },
  // The VAT sentence is not repeated here: it sits under the plan grid.
  { term: "The bill estimate", detail: HOME_PRICING.estimator.assumptions },
  {
    term: "Bookings and Google Workspace",
    detail: `${sentences(INT_GOOGLE.body, 1)} Booking by phone and Google steps run on ${GOOGLE_PLAN} and above, and confirmation texts on ${SMS_PLAN} and above. ${INT_GOOGLE.trademarks}`,
  },
  { term: "Slack, Zapier, Make and n8n", detail: INT_ACTIONS.trademarks },
  {
    term: "Rightmove",
    detail: "Named in a trade caller's line. Rightmove is a trademark of its owner; Neuro Tech Voice is not affiliated with it.",
  },
];
