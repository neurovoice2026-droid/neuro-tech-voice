import type { Trade } from "@/lib/pages/industries/schema";
import { AUTH } from "@/lib/site";
import { ProductFaq, ProductStart } from "../product/closing";

/* ------------------------------------------------------------------ *
 * The questions and the way in.
 *
 * Both are the shared product-page components, fed from the trade: the
 * first question is always the objection an owner in this trade really
 * raises, in their own words, answered honestly rather than deflected.
 * ------------------------------------------------------------------ */

export function IndustryFaq({ trade }: { trade: Trade }) {
  return (
    <ProductFaq
      data={{
        eyebrow: "Questions",
        title: `What ${trade.label.toLowerCase()} owners ask first`,
        items: [
          { id: "objection", q: trade.objection.asks, a: trade.objection.answer },
          ...trade.faq.map((f, i) => ({ id: `q${i}`, q: f.q, a: f.a })),
        ],
        privacy: { label: "Privacy policy", href: "/privacy" },
      }}
    />
  );
}

export function IndustryStart({ trade }: { trade: Trade }) {
  return (
    <ProductStart
      data={{
        eyebrow: "Start",
        title: `Put it on your ${trade.label.toLowerCase()} line`,
        body: "Fourteen days free, no card. Point your calls at it when you are ready, and take them back the moment you are not.",
        primary: { label: "Start free", href: `/register?trade=${trade.slug}` },
        // The number, as the product pages do: there is no /contact page, and
        // a button that 404s on sixteen routes is worse than no button.
        secondary: { label: "Talk to us", href: AUTH.contactSales },
        note: "It answers on the first ring and tells the caller it is an assistant.",
        more: { label: "See all industries", href: "/industries" },
      }}
    />
  );
}
