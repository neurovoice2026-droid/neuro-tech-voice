# IG reels: product truth and reusable kit (research:product)

I read the repo at HEAD `743247a` (`claude/remotion-trailer`) on 2026-10-06. The working tree was clean except for `trailer/docs/ig/`. The only file I wrote is this one. All paths are relative to the repo root (`app/`, `lib/`, `components/` …) or to `trailer/` (`src/`, `scripts/`, `public/`, `docs/`).
This is the factual base for the scriptwriters (section 1) and the builders (sections 2 and 3). `docs/ig/RESEARCH-reels.md` comes from another task and I did not read or touch it.

---

## 0. In short

1. **What it is.** An AI voice agent that answers a business's phone calls. It answers from the owner's documents, books into Google Calendar (in beta, Pro and up), takes messages, hands the call to a person, texts the caller (Starter and up), and files every call with a transcript and a summary. It speaks 14 languages and tells every caller that it is an AI.
2. **The CTA that exists:** a **"Start free"** button that goes to **`https://www.neurotechvoice.com/register`**. The truthful trial line is **"5 free minutes for 14 days · No card needed"**. Prices are public, but the site and the backend disagree on them (§1.10), so **do not quote a price, a minute allowance or an overage rate in a reel.**
3. **Two lines in the client's bio overclaim compared with the site.** "deployed in 5 minutes": the site says "Ready in under ten minutes" and "four screens". "in every language": the site says 14 languages. Reels must use the site's wording (§1.17).
4. **The free trial cannot take customer calls on its own.** A phone number is a separate purchase ($1.15 a month, needs a card). Until then the agent answers only test calls. Never say "start free and it answers your customers today" (§1.6, §1.10).
5. **No real statistics are shown on the live site.** The repo holds three cited third-party studies in unused code (§1.14). Any number in a reel must carry its source on screen or be framed as an illustrative scenario.
6. **Kit:** everything in `src/kb/kit/*` (`index.ts` barrel), `src/kb/palettes.ts` and `src/kb/theme.ts` can be **imported unchanged** by `src/ig/**`. So can about ten timing-free scene parts of film 2 and most of film 1's `components/` and `lib/`. Everything bound to `src/kb/timing.ts` or `src/kb/voice.generated.ts` must be **forked**: Captions, orbs, call strip, waveform, `scene.ts`, `common.tsx` (§2.1).
7. **The biggest hazard to the delivered films:** `scripts/kb/hash.mjs` (film 2's mix hash) reads the bytes of **`scripts/films.mjs`** and of **every `scripts/kb/*.mjs`**. Adding an IG film to `films.mjs`, or any file to `scripts/kb/`, makes film 2's delivered mix "stale" and triggers a rebuild. **Keep `films.mjs` byte-identical: put the IG registry in `scripts/ig/` and merge it in the shared tools** (§3.2).
8. **The second hazard:** a new folder under `public/` (for example `public/ig/`) changes film 1's bundle `index.html`. Its static-file list includes every file in `public/`, and `verify-film1` gate 8 filters out only the `kb/` entries. **Extend that filter** (`scripts/bundle-digest.mjs`) **or give IG its own public dir** (§3.5).
9. **Rendering:** 1080×1920 at 120 fps is `--scale=1` of the kit's 1080×1920 CSS frame. H.264 at 1080×1920 and 120 fps needs **Level 5.1 or higher**. Level 4.2 tops out near 64 fps. At ≤ 28 MB, a 30 s reel gets about 7.1 Mb/s of video (≈ 0.03 bit per pixel per frame), so **the per-frame film grain and the mesh's dither are the main risk to the bit budget** (§3.7).

---

## 1. Product truth (site source)

### 1.1 What the product is, in the site's own words
| Claim (verbatim) | Source |
|---|---|
| "Neuro Tech Voice. / An AI that answers every call / for those who refuse to miss one." (live hero, CTA "Start free" → `/register`) | `lib/site.ts:135-147` (`HERO_COVER`), rendered by `components/site/hero.tsx` |
| "Closed is for the door, not the phone." (homepage first section; the account's first reel already used it) | `lib/pages/home/call.ts:39` |
| "Answered on the first ring — at 3 a.m., on a Sunday, just after closing, in the middle of a rush." | `lib/pages/home/call.ts:16`. Its comment (`:13-15`) explains that the product page's absolute "Every call is answered" was **deliberately dropped** here because the trial's minutes run out. |
| "AI voice agents that answer every call" + "Point your calls at an agent that picks up on the first ring. Ready in under ten minutes, fluent in 14 languages, booking into Google Calendar on Pro and above — and every call written down." | `lib/pages/ai-agents.ts:38-45` (`AGENTS_HERO`; `LANG_COUNT` = 14, `CALENDAR_PLAN` = Pro) |
| Meta title: "Neuro Tech Voice — AI voice agents that book your customers 24/7" | `app/layout.tsx:67`. "Book" needs Pro plus a connected Google Calendar (§1.7). |
| Product menu: "AI Agents — Answers, qualifies, books the job." · "Knowledge Base — Answers from your prices and policies." · "Integrations — Passes every call on to your tools." | `lib/site.ts:2019-2060` (`PRODUCT_GROUPS`) |

**Live marketing routes** (they have `page.tsx` files): `/`, `/product/ai-agents`, `/product/knowledge-base`, `/product/integrations`, `/solutions/custom-ai-agents`, `/industries`, `/industries/<16 slugs>`, `/register`, `/login`, plus legal pages (`app/`). The nav also links `/product/voice-library`, `/voice-cloning`, `/text-to-speech` and `/speech-to-text` (`lib/site.ts:2080-2116`), **but those pages do not exist** (`ls app/product` shows ai-agents, integrations, knowledge-base). Never send viewers to them.

### 1.2 Setup flow (how fast, what steps)
- **Onboarding has 4 steps:** Company → Agent → Voice → Go live (`app/onboarding/_lib/onboarding-state.ts:19-24`, `ONBOARDING_STEPS`).
  - Step 1, "Tell us about your company": name, industry, website, description, timezone (`components/onboarding/steps/Step1Company.tsx:72`).
  - Step 2, "Set up your AI agent": name, language, tone, an industry template for the instructions, and a greeting (`Step2Agent.tsx:176`).
  - Step 3, "Choose your agent's voice": native speakers of the chosen language first (`Step3Voice.tsx:57`).
  - Step 4, "Go live": "Pick a plan and we'll create your agent. Next, you'll test it and connect a number." It then offers "Test your agent now" → "Get a phone number" → "Connect Google Calendar" (optional, beta) (`Step5Launch.tsx:509, 661, 677, 696`).
- **Site wording for speed:** "Ready in under ten minutes" (`lib/pages/ai-agents.ts:40`). "set up in minutes" (`:35`). "Company, tone, voice, go live: four screens, then a test call to hear how it sounds." (`lib/pages/home/start.ts:13`; its comment says the number is **not** one of the four screens but a separate purchase). The product page's older line, "Company, tone, voice, number: four screens, and the agent takes its first call.", is at `lib/pages/ai-agents.ts:551`.
- **Test calls are real calls on the real agent and "never touch the five minutes"** (`lib/site.ts:1813`). The trial allows 5 test calls a day; paid plans allow 10 / 20 / 30 / 50 (`lib/billing/entitlements.ts:27-98`, `testCallsPerDay`).

### 1.3 Languages and AI disclosure
- **14 agent languages:** English, Romanian, Spanish, French, German, Italian, Portuguese, Polish, Dutch, Japanese, Korean, Chinese (Mandarin), Arabic, Hindi (`lib/agent-languages.ts:6-21`). Speech-recognition coverage differs by language behind the scenes (`lib/voice/languages.ts:1-8`). That is not a claim to make on screen.
- **Answers in the agent's language even when the documents are in another language** ("Yes — the agent answers in the language it's set to speak") (`lib/pages/knowledge-base.ts:470-473`).
- **It always says it is an AI:** "It tells every caller it is an AI — In the language it is answering in, in the opening line, with no setting that turns it off" (`lib/site.ts:2527-2529`). English greeting: "Thank you for calling {company}. This is {agent}, an AI assistant. How can I help you today?" (`lib/voice/greetings.ts:243-247`). Guardrail: "Never claim or imply to be human" (`lib/voice/prompt.ts:265`).

### 1.4 Voices
- The voice engine is **Cartesia Sonic**. There are default voices per language, one feminine and one masculine; English defaults are Skylar and Daniel (`lib/voice/voice-map.ts:1-40`).
- The voice library can be filtered by language, accent and gender, with previews (`components/voice/VoicePicker.tsx`, `VoiceFilters.tsx`). Site wording: "Audition voices by accent, pitch and pace before a caller ever hears one — or clone your own from a single recording." (`lib/pages/ai-agents.ts:244`).
- **Voice cloning is Pro and up** (`entitlements.ts` `voiceCloning`: false on trial and Starter). The Voice Lab (TTS/STT tools in the dashboard) has per-plan quotas (`entitlements.ts` `ttsCharactersPerMonth`, `sttSecondsPerMonth`).
- "Tessa (Emotive)" is **the films' narrator**, not a product default voice. Do not present her as "the voice you get".

### 1.5 Knowledge base
- "An agent that answers from your own documents." "Add your price lists, policies, FAQs and web pages once. When a caller asks, your agent finds the part that answers them and says it in plain words — and when the answer isn't written down, it falls back on the words you've given it." (`lib/pages/knowledge-base.ts:27-28`)
- **Files:** PDF, DOCX, TXT, MD up to 10 MB each, plus web pages by address (`:18`, `:31`). "Text works; scans don't." (`:317`)
- **Matched on meaning:** "“call off Friday” finds your cancellation policy, though the policy never says “call off”" (`:260`). Title: "It follows what the caller means, not the words they happen to use" (`:213`). Answers "in a sentence or two — it doesn't read the document out" (`:265`).
- **Fallback:** "Where your documents stop, it says so" (`:362`). The owner writes the fallback line (`:373-374`).
- **Updates:** "Change the document, and the next call gives the new answer" (`:400`). There is **no auto-sync**: "Does it notice when my website changes? Not on its own." (`:461-462`). There is **no learning from calls**: "Nothing a caller says is added to your knowledge base." (`:465-467`).
- It is included on every plan, including the trial (`:495-497`).
- Dashboard strings that can be shown verbatim (film 2 already did): "Add knowledge", "Drop files here or choose them", "Add page", "Teach your agent about your business" (empty state only), "Reading…" / "Reading page…" → "Ready · N passages" (`components/agent/tabs/TabKnowledge.tsx`, line refs in `docs/kb/SCRIPT.md` truth table #6).

### 1.6 Phone numbers
- **A new number, bought in the dashboard, "$1.15 a month — the carrier's own cost"** (`lib/phone/pricing.ts`, `PHONE_NUMBER_MONTHLY_PRICE_USD = 1.15`; FAQ `lib/site.ts:1924-1933`).
- **No porting:** "porting your existing number in is not supported yet, so today this sits alongside your current line rather than replacing it" (`lib/site.ts:1932`).
- **21 countries:** US, CA, GB, NZ, AT, BE, CH, CZ, DK, FI, HU, LU, NO, PT, SE, SK, SG, JP, IN, BR, ZA. **Not Romania** (`lib/twilio/countries.ts:15-35`; FAQ `lib/site.ts:1932`).
- A number is its own Stripe purchase, so a card-free trial "answers you and nobody else" (`lib/site.ts:1813`, `PRICING_TRIAL.body`).

### 1.7 Call handling (what the agent can do during a call)
The in-call tools are listed in `lib/voice/tools/definitions.ts:50-197`. The dashboard's own labels are in `components/calls/call-display.tsx:30-45`.

| Capability | Tool | Plan / condition |
|---|---|---|
| Answer from documents | `search_knowledge` | every plan |
| Check availability, book, find, reschedule, cancel | `check_availability`, `book_appointment`, `find_booking`, `reschedule_appointment`, `cancel_appointment` | **Pro and up, with Google Calendar connected (beta)**: `bookingGate` → `googleIntegrations` (`lib/voice/tools/calendar.ts:27-29`; `lib/pages/home/gates.ts`) |
| Waitlist | `add_to_waitlist` | inbox tab "Waitlist" (`components/inbox/inbox-tabs.ts`) |
| Text the caller (confirmation or info) | `send_sms` | **Starter and up**, and SMS enabled (`lib/voice/tools/sms.ts:19`) |
| Take a message | `take_message` | every plan |
| Notify the team, transfer to a person | `notify_team`, `transfer_call` | Only to people the owner listed. It names them before it dials. This is a **blind transfer**: the colleague is not briefed and picks up cold, with a 25 s ring timeout. If nobody picks up, it tells the caller and leaves a message (FAQ `lib/site.ts:1895-1902`, `:2522-2524`) |
| Collect lead details | `save_lead_details` | the owner's lead questions (Skills tab) |
| Filler while it works | — | "One moment, let me check." / "Let me look that up for you." / "Just a second." (`lib/voice/greetings.ts:184-186`) |
| Emergency guardrail | — | "If someone's life or health is in danger, tell the caller to hang up and call the local emergency number now." (`lib/voice/prompt.ts:267`) |

**After the call:** a transcript; a summary; sentiment; an outcome (Booked, Rescheduled, Cancelled, Answered, Message taken, Transferred, Flagged, Missed, Spam, Other, from `call-display.tsx:13-22`); "Details collected"; tags; "Answered from your documents" with the document chip (`components/calls/CallDetailSheet.tsx:112-192`). The summary may claim a booking or a transfer only if the tool succeeded (FAQ, `lib/site.ts:1904-1907`). **Recordings are Pro and up**. Analytics: basic on every plan, **30-day on Pro, 90-day on Business** (`entitlements.ts`; `lib/pages/home/pricing.ts:91-110`). Outbound calls from the dashboard: Starter and up.
**Dashboard areas** (real names, from `components/dashboard/DashboardShell.tsx:25-34`): Dashboard · Calls · Inbox (Messages / Bookings / Waitlist) · Agent (tabs: General · Conversation · Voice · Knowledge · Skills) · Voice Lab · Phone Numbers · Integrations · Workflows · Billing · Settings.

### 1.8 Integrations and workflows
- "When the call ends, the follow-up starts on its own" (`lib/pages/integrations.ts:35`).
  - **Triggers:** Call ended · Missed call · Negative sentiment · Keyword heard (`:74-79`).
  - **Actions:** Send a webhook (any https address: CRM, Zapier, Make, n8n) · Notify Slack · Tag the call · Wait (`:278-305`). "Three steps, no code" (`:184`).
  - Workflows run **after** the call, never during it (`:228`, FAQ `:403-405`). There is **no dedicated Zapier app** (`:413-415`).
- **Google Workspace (Gmail, Sheets, Calendar, Docs) is "in beta" and Pro and up.** "what each one does may still change" (`:363-372`; plan gate in `lib/workflows/service.ts:70-73`). A workflow SMS step is Starter and up (`service.ts:74-76`).
- Trademark line used on the site: "Google Calendar™, Gmail™, Google Sheets™, Google Docs™ and Google Drive™ are trademarks of Google LLC. Neuro Tech Voice works with them and is not endorsed by Google." (`lib/pages/ai-agents.ts:318-319`). **Do not show Google, Slack or Zapier logos as endorsements.** If a logo appears, the reel's caption needs that trademark line.

### 1.9 Custom builds
"Your phone script, built into an agent that follows it." This is a done-for-you build, booked by phone ("Call us about a build"), and "quoted on its own" (`lib/pages/custom-ai-agents.ts:131-134`; `lib/pages/home/pricing.ts:243`).

### 1.10 Plans, trial, pricing (exact wording; is it public?)
- **The trial, as the site states it everywhere except the old `HERO` object:**
  - "Five free minutes, fourteen days, and no card." (`lib/site.ts:1812`)
  - "5 free minutes for 14 days · No card needed" (`lib/pages/ai-agents.ts:44`, `knowledge-base.ts:511`, `integrations.ts:455`)
  - "5 free minutes, no card" (`lib/pages/home/pricing.ts:224`; film 2's end card)
  - Register page: "Start your free 14-day trial — no credit card required" (`app/(auth)/register/page.tsx:21`)
  - Backend: trial = 5 minutes, 14 days, **never renewed**, and **no overage**: when the minutes are gone the agent stops answering (`types/index.ts:578-590`; `lib/billing/entitlements.ts:118-121`; FAQ `lib/site.ts:1945-1956`).
- **Prices are public on the homepage** (`lib/site.ts:1684-1704`, `TIERS`, rendered by `components/site/home/pricing*.tsx`). Values are monthly USD / included minutes / then $0.20 a minute:

  | Plan | Price / month | Included minutes | Note |
  |---|---|---|---|
  | Starter | $49 | 400 | |
  | Growth | $99 | 1,000 | |
  | Pro | $249 | 3,000 | "Our pick" |
  | Business | $499 | 5,000 | |
  | Scale | $990 | 15,000 | |
  | Enterprise | no published fee | — | "Talk to us" |

  Other price facts: annual billing gives "Two months free"; "No setup fee"; "Change plan or cancel whenever"; prices exclude VAT (`lib/pages/home/pricing.ts:175, 234-249`; `lib/site.ts:1828`).
- **⚠ The backend disagrees.**
  - `types/index.ts:577-657` `PLANS`: Starter 150 min at $0.25; Pro 850 min at $0.25; Business 1,750 min at $0.22; Custom $999. There is no Growth and no Scale.
  - The OWNER note says so: "Growth and Scale do not exist in the backend … Checkout must match this list before launch" (`lib/site.ts:1678-1682`).
  - Only the fees $49 / $249 / $499 agree.
  - **Rule for reels: no price, minute allowance, overage rate or plan names beyond "Start free".** Pro is safe only as the gate for booking and Google features.
- The "24/7 priority support from a real person" perk on Pro is an owner promise that "Needs an after-hours channel before launch" (`lib/pages/home/pricing.ts:55-61, 106`). **Do not use it.**

### 1.11 Primary CTA wording and URL
- **Button: "Start free"**, everywhere: the hero, the header, every pricing card, product closes (`lib/site.ts:96-100`, `AUTH.signup = "/register"`; `SITE_HEADER.signup`, `:1977`; `PRICING_TRIAL.cta`, `:1814`). The comment says "a page that calls one button four things has a copy problem" (`:1806-1809`).
- **URL:** site `https://www.neurotechvoice.com` (`app/layout.tsx:48`, `metadataBase`). Sign-up `https://www.neurotechvoice.com/register`. The end cards print "neurotechvoice.com".
- Secondary CTAs: "Talk to sales" (tel: `+40 774 566 367`, Romanian business hours) and "Sign in". There is **no support email yet** (`COMPANY.email = ""`, `lib/site.ts:60-82`).
- **Wordmark:** "NEUROVOICE" (`COMPANY.wordmark`, `lib/site.ts:62`). Brand name: "Neuro Tech Voice". Legal name: NEURO TECH VOICE S.R.L.

### 1.12 Target customers and industries the site names
The industry pages, at `/industries/<slug>`, in nav order (`lib/pages/industries/index.ts`; labels in `lib/site.ts:970-1290, 2182-2263`):
- Home services
- Real estate
- Restaurants
- Law firms
- Auto sales & service
- Logistics & dispatch
- Salons & spas
- Veterinary
- Insurance
- Property management
- Hotels & hospitality
- Financial services
- Retail & e-commerce
- Schools & tutoring
- Gyms & studios
- Clinics & dental

Pricing presets: "A quiet clinic" (3 calls/day), "A busy salon" (8), "A packed restaurant" (25) (`lib/site.ts:1774-1778`). The homepage's sample business is **"Northside Studio"** and its agent is **"Ava"**, "A made-up business and agent name" (`lib/pages/home/credits.ts:15-18`). Use them only as samples, labelled as such.
Each industry page carries a sample call, "boundaries" (what the agent must not promise, e.g. a diagnosis), and an "Our estimate" missed-call figure with its reasoning (see §1.14).

### 1.13 Trust and data (what may be said)
- "Your calls are stored in the EU": database and files in eu-west-1, Ireland. The speech and telephony providers are separate companies "in their own regions" (`lib/site.ts:2517-2520`, FAQ `:1909-1923`).
- "An EU company, under EU law… There is no certification badge on this site, because we hold none." (`:2532-2534`)
- Checklist on the AI-agents page: Based in the EU · GDPR data-subject rights · DPA available on request · Encryption in transit · Row-level security · No card numbers stored · Google API Limited Use · Deleted after account closure (`lib/pages/ai-agents.ts:526-541`).
- Terms: "AI-generated responses may occasionally be inaccurate or unexpected. We do not guarantee that the Service will be uninterrupted…" (`app/(legal)/terms/page.tsx` §10). Telemarketing and recording-consent obligations sit with the customer (§6).

### 1.14 Numbers and statistics (sourced or not)
- **The live site shows no market statistics.** The industry pages give their own **labelled estimates**, each with reasoning, and they explicitly refuse the figures in circulation:
  - "About three calls in ten go unanswered in the hours you're open — Our estimate… The dramatic ones in circulation … come from companies selling AI receptionists" (`lib/pages/industries/salons-spas.ts:242-245`).
  - Similar wording in `insurance.ts:232-234`, `law-firms.ts:262`, and others.
  - If one is used, say "our estimate" or "an estimate" and name the trade.
- **Cited studies that are in the repo but not rendered** (`lib/site.ts:691-818`, used only by `components/site/shelf.tsx`, which no `app/` route imports):
  - 411 Locals (2016), "85 businesses across 58 industries, monitored 30 days": 37.8 % answered by a person, 37.8 % sent to voicemail, 24.3 % rang out (`CALL_FATE`, `:785-789`).
  - Oldroyd, MIT Sloan with InsideSales.com, Lead Response Management study. The odds of qualifying a lead are indexed 1.00 inside 5 min, 0.25 at 10 min, 1/21 at 30 min (`LEAD_DECAY`, `:736-740`). The site's own note says this study "was run with a company that sells lead-response software" (`:694`).
  - Oldroyd, McElheran & Elkington, HBR March 2011: "2,241 US companies audited; 23% never responded at all" (`WHY_SOURCES`, `:798-818`).
  - These are the **only** usable third-party numbers. A reel that uses one must put the source on screen (e.g. "411 Locals, 2016 study of 85 small businesses"). They are old, and that should be acknowledged rather than hidden.
- **Sample numbers that must never be shown as real:**
  - `PLATFORM.measure` "286 calls · 47 % Booked · 41 % Answered · 12 % Flagged", labelled "Sample data" (`lib/pages/ai-agents.ts:278-300`)
  - the pricing presets
  - film 2's "Ready · N passages" counts (illustrative)

### 1.15 Claims bank: safe lines for Tessa (source each one; keep the site's hedges)
| Line (or close paraphrase) | Source | Hedge to keep |
|---|---|---|
| "Closed is for the door, not the phone." | `home/call.ts:39` | — |
| "Answered on the first ring — at 3 a.m., on a Sunday…" | `home/call.ts:16` | not "every call, always" |
| "An AI that answers every call, for those who refuse to miss one." | `lib/site.ts:137-140` | it is the hero's brand line; do not turn it into a guarantee |
| "Ready in under ten minutes" / "four screens, then a test call" | `ai-agents.ts:40`; `home/start.ts:13` | not "5 minutes" |
| "Fluent in 14 languages" / "It tells every caller it is an AI" | `ai-agents.ts:40`; `lib/site.ts:2527` | 14, never "every language" |
| "Give it your price lists, policies, FAQs and web pages once." | `knowledge-base.ts:28` | PDF/Word/text/Markdown and pages only |
| "It follows what the caller means, not the words they use." | `knowledge-base.ts:213` | — |
| "Where your documents stop, it says so — in your words." | `knowledge-base.ts:362, 373` | no "never wrong" |
| "Change the document, and the next call gets the new answer." | `knowledge-base.ts:400` | no auto-sync, no learning |
| "It hands the call to a person — only the people you listed." | `lib/site.ts:2522` | not a warm or briefed transfer |
| "Books straight into Google Calendar." | `ai-agents.ts:40`, `home/call.ts` foot | **Pro and up, beta.** Say it on screen or in the post caption |
| "A text confirmation is on its way." | `ai-agents.ts` REEL booking scene | Starter and up, caller opt-in |
| "Every call, filed the moment it ends" (transcript + summary) | `ai-agents.ts:278` | recordings are Pro and up |
| "When the call ends, the follow-up starts on its own" (Slack / webhook / tag) | `integrations.ts:35` | Google steps in beta |
| "Give your team its day back… the work only people can do." | `ai-agents.ts:149-150` | never "replace your receptionist" |
| "Start free — 5 free minutes for 14 days, no card needed." | `ai-agents.ts:44` | the trial answers test calls; a number costs $1.15/mo |

### 1.16 Claims we must NOT make
1. **Any price, minute allowance, overage rate, or the plan names Growth or Scale** (§1.10: site and backend disagree). Also "24/7 priority support".
2. **"Every language"** or any count other than 14. **"Deployed in 5 minutes"**: the site says under ten minutes or four screens.
3. **"Every call answered, guaranteed"**, "never misses a call", "never wrong", "100 % accurate", "never guesses". The site removed the absolute (`home/call.ts:13-15`) and the terms disclaim accuracy (`terms` §10).
4. **"Start free and it answers your customers today"**: a real line needs a bought number, and booking needs Pro plus a connected Google Calendar.
5. **"Keep your number" or number porting**; Romanian numbers; any country outside the 21.
6. **Learning or training from calls**, auto-sync with the website, reading scans, photos or spreadsheets, unlimited documents.
7. **Replacing staff or receptionists**; "sounds exactly like a human"; any implication that the agent hides being an AI. It discloses in the first line, always.
8. **Warm transfer or briefing the colleague**; mid-call workflows; a native Zapier app; Google features as GA (they are beta) or endorsed by Google.
9. **Certifications** (HIPAA, SOC 2, ISO), "all data stays in the EU" (only storage does), medical, legal or financial advice by the agent.
10. **Statistics without a source on screen**; testimonials, customer names or logos, user counts, "trusted by…", reviews, star ratings. None exist in the repo.
11. **Links to `/product/voice-library`, `/voice-cloning`, `/text-to-speech`, `/speech-to-text`** (no pages); the support email (none).
12. **Tessa or Ava as the product's voice or agent**: Ava is the site's sample agent name and Tessa is the films' narrator.

### 1.17 Bio vs site (for the posting copy)
The bio reads: "The voice layer for global business. / Every call answered, in every language. / AI agents deployed in 5 minutes - worldwide."
- "every language" → **14 languages** (`lib/agent-languages.ts`).
- "deployed in 5 minutes" → **under ten minutes** (`ai-agents.ts:40`).
- "worldwide" → **numbers in 21 countries** (`lib/twilio/countries.ts`).

The reels should not repeat these three phrases. The bio itself is the client's to change.

---

## 2. The reusable motion kit

### 2.1 What `src/ig/**` may import UNCHANGED, and what must be forked
Rule: an import never changes the imported file, and film 2's bundle is built from `src/kb/index.ts` alone, so **importing is always safe for film 1's and film 2's bytes.** The question is whether a module is *bound to film 2's timeline or voices*. A bound module would give the reel film 2's frames and words.

| Module | Import as is? | Why |
|---|---|---|
| `src/kb/kit/index.ts` (the barrel: mesh, MeshGround, recipe, cursor, Cursor, TabBar, ui, paper, icons, type, typed) | **Yes** | It imports only `components/Grain`, `components/Type`, `lib/{lights,motion,glide,layout,type,fonts}`, `theme`, `../palettes`. Every part takes `t` as a prop. |
| `src/kb/kit/Specimen.tsx`, `MeshProbe.tsx` | No (not needed) | They import `../scene` → `src/kb/timing.ts` |
| `src/kb/palettes.ts` | **Yes** | Plain data, copied verbatim from the site: `MUTED_MESH`, `HOME_KB_MESH`/`KB_MESH`, `INK_MESH`, `MOMENT_LIGHTS` (rush/closing/sunday/night: orb, listen, ground, ink), `PLAN_LIGHTS`, `STUDIO_PANEL`, `DEEP_PANEL`, `PRICING_PANEL`, `HOME` |
| `src/kb/theme.ts` | **Yes** | `KB_INK` (ava / caller slate / desk graphite), `GRAPHITE`, `ACCENT`; `SPEAKER_OF` maps film 2's roles (re-declare it for IG roles) |
| `src/lib/cuesheet.ts` | **Yes** | Film-agnostic voice and cue machinery: `makeVoiceKit(VOICE)` → `vFrames/vWord/voiceCut/firstSound/voiceEnd`; `makeSpeech(VOICE, VOICES)`; `buildCues(hits, {sfx, speaking, roomAt})`; types `Cue`, `Voiced`, `VoiceRide`. It imports film 1's `timing.ts` read-only (BEAT, CUT, FPS, LIGHT_SEMI). |
| Film 2 scene parts with no timing: `scenes/call/Reset.tsx` (WordReset), `scenes/line/Field.tsx`, `scenes/line/Pointer.tsx`, `scenes/recording/Type.tsx`, `scenes/turn/Flap.tsx`, `scenes/cta/{Heading,StartFree,LightGL}.tsx`, `scenes/cta/lightShader.ts` | **Yes**, by props | Checked: none imports `src/kb/timing.ts`, `voice.generated.ts` or a `stage.ts` |
| `src/kb/components/Captions.tsx` | **No: fork** | Bound to film 2's `vWord`, `VOICE` and `FPS`/`BEAT` (lines 49-52). Copy it to `src/ig/components/Captions.tsx` and repoint 2 imports, as film 2 did (its header) |
| `src/kb/scene.ts`, `scenes/common.tsx` (`autoCaptions`), every `scenes/*/stage.ts`, the orbs (`turn/Orb`, `written/Orb`, `call/Orb`, `line/Orb`, `change/Orb`), `call/Strip.tsx`, `repeat/LineWave.tsx`, `matters/Card.tsx`, `scenes/Cta.tsx` | **No: fork** | Each imports `*_LOCAL` from `src/kb/timing.ts` or film 2's `VOICE` |
| Film 1 `src/components/`: Atmosphere (NightRoom/PaperRoom/EmberRoom, ContactShadow, Vignette2), Camera + Layer + camMotion, Grain (FilmGrain/Grain/Dither), LightGround, MeshOrb, OrbGroup, orbGL, Orb, Type (Words, Label, SpeakerLabel, reveal/revealStyle, CornerDot, typed) | **Yes** | PIPELINE.md §8. `Orb` and `lib/motion` read only `FPS`, so keep the 30 fps timeline |
| Film 1 `src/lib/`: fonts, glide, layout, type, handoff, motion, lights, scene (`useSub`/`useTimelineFrame` only) | **Yes** | `lights.ts` defaults to `BEAT`, so keep 120 BPM |
| Film 1 scenes: `knowledge/Title` (the house heading), `cta/EndCard` (Wordmark, Note, Url; *not* its StartFree, see below), `cta/Headline`, `hook/Clock`/`DayDrum`/`Rings`, `scale/{Cards,Flow,Heading}`, `result/{Card,Event,Split}`, `call/{Light,Mesh,Status}` | **Yes** | PIPELINE.md §8. `EndCard.Note` prints "5 free minutes, no card", which is true |
| Film 1 `components/Captions`, `scenes/call/{CallCaptions,voice,Waveform}`, `scenes/cta/orbit`, `lib/pickup`, `lib/scene.useSceneFrame`, the top-level scenes | **No: fork** | Bound to film 1's `VOICE`/`SCENES` (H9) |
| Film 1 `scenes/cta/HeroGL.tsx` | Avoid | It loads the portrait art with `staticFile('img/…')`. Film 2 forked it as `kb/scenes/cta/LightGL.tsx` (no portrait); use that |

**Tsc gate:** `tsconfig.json` (frozen) includes all of `src`, with `strict` and `noUnusedLocals`. **A type error in `src/ig/**` fails `npm run typecheck`, and with it `verify-film1` gate 10.** Typecheck before every commit.

### 2.2 Kit parts: look, API, gotchas
Shared rules (from `src/kb/kit/index.ts:7-20`):
- **Time:** every part takes `t` in 30 fps timeline frames, fractional at 120 fps (sampled 4× finer, never stepped). Nothing reads a clock.
- **Space:** parts are absolutely positioned in their parent's px (1080×1920 for 9:16). Cursor keys, hover/press rects and the parts they drive must share one container. Move the container for a camera move, not the parts.
- **Type:** the house system only.
- **Sharpness:** reveals rise out of masks, never blur. Moving text rides a sub-pixel glide layer. Moving marks are SVG. Canvases are DPR-sized.

| Part | What it looks like | API (essentials) |
|---|---|---|
| **MeshGround** (`kit/MeshGround.tsx`, `mesh.ts`, `recipe.ts`) | The site's gradient mesh (`.pp-mesh-flow`): five drifting radial pools over the palette's floor colour, a counter-turning second field, the lit shade, grain. Pearl (`variant='light'`) under white UI, or deep (`'deep'`) for the orb's material. Slow: the site drifts over 14 s and turns over 21 s. | `<MeshGround t palette paletteB? mix? variant\|lift keyLight={{x,y,strength}}? brightness? saturation? speed? drift? turn? seed? shade? grain? dither? quality?>`. `meshShadowInk(palette)` gives a card's shadow ink. Palettes are 5 colours, darkest first. |
| **TabBar** (`kit/TabBar.tsx`) | The agent page's real tab bar: General · Conversation · Voice · Knowledge · Skills with lucide icons. Inactive labels at 60 % ink. A 2 px underline that slides on a spring. Knowledge's count badge rolls its digits. Amber unsaved-changes dot. | `const bar = useTabBar({x, y, width?, size?, icons?, badge?, dirty?})`; `bar.rect(tab, t)` to aim the cursor; `<TabBar bar t active={[{at, tab}]} cursor={keys}>` |
| **Cursor** (`kit/cursor.ts`, `Cursor.tsx`) | A black macOS-style arrow with a white keyline and a soft contact shadow, or an I-beam over fields. Moves on eased arcs (`6 + 6·log2(1 + d/100)` frames, never linear, no overshoot). Arrives `pressLead` = 6 f before a press. Press scales it to 0.9, release springs back. Hides while typing. | Keys `{at, x, y, action?: 'press'\|'release'\|'type'\|'hide'\|'show', kind?: 'arrow'\|'text', bend?, dur?, up?}`. `click(at, x, y, {dwell, hold, kind})`. `hoverAt(keys, t, rect)` and `pressAt(keys, t, rect)` return 0..1. `clicksOf(keys)` gives the cue sheet (a down and an up sound). A move with no time to travel **throws**. Size ≈ 52 px at trailer UI scale. Draw it last. |
| **ui.tsx** | The app's tokens (`APP`: primary violet `#7c3aed`, settled green, amber, border …) and white cards with mesh-tinted elevation. `Panel`; `Button` (variants primary, secondary, outline, ghost, `site` = "Start free"; hover, press 0.97, release spring); `Pill` ("Reading…" → "Ready · N passages", rolling); `DocRow` (TabKnowledge's row: icon tile, name, pill, … menu); `Menu`/`useMenu` with `DOC_MENU`; `FieldCard`/`useFieldCard` (label, placeholder, caret, words typed on 16ths, focus ring, Save) + `typingTimes`; `RecordRow` (call detail: TRANSCRIPT, "Answered from your documents" chip, a check drawn in a disc); `Swap` (content swap through a mask); `CheckMark` | Each takes `t` plus `hover`/`press` amounts read from the cursor. Geometry hooks measure with canvas and **hold the frame until the faces are loaded** (`useKitFaces`). |
| **paper.tsx** | `DocPage`/`useDocPage` (a paper document: kind token, heading, lines with tabular figures; or the owner's own file in Geist Mono, with an in-place edit). `InkSweep` (a 12 % accent band, `EASE.draw`, 0.5 s, no glow). `SlipStack` (slips land → fan → collapse). `FlipWord` (a split-flap that flips to the same word). `MeaningLink` (a hairline curve with a midpoint tag). `WordReset` (page lines re-set into a spoken sentence on the word onsets). `labelWidth` | All pure functions of `t`. Film 2's critics' rules on WordReset are in `scenes/call/Reset.tsx:1-28`: no orphan words, no empty boxes, every state reads as what she has said so far. |
| **icons.tsx** | lucide's own path data: settings2, messagesSquare, volume2, bookOpen, sparkles, ellipsis, check, loader, circleCheck, refresh, replace, trash, fileText, globe, link2 | `<Icon name size stroke? rotate?>`. To add icons, put them in an IG-local icon file (do not edit the kit). |
| **type.ts / typed.ts** | `ui(size, weight)` for sentence-case UI chrome. `measureText`, `layoutWords`, `wrapWords`, `spaceWidth`, `W` weights. **`typo()`** turns `'` into `’` (film 2's rule: typographic apostrophes everywhere). `typedOpacity`/`typedCount` for in-place typing (one-frame appearance, a caret, never a masked rise) | — |

**Timing-free film 2 parts:**
- `cta/StartFree` is the site header's "Start free →". It forks film 1's button so the hover never washes out the label; plum hover, press 0.97.
- `cta/Heading` is the two-tone centred heading. Rows rise as units; the key phrase takes the accent word by word on its onsets; exit through the masks.
- `cta/LightGL` + `lightShader` is one WebGL2 context: four light emitters plus the filled backlight behind the wordmark. Transparent, lies over the mesh.
- `line/Field` is the conversation-tab field.
- `line/Pointer` is a cursor wrapper.
- `turn/Flap` is a flip tile.
- `call/Reset` is WordReset.
- `recording/Type` is word-reveal type.

**Orb:** use film 1's `components/Orb` (the site's FluidOrb in WebGL; `volume`, `time = flowTime(frame, volumeAt)`, `palette`/`paletteB`/`mixB`, `resolution = 1.5`; one WebGL context per orb). Use `OrbGroup` for up to four orbs in one context and `MeshOrb` for small CSS dots.
- Film 2's look for Ava's orb is the `MOMENT_LIGHTS.sunday` palette (teal), with `listen` for listening.
- Volume follows her real envelope (`VOICE.lines[id].env`, per frame): narrator ≈ `0.12 + 0.6·env`, on a call `0.44 + 0.38·env`, attack 14/s, release 5/s (`kb/scenes/call/Orb.tsx:1-15`).
- The rim is a CSS box-shadow on a div behind the canvas.
- Fork the orb wrappers. `components/Orb` itself is importable.

### 2.3 Type and the Reels safe zones
- **Fonts:**
  - Instrument Sans Variable for every on-screen word (`theme.ts` `FONT.ui`)
  - Geist Mono for tokens (URLs, times)
  - Noto Sans JP for Japanese
  - Inter Tight 500 at −0.07 em, *only* for the NEUROVOICE wordmark (`import '../../scenes/cta/font/wordmark.css'`, as `kb/scenes/Cta.tsx:42` does)

  Call `waitForFonts()` in the root component (`useState(() => waitForFonts())`, as in `kb/Film.tsx`). The kit's canvas measurements need `useKitFaces()`.
- **House roles at 9:16** (`theme.ts:237-255`): display 112, headline 92, caption 68, title 56, label 28, meta 28 px. Legibility floor on a phone: read text ≥ 56, labels ≥ 28.
- **Reels zones vs the house layout:**
  - **Top band (y < 220).** Text stays out. `useLayout().safe` for vertical is `{x: 86, y: 160}`, so **do not use `L.safe.y` as the top**. The house note "9:16 safe zone y 250–1500" (`theme.ts:212-213`) already fits the 220 / 1520 limits.
  - **Right column (x > 950, y 900–1650).** Film 2's 9:16 captions are centred with a max width ≈ 908 (x 86–994), so **they cross the right column**. Two ways to stay clear:
    - left-align at x 86 with maxWidth ≤ 840, or
    - centre at x ≈ 508 with width ≤ 844.

    Any centred block at cx 540 narrower than 820 px is clear. Film 2's end-card rule (`kb/scenes/cta/stage.ts:129`, width 908 at y 1318) would cross it.
  - **Bottom band (y > 1520).** Film 2's 9:16 end card sits at button y 1030, note y 1180, URL y 1318 (`kb/scenes/cta/stage.ts:125-129`), which is inside the safe zone.
  - **Cover frame.** The grid crop is 1080×1440 centred (y 240–1680). Put the cover's words in y 260–1500 and x 86–930.

### 2.4 Motion and render rules that bit the films
1. **Pure functions of t, no CSS animation.** Springs come in closed form (`lib/motion.ts` `springUnit`, `springAt`, `SPRING.site/pop/land/text`, `EASE.house/peel/inOut/draw/in3…`). Nothing animates linearly.
2. **Sub-pixel glide** (`lib/glide.ts:1-36`):
   - Moving text needs `subpixel(transform, moving)`, which adds `rotate(.002deg)` and `will-change` while it moves.
   - Keep text layers small (word, line or card).
   - Position moving cards by transform, never left/top.
   - `will-change` alone, `translateZ` and perspective layers all step.
   - Under a moving `<Camera>`, use `camMotion(pose, t)` to get `moving`.
   - At 1080p, 1 CSS px is 1 device px, so a glyph snap is **twice as visible** as in the 4K masters.
3. **Concurrency 1 per render tab.** Two tabs can round a glide-layer re-raster differently (±0.9 px alternating). render-master defaults to `--concurrency=1` and runs several chunks in parallel instead (`scripts/kb/render-par.mjs`).
4. **Chunk seams.** A chunk that starts mid-act opens a fresh tab and re-rasters static text, which gives a 0.1–0.7 px jump at the seam. Start chunks on an act's first frame (`render-par --ranges`) or render a 20–30 s reel as one chunk per worker.
5. **No blur, no bokeh, no glow soup** (client rule, "no AI slop"). Reveals rise out of masks. A key phrase changes colour with a glint word by word.
6. **One accent per part.** Film 2 used rose in Part I, then Ava's sunday teal; caller slate; desk graphite. Palettes come only from `src/kb/palettes.ts` (the site's). White UI cards sit on the mesh with the mesh's colour in their shadow (`meshElevation`).
7. **Captions** (the fork):
   - On-screen words = the line's `say`, indexed by word k.
   - A caption starts at `lineAt + vWord(voice, c.word)`; words lead the voice by 2 f.
   - A caption rises **as a unit** (½ f stagger), leaves in 4 f, and holds ≥ 1 beat after its last word (`kb/components/Captions.tsx:8-44`).
   - `autoCaptions()` (`kb/scenes/common.tsx:29-75`, fork it) splits a line into sentences, then into chunks of ≤ 7 words at commas.

### 2.5 Sound: what exists, what an IG reel can reuse
- **The engine (shared, read-only):** `scripts/audio/mix.mjs` `master(T, lib, bedSt, {publicDir})`.
  - It does voices, ducking, rooms (`night` | `white` only), the tempo ping-pong, the impact insert, the name protection, loudness normalisation and the true-peak limiter.
  - It returns `{mix, stems, report}`; **the driver writes the files**.
  - It reads voices from `path.join(publicDir, 'voice', id + '.wav')`.
  - `dsp.mjs` (synthesis, filters, FDN reverb, `lufs`, `truePeak`, `readWav`/`writeWav`) and `loudness.mjs`.
  - Import all of these; never edit them (film 1 hashes them, film 2 hashes them).
- **The cue sheet:**
  - `HITS` = `{at, snd, light, x (pan), w: 1|2|3, label, semi?, db?, run?, split?, layer?}`.
  - `buildCues(hits, {sfx, speaking, roomAt})` (`src/lib/cuesheet.ts`) produces `CUES`. It merges, ducks non-key hits −5 dB under speech, detunes, and tunes to the light notes.
  - `SFX` families are `{n, pk, dir?}`. File keys are relative to `public/`.
- **Libraries the reels can read (read-only, never write):**
  - **Film 1** (`public/sfx/*.wav`, 96 files at −12 dBFS): air, breath, buzz, chime-{rush,closing,sunday,night}[-soft], chord(-rev), click×4, confirm, creak, ding, door, draw, ember, flick, flip, freeze, glint, gulp, hit-white, impact, key×4, land, line, pickup, ping, pop×4, power-on, ring-hook, ring-twist, riser(-short), shatter, sheen, shimmer, shock, slam, strum, sub, swell, swish×4, tap×4, thump, tick×4, whoosh(-rev,-soft).
  - **Film 2 extras** (`public/kb/sfx/fx-*.wav`, 74 files): click-down/up (the two-part UI click), keys×6, menu-open, paper-*, pen, pickup, trill (G#4/B4 desk phone), mallet-{e4,fs4,gs4,b4,e5} (the "Ready" phrase), pluck-*, glass-*, ting, tock, tick, roomtone(-desk), linehiss, slip*, tag, record, scroll, seed, settle.
  - `public/sfx/` and `public/kb/sfx/` are **generated and gitignored**. If missing, run that film's *own* driver (film 2's driver does this for film 1's library, `scripts/kb/generate-sfx.mjs` step 2).
- **The bed** (`scripts/kb/bed.mjs`): film 2's 120 BPM E-major score (felt piano, strings, pad, kick, shaker, snare roll into the converge, the inhale, E on the logo, the chord ringing into the master fade).
  - Its instruments are **file-local, not exported**. Exports are only `inputs(T)` and `bed(T)`, and it reads film 2's `T.MUSIC`, `T.REPEAT_LOCAL`, `T.CTA_LOCAL`.
  - **An IG reel needs its own `bed.mjs`, copying the instrument code**, as film 2 copied film 1's.
  - Film 2's `scripts/kb/sounds.mjs` exports `extras(T)` keyed `kb/sfx/…` and `FAMILIES`. Do not call it for IG files; copy the building blocks you need.
- **Level targets** (film 1's numbers, re-exported by film 2: one campaign, one loudness):

  | What | Target |
  |---|---|
  | Each voice file | −23 LUFS integrated (BS.1770, mono), peak ≤ −1 dBFS (`voice-lines-kb.json` `level`) |
  | Dialogue in the mix | `MIX.dialogueLufs` −20 ± 0.5, `dialogueCeil` −2.5 |
  | Master | `MIX.lufs` −15.5 integrated, `ceiling` −1.5 dBTP; `fadeK` 2, an exponential fade to < −60 dBFS on the last frame |
  | SFX files | −12 dBFS peak |
  | Bed | −20 dBFS peak |
  | `DUCK` | bed −9 dB under speech, low −4 dB < 140 Hz, tonal bus −10 (key hits −5), lookahead 40 ms (`src/timing.ts:1691`) |

  At delivery, film 2 applied −0.25 dB (`DELIVERY_GAIN_DB`, `scripts/kb/finish-master.mjs:39`) because AAC overshoots the true peak at the impact.
- **check-mix contract** (`scripts/check-mix.mjs`): a film must define `MIX.impact` (the logo hit, which must top the loudest dialogue by `lead` 1 LU), `MIX.name.voice` ∈ `VOICES` (the brand line said into the impact's ring, SII ≥ 0.9), and `MIX.arc` with `windows`. So **each reel needs a brand moment**: Tessa saying the name on the end card. It also requires every word SII ≥ 0.7, the end tail < −55/−60 dBFS, and the stamp hash current.

### 2.6 The voice pipeline
- `node scripts/generate-voice.mjs --film=<id> [--engine=cartesia] [--out=voice-candidates/<film>/<take>] [--install=DIR --only=a,b] [--only=a,b] [--remaster] [--preview]`. `--film` is required, and frozen films are refused.
- **Cartesia:** `POST /tts/sse` with `add_timestamps`, model **`sonic-3.6-2026-08-27`**, API version `2026-08-14` (`voice-candidates/kb/STATUS.md`).
  - `CARTESIA_API_KEY` is set in this session. **Never print it**, never echo the environment, never commit it.
  - Emotions accepted without error: curious, happy, confident, enthusiastic, sympathetic, proud, calm, content. Whether Sonic really performs them can only be judged by ear.
- **Tessa (Emotive):** **`6ccbfb76-1fc6-48f7-b71d-91ac6298247b`**, speed **1.05**, full-band (no `phone`).
  - Pin her in the JSON with a film-prefixed env name (film 2 used `CARTESIA_KB2_AVA_VOICE`), so a film 1 override cannot leak in.
  - Callers (if any): Kyle `c961b81c-…`, Dana `cc00e582-…` (with film 1's presence EQ), Marian `26403c37-…`, Daniel `47c38ca4-…`, all `phone: true`. Leo `0834f3df-…` is full-band.
- **Voice-lines JSON schema** (copy `scripts/voice-lines-kb.json`):
  - `{level: {lufs: -23, peakMax: -1}, voices: {<role>: {sid, name, speed, phone?, eq?, note, fish: {...}, cartesia: {env, id, name, gender, speed?}}}, lines: [{id, voice, say, speak | parts[], emotion, direction, language?}], _notes}`
  - **`say`** is the canonical text: captions index its words, so **on-screen text = `say`**.
  - **`speak`/`parts`** is what Sonic performs. SSML such as `<break time="400ms"/>` is accepted. `parts` lets one line shift emotion mid-line.
  - Ids are `[a-z0-9-]` and unique within the film.
- **Output** (`voice.generated.ts`): `VOICE = {fps: 30, engine, voices, lines: {id: {file, voice, say, duration, frames, phrases: [{text, start, end}], words: [{w, t}], env: number[] (per 30 fps frame, 0..1), post: {lufs, gainDb, eq}}}}`. The Kokoro engine is an offline placeholder for timing only.
- **Pace for scripting:** film 2 measured Tessa at speed 1.05 at 2.3 w/s for an unhurried list (`kb2-vo-4`), 2.9 w/s for vo-3 and 3.3 w/s for vo-5. **Budget about 2.5–3.2 words/s.** A 25 s reel with a 3–4 s end card carries about 50–65 spoken words.
- **Borrowable takes** (`{"id": "<same id>", "borrow": "<film>"}` byte-copies the WAV and its timing entry; the id must stay the same):
  - film 2 `kb2-brand` "Neuro Tech Voice." (Tessa, the falling, proud read)
  - film 1 `cta-2` "Neuro Tech Voice."
  - film 1 `lang-en/ro/es/fr/de/ja`: Tessa saying "This is Ava, an AI assistant." in six languages (`scripts/voice-lines.json`), a ready-made multilingual disclosure montage
  - film 1 `call-1`: the full greeting, "Thank you for calling Northside Studio. This is Ava, an AI assistant. How can I help you today?"

  **Do not borrow** film 1's `cta-1` ("AI voice agents that book your customers. Twenty four seven."): booking is Pro and up, in beta.
- **Protocol** (film 2's): generate N candidate takes with `--out` → score them by measurement (`voice-candidates/kb/PICKS.md`: pitch range, pauses, fry, onset) → install with `--install=… --only=…`, one call per take → `check-mix` dialogue gates.

---

## 3. The film registry and the render path for a NEW film at 1080×1920, 120 fps

### 3.1 What a film entry is (`scripts/films.mjs`)
Fields: `frozen, entry, timing, voiceTs, voiceLines, publicDir, voiceDir, voiceSrc, sfxDriver, stamp, hash: [module, fnName], qa, comp, bundle, outDir, outName, formats, preview, cmd: {voice, remaster, sfx}`. `filmOf(argv, {required})` resolves `--film=<id>`.
- `generate-voice`, `check-mix`, `check-render` and `render-master` read their paths from the entry.
- `sfx.mjs` spawns `sfxDriver` but **strips `--film=`** from the arguments it passes on.
- `voiceFile(film, id)` writes `file` relative to `public/`.

One entry means **one timeline**: one `DURATION`, one `MIX.file`, one `VOICES`. So **each reel is its own film entry** (e.g. `ig1…ig4`). They can share one voice set (same `voiceLines`/`voiceTs`/`voiceDir` in every entry), one entry point (`src/ig/index.ts` registering all reels), and one sound driver that builds every reel's mix, each skipped by its own hash.

### 3.2 HAZARD G1: `films.mjs` and `scripts/kb/` are inputs to film 2's mix hash
`scripts/kb/hash.mjs` `kbHash` hashes the bytes of `src/kb/timing.ts`, `src/kb/voice.generated.ts`, `src/lib/cuesheet.ts`, `src/timing.ts`, `src/voice.generated.ts`, **every `scripts/kb/*.mjs`** (except check-port, verify-film1, render-par, finish-master), **`scripts/films.mjs`**, and `scripts/audio/{dsp,mix,loudness}.mjs`, plus the evaluated timeline, voice WAV contents and library files.
- The value today is **`db3a9efa91f928f2`**, equal to `public/kb/sfx/mix.json` `.hash`. I computed it read-only on 2026-10-06.
- Editing `films.mjs`, or adding a file to `scripts/kb/`, makes `check-mix --film=kb` fail with "mix.wav is stale", and the next `sfx:kb` or `remotion … src/kb/index.ts` **rewrites `public/kb/sfx/mix.wav`**.
- The rewrite is deterministic and probably byte-identical, but it is a write to a delivered film's output.

**Recommendation:**
1. Leave `scripts/films.mjs` **byte-identical**.
2. Put the IG entries in `scripts/ig/films.mjs`.
3. Make the shared tools (`generate-voice`, `check-mix`, `check-render`, `render-master`, `sfx`) resolve films from a merged registry: a new `scripts/registry.mjs` = `{...FILMS, ...IG_FILMS}` with the same `filmOf`/`abs`/`need`/`voiceFile`. These tools are in neither film's hash nor in film 1's frozen set. Each edit must leave `main`'s outputs identical (`verify-film1` gates 5, 6, 11) and `kb`'s identical (re-run `check-mix --film=kb` and `check-render --film=kb` on the delivered files and diff against a run made before the edit).
4. **All IG scripts go in `scripts/ig/`**, never in `scripts/kb/` (hashed by film 2) or `scripts/audio/` (H1: every entry is hashed by film 1, and a subfolder there crashes film 1's sound step with EISDIR).

### 3.3 Sound driver for the reels (`scripts/ig/generate-sfx.mjs`, new)
Film 2's driver is hard-wired to `src/kb/timing.ts`, `public/kb/` and `out/audio/kb/` (`scripts/kb/generate-sfx.mjs:52-58`), so the reels need their own. Model it on film 2's driver:
1. Contract check, including `MIX.file`/`BED.file` in the reel's own sfx dir, `MIX.name.voice` ∈ `VOICES`, rooms `night`/`white` only, and every `MIX`/`DUCK`/`BED` number finite.
2. Library prerequisite: film 1's library read-only, film 2's extras read-only.
3. A hash-and-skip (`scripts/ig/hash.mjs`, which must include `scripts/ig/*.mjs`, the IG registry and the shared engines).
4. IG extras.
5. The bed, cached on its own `inputs(T)`.
6. `master(T, lib, bedSt, {publicDir})`.
7. Stems to `out/audio/ig/<reel>/`.
8. Stage temp files outside `public/`.
9. Write the stamp only for a finite LUFS and true peak.

**`remotion.config.ts` needs no edit** if every IG Remotion command runs with **`NTV_SKIP_SFX=1`** after an explicit `node --experimental-strip-types --no-warnings scripts/ig/generate-sfx.mjs`. Without it, the pre-step decides "main" for `src/ig/index.ts` and runs film 1's driver. That is harmless while film 1 is intact (it prints "up to date (2efdbc5153019f3c) — skipped"), but it is pointless. Adding `ig` to its `SFX_DRIVER` and regex is possible; every `Config.*` line must then stay byte-identical.

### 3.4 Timeline contract for each reel (`src/ig/<reel>/timing.ts`)
- **Node-safe (H10):**
  - explicit `.ts` import extensions
  - `type`-only imports marked
  - no enums, namespaces or parameter properties
  - no React or Remotion
- **Re-export from `src/timing.ts`:** `FPS` 30, `RENDER_FPS` 120, `SUB` 4, `BPM` 120, `BEAT` 15, `b`, `VERTICAL` {1080, 1920}, `PK`, `LIGHT_NOTES`, `LIGHT_SEMI`, `CUT`, `DUCK`.
- **Export:**
  - `DURATION` (frames; 20–30 s = 600–900 f = 10–15 bars)
  - `SCENES` (`{from, to, pre, post}`)
  - `VOICES` (sorted by `at`, no overlaps)
  - `vFrames`, `vWord`, `voiceCut` (via `makeVoiceKit`)
  - `VOICE_RIDES?`
  - `SPEECH`, `PHRASES`, `speaking` (via `makeSpeech`)
  - `SFX` (`{...film 1 SFX, ...extras with dir}`)
  - `HITS`, `CUES` (`buildCues`)
  - `BED {file, vol, ride}`
  - `MIX {file, lufs: -15.5, ceiling: -1.5, fadeOut: [END - b(2), END], fadeK, impact, name, arc: {windows}, dialogueLufs, dialogueTol, dialogueCeil, cutRoom, airLp}`
  - `GRAIN`, `roomAt`
  - anything `bed.mjs`'s `inputs(T)` reads
- **Grid:** the picture and the bed are cut on 120 BPM. Bars fall on even seconds; the impact goes on a bar line.

### 3.5 HAZARD G2: `public/` is shared and listed in every bundle (H15)
`remotion bundle` writes every `public/` file (name, size, `Math.floor(mtimeMs)`) into `index.html`.
- `verify-film1` gate 8 compares film 1's bundle with only the `kb/` entries removed (`scripts/bundle-digest.mjs:63`, `isFilm2Static = name.startsWith('kb/')`), so **any `public/ig/…` file makes gate 8 FAIL**.
- For film 2's chunk plan (`render-master`, `render-par`), `isSoundStatic` drops only `(kb/)?(sfx|voice)/`, so IG files would also mark film 2's chunks "picture changed" on a future film 2 re-render.

Two options:
- **(A) `public/ig/`, plus a predicate change** in `scripts/bundle-digest.mjs`, which is in no hash and no frozen set. Make `isFilm2Static` (or a new `isOtherFilmStatic` used by verify-film1) drop `kb/` **and** `ig/`, and let `isSoundStatic` also drop `ig/(…)`. With no `public/ig/` present, both digests come out byte-identical to today's. All shared scripts keep working, since they resolve `MIX.file` against `public/`.
- **(B) a separate public root** (`public-ig/`) via Remotion's **`--public-dir=public-ig`** on every `studio`, `still`, `render` and `bundle` command. The flag is supported (`node_modules/@remotion/renderer/dist/options/public-dir.js`). Nothing enters `public/`. But `check-mix`, `check-render` and `generate-voice` (`voiceFile`) hard-code `public/` and would need IG-aware paths.

**I recommend A.** It is the smaller change and keeps every tool's path logic. Whichever is chosen, **do not run an IG sound build while a film 1 or film 2 bundle is being made.**
- The reels need only their `mix.wav` from public: only the Soundtrack and film 1's HeroGL use `staticFile`.
- Voices for `master()` are read from disk via `publicDir`.

### 3.6 Compositions (`src/ig/index.ts` → `registerRoot(IgRoot)`; ids are valid with `^[a-zA-Z0-9-]+$`)
- **Master:** `IG-<Reel>` (e.g. `IG-Reel1-9x16`), `fps={RENDER_FPS}` (120), `{...VERTICAL}` (1080×1920), `durationInFrames={DURATION * SUB}`.
- **Preview:** `IG-<Reel>-Preview`, 30 fps, `DURATION`. `--frame=N` is timeline frame N.
- **Folder `IG-Scenes`:** one act at a time, `audio: false`.
- **Film component:**
  - `useState(() => waitForFonts())`
  - each scene in `<Sequence from={(s.from - s.pre)*sub} durationInFrames={…*sub}>`
  - `FilmGrain` from `components/Grain`
  - `<Soundtrack/>` playing the reel's `MIX.file` when `audio && !only` (the pattern of `src/kb/Film.tsx`, `Root.tsx`, `Soundtrack.tsx`)
- **Render at `--scale=1`.** The kit's 1080×1920 CSS frame is already 1080p. Canvases (mesh, orb, lights) size themselves by devicePixelRatio = scale.

### 3.7 Render and encode path
1. **Picture master.** `scripts/render-master.mjs --film=<reel> --scale=1 --chunk=<n> --concurrency=1` would work through the merged registry: a resumable HEVC (h265) CRF 16 chunked render (`--muted`), lossless concat, AAC 320k from `MIX.file`, `+faststart`, `hvc1`. Its output name comes out as `<outName>-9x16-x1120.mp4` (`outOf()` only says `4k` for scale 2), which is cosmetic. For speed:
   - `scripts/kb/render-par.mjs` hard-codes `scale = 2`, `crf = 16` and the KB comps, so write an IG copy in `scripts/ig/`.
   - Use act-aligned or one-chunk-per-reel ranges (§2.4.4).
   - Past throughput on this machine (4 cores, 15 GB) at 4K was 1.7–4 s per frame per worker with 3 workers (`out/kb/render-par.log`). 1080p has ¼ of the pixels, so expect very roughly 0.5–1.5 s per frame. A 30 s reel is 3,600 frames. **Measure on a 2 s strip first.**
2. **Delivery file** (new `scripts/ig/finish.mjs`, modelled on `scripts/kb/finish-master.mjs`'s share-copy block). From the HEVC master plus the mix (gain −0.25 dB):
   - **H.264 High, `yuv420p`, 1080×1920 at 120 fps** (no frame dropping: the `tinterlace=drop_even` trick was only for 60 fps copies)
   - **two-pass** at the size budget, `-preset slow`, `aq-mode=3`
   - **Level 5.1 or 5.2.** 1080×1920 is 8,160 macroblocks; at 120 fps that is 979,200 MB/s. Level 4.2's limit is 522,240 and 5.0's is 589,824, so **5.1 (983,040) is the minimum**. Do not copy finish-master's `-level:v 4.2`.
   - BT.709 limited range with all four tags (`-colorspace/-color_primaries/-color_trc bt709 -color_range tv`), `-tag:v avc1`, `+faststart`, AAC 48 kHz 160–192k
   - Use Remotion's bundled ffmpeg directly (`node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg`, `LD_LIBRARY_PATH` = that folder). It has `libx264`, `libx265`, `aac`, `libfdk_aac`, `scale`, `zscale` and `tinterlace`, but **no `fps`/`select`**, and the `npx` wrapper mangles commas in filters. There is **no system ffmpeg**.
   - **Budget formula:** `video_kbps = floor(28e6 × 8 × 0.97 / seconds / 1000) − audio_kbps`, which gives about 7,050 kb/s at 30 s with 192k audio and about 10,700 kb/s at 20 s. Check `size < 28e6` after encoding; if over, re-encode at −3 %.
   - **Bit budget at 120 fps is thin** (≈ 0.03 bpp). `FilmGrain` and `Dither` are re-seeded **on every render frame** (`components/Grain.tsx:1-14`), and so is the mesh's own grain. Temporal noise is the most expensive content an encoder can get. Budget for a **lighter or static grain on the IG reels** (a prop on the reel's own finishing pass; film 1's component is not edited), and check the dark mesh gradients for banding after the encode. Film 1 found 1-level rings without the dither, so keep a little dither.
3. **QA:** `scripts/check-render.mjs --film=<reel> <file>` accepts H.264 or HEVC `hvc1`. It checks length = `DURATION × SUB` at `RENDER_FPS`, BT.709 limited tags, and picture/sound lock to the mix at lag 0 (`scripts/check-render.mjs:1-22`). Plus `check-mix --film=<reel>`, typecheck, and stills of the cover frame inside the 3:4 crop.
4. **Platform note:** Instagram re-encodes every upload. Whether viewers see 120 fps is up to Instagram, not the file. The file meets the client's spec (1080p, 120 fps, ≤ 28 MB, H.264).

### 3.8 What must stay untouched (and how to prove it)
- **Film 1 (frozen; `scripts/kb/verify-film1.mjs`, baseline `docs/kb/baseline/` at `8b9cd21`):**
  - `src/index.ts`, `Root.tsx`, `Trailer.tsx`, `Soundtrack.tsx`, `timing.ts`, `theme.ts`, `voice.generated.ts`, `css.d.ts`
  - `src/components/**`, `src/scenes/**`, `src/dev/**`
  - `src/lib/{fonts,glide,handoff,layout,lights,motion,pickup,scene,type}.ts`
  - `scripts/generate-sfx.mjs`, `scripts/audio/**` (**no new entries**), `scripts/voice-lines.json`
  - `public/voice/**` (mtimes too: H2), `public/img/**`, `public/sfx/**` (never write: H3, the driver deletes unknown top-level WAVs)
  - `tsconfig.json`, `package-lock.json` (**no `npm install`, no dependency changes**)
  - `remotion.config.ts`'s `Config.*` lines

  Reference values:
  - mix hash `2efdbc5153019f3c`
  - `public/sfx/mix.wav` sha256 `ec037282…f31e35e`
  - delivered MP4 sha256s in `docs/kb/baseline/delivered.sha256`

  Proof: `node scripts/kb/verify-film1.mjs` (all 11 gates; `--fast` = 1–5 and 10) after the infrastructure change and before delivery. **Gate 8 needs §3.5's predicate first. Gate 10 (typecheck) covers `src/ig/**`.**
- **Film 2 (delivered; there is no frozen flag and no committed baseline, so capture one before the first IG edit):**
  - **sources:** `src/kb/**`, `src/lib/cuesheet.ts`, `scripts/kb/**` (no edits, **no new files**), `scripts/films.mjs`, `scripts/voice-lines-kb.json`, `public/kb/voice/**` (tracked)
  - **generated:** `public/kb/sfx/**` (never write)
  - **delivered:** `out/kb/**`

  Reference values I recorded on 2026-10-06 at HEAD `743247a`:

  | Item | Value |
  |---|---|
  | `kbHash` = `public/kb/sfx/mix.json` hash | `db3a9efa91f928f2` |
  | `public/kb/sfx/mix.wav` | `9c25a361bcbc2cb6bfe6c14ee291ffc402f4fb58ba5aae6a38119fcb4e464085` |
  | `public/kb/sfx/bed.wav` | `fe7327961b96d2600f03cd2d4f855cec39551f5e731bcd3c5b33365c5eb402c4` |
  | `out/kb/neurotechvoice-knowledge-16x9-4k120.mp4` | `18a4751ca9836e3bd432e1550a0af1eccaecd2c46b799230d8595a88302eca71` |
  | `out/kb/neurotechvoice-knowledge-9x16-4k120.mp4` | `5cc54591426bd79640944ff3186a660cdb39cd0f9dd1a9bdfc80fab6c86f62bb` |
  | `out/kb/deliver/neurotechvoice-knowledge-16x9-1080p60-preview.mp4` | `46ed09839ed34a7df953fa175f424abc435bdf320c4471529580fd93793d1509` |
  | `out/kb/deliver/neurotechvoice-knowledge-9x16-1080p60-preview.mp4` | `3919278192bafe40b5cdb9fd3db8fd1f1c43c0c4d566c2445f2d27375b06041b` |

  **Proof steps (a small `scripts/ig/verify-film2.mjs` is worth writing):**
  1. `git diff --quiet 743247a -- src/kb src/lib/cuesheet.ts scripts/kb scripts/films.mjs scripts/voice-lines-kb.json public/kb/voice`
  2. `kbHash(T) === mix.json.hash === db3a9efa91f928f2`
  3. the sha256 of `mix.wav`, `bed.wav` and the delivered MP4s are unchanged
  4. `check-mix --film=kb` exits 0 with the same stdout as before the IG edits
  5. `npx remotion compositions src/kb/index.ts` is unchanged
  6. a fresh `remotion bundle src/kb/index.ts` digest (`bundleDigest(…, {drop: isSoundStatic})`) equals `out/master/KB-Trailer-*-x2/plan.json` `bundleSha` (proves film 2's compiled picture is unchanged)
- **Never during IG work:**
  - `npm run voice` / `voice:remaster` / `sfx:force` (film 1)
  - `sfx:kb:force`
  - `generate-voice --film=kb` / `--film=main` writes
  - `--install` into `kb` or `main`
  - any write under `public/sfx`, `public/voice`, `public/kb`
  - `npm install`
  - running two `verify-film1` at once (it holds a lock)
