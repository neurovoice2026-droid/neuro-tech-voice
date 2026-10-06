# Instagram profile: @neurotechvoice

The account the ig-* skills (`.claude/skills/ig-*`) work for. They read `~/.claude/instagram/`; in a cloud
session link it to this folder first: `mkdir -p ~/.claude && ln -sfn "$PWD/.claude/instagram" ~/.claude/instagram`
(from the repo root), so `voice.md`, `plan.md`, `log.md` and `swipe.md` live in the repo and survive the session.

## The account

- **URL:** https://www.instagram.com/neurotechvoice
- **Handle:** @neurotechvoice
- **Name field:** Neuro Tech Voice
- **Bio:**
  - The voice layer for global business.
  - Every call answered, in every language.
  - AI agents deployed in 5 minutes - worldwide.
- **Link:** www.neurotechvoice.com
- **Profile photo:** the NEUROVOICE crown mark (purple crown on a light disc)
- **Type:** professional account (has the dashboard: "Panoul de control")
- **Content language:** English (the site, the bio and the films are English; global audience). The owner speaks Romanian.

## Snapshot (2026-10-06, from the owner's screenshots)

- 1 post, 14 followers, 3 following
- Dashboard: 61 views in the last 30 days
- Highlights: none. Banners: none ("Adaugă bannere"). Pinned: none.

## Posts

| # | date | format | hook / cover | length | views | notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | before 2026-10-06 | Reel | "Closed is for the door, not the phone." | cut from film 1 | 52 | the launch trailer's twist beat, 9:16 |

## In the pipeline

- **Knowledge-base explainer** (film 2, 100 s, 9:16 v3, delivered 2026-10-05). Caption: Job A, one ask (DM "AGENT"),
  5 hashtags, see the chat of 2026-10-06.
- **Four 20-30 s motion reels** (Tessa voice-over, 1080x1920 at 120 fps): plan in `trailer/docs/ig/`
  (SCRIPT.md, POSTING.md once written).

## Product facts the content may use (verified in the site code)

- **Trial:** 14-day free trial, 5 minutes included, no credit card required (`types/index.ts` PLANS.trial,
  `app/` pricing FAQ).
- **Prices:** the homepage and the backend (`types/index.ts`) list different plans and prices, so content shows **no prices,
  minute allowances or plan names** (except "Pro" where a feature needs it).
- **Phone number:** a separate $1.15/month purchase that needs a card; the free trial alone answers test calls. Numbers are
  sold in 21 countries, not in DE, ES, FR, IT, NL, PL or RO (`lib/twilio/countries.ts`); no porting, the agent's number sits
  next to the business's line.
- **Gated features:** calendar booking is Pro and up (beta), SMS is Starter and up; the trial has neither
  (`lib/billing/entitlements.ts`).
- **Languages / setup:** 14 languages; "ready in under ten minutes" (site FAQ). The bio's "every language" and "deployed in
  5 minutes" overclaim (see `trailer/docs/ig/POSTING.md` §7 for a corrected bio).
- **Industries on the site:** automotive, clinics & dental, education, financial services, fitness, home services,
  hospitality, insurance, law firms, logistics, property management, real estate, restaurants, retail, salons & spas,
  veterinary (`app/industries/[slug]`).
- **Primary CTA on the site:** "Start free" / "Start free trial".
