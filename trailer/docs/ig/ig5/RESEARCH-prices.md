# ig5 price research: what the alternatives to $49 actually cost

Research for reel ig5 (price comparison, modelled on @damianodesu's "paying $39 a month for a robot" reel).
All pages were read on **2026-10-07**. Every figure below comes from a public page, with its URL and the
quoted text. Where a figure is my arithmetic, it says so and shows the sum.

**Naming rule.** Provider names appear here only so every number can be traced back to a page. None of
them goes on screen, into the voice-over or into the caption (voice.md: no competitors by name). The reel
compares **categories**.

---

## 0. Our side of the comparison (product truth, from the repo)

| Item | Site `lib/site.ts` TIERS / FAQ | Backend `types/index.ts` PLANS | Safe on screen? |
|---|---|---|---|
| Starter fee | `monthly: 49` | `price_monthly: 49` | **Yes: "$49 a month"**. Both lists agree. |
| Starter minutes | `minutes: 400` | `minutes_limit: 150` | **No.** The two lists disagree. |
| Overage | `overage: 0.2` ($0.20/min) | `overage_per_min: 0.25` | **No.** The two lists disagree. |
| Phone number | FAQ: "on its own monthly subscription at $1.15" | n/a | Not on screen, but it means **$49 is not all-in**. |
| Trial | "Five free minutes, fourteen days, and no card." | n/a | Yes (already used in ig1-ig4). |
| Setup fee | None is listed. The pricing note says the bill is "the plan fee plus that plan's own rate for the minutes past its allowance". | n/a | "No setup fee" is **implied, not stated**. The owner must confirm it before it goes on screen. |
| Billing rounding | "minutes are rounded up on each call, so ninety seconds costs two" | n/a | Matters for fairness: we round per call like most answering services do. |

**Consequences for the script**
- Write "**from $49 a month**" or "**starts at $49**", never "$49, all in" or "$49, unlimited". The plan has
  a minute allowance, an overage rate and a separate $1.15 number.
- Our allowance is **at least 150 minutes on either list**. So any comparison made at 50 or 150 minutes is
  fair to the competitor whichever list turns out to be right. Comparisons at 400 minutes are not.
- Our effective per-minute price inside the allowance is $49/150 = **$0.33** (backend) or $49/400 =
  **$0.12** (site). Overage is $0.20 or $0.25. All of these are **below $1/min** on either list.

---

## 1. Live (human) answering services / virtual receptionists, US

Ten US providers, all read from their official pricing pages. Every one of them is staffed by people. Nine
bill **by the minute** and one bills **by the call**.

| # | Provider (internal only) | Cheapest plan | First plan that **includes minutes** | Unit and overage | Quoted text | URL |
|---|---|---|---|---|---|---|
| 1 | PATLive | **$49/mo, 0 min** ("Pay as you go") | $99/mo, 50 min | per min. $2.99 (PAYG), $2.29 (50-min plan) | "Pay as you go … No included minutes … Additional min $2.99"; "50 minutes About 20 calls … Additional min $2.29"; "Plus government taxes and fees. No PATLive fees." | https://www.patlive.com/pricing/ |
| 2 | Specialty Answering Service | **$44/mo, 0 min** ("Economy") | $159/mo, 100 min | per min, **billed per second**. $1.54 (Economy), $1.44 (100 min) | Economy $44, 0 min, $1.54/min; "100 Minute" $159; "No setup fees … billing increments are 1 second" | https://www.specialtyansweringservice.net/pricing/ |
| 3 | MAP Communications | **$49/mo, 0 min** ("Pay As You Go") | $179/mo, 125 min | per min. $1.37 (PAYG), $1.30 (125 min) | "Pay As You Go … $49 … 0 … $1.37 per additional minute"; "Business … $179 … 125 … $1.30 per additional minute" | https://www.mapcommunications.com/pricing/ |
| 4 | Posh | **$65/mo, 0 min** ("Chïc") | $130/mo, 50 min | per min. $2.30 (Chïc), $2.20 (50 min) | Chïc $65.00, 0 min, $2.30/min; Vogue $130.00, 50 min, $2.20/min | https://www.posh.com/pricing |
| 5 | Davinci Virtual | $129/mo, 50 min | $129/mo, 50 min | per min. Overage not published | "Business 50 … $129/mo … 50 Live Answer Minutes"; "Business 100 … $239/mo" | https://www.davincivirtual.com/virtual-receptionist/ |
| 6 | Moneypenny US (voicenation.com/pricing now redirects here) | $165/mo, 50 min | $165/mo, 50 min | per min. $2.28 | People Answering Service: 50 minutes $165, extra minutes $2.28 | https://www.moneypenny.com/us/pricing/ |
| 7 | Abby Connect | $165/mo, 50 min | $165/mo, 50 min | per min. "Overage is billed at your plan's Abby Minute rate" (≈ $3.30) | Starter $165, 50 Abby Minutes; "No Setup Fee" | https://www.abby.com/pricing/ |
| 8 | Ruby | $250/mo, 50 min | $250/mo, 50 min | per min. Overage not on the page | "Starter … 50 … $250 … Great for startups"; Professional 100 min $395 | https://www.ruby.com/pricing/ |
| 9 | Smith.ai (human receptionists) | $300/mo, 30 calls | $300/mo, 30 calls | **per call**. $11.50/call over 30 | "30 calls … $300 / month … $11.50/call over 30" | https://smith.ai/pricing/receptionists |
| 10 | AnswerConnect | $350/mo, 200 min **+ $49.99 setup** | $350/mo, 200 min | per min, "rounded up to the nearest minute and billed in 1 minute increments". $2.50 | "Entry … 200 … $350 … $49.99 … $2.50 per additional minute" | https://www.answerconnect.com/plans-direct |

### What the table supports (my arithmetic, from the figures above)

- **Base fees can be as low as $44-$65.** Four of the ten (SAS $44, PATLive $49, MAP $49, Posh $65) sell a
  plan with **zero minutes included**, where every answered minute costs $1.37-$2.99 extra.
  **"Answering services cost $99+" is therefore false without a qualifier.**
- **First plan that includes minutes:** $99, $129, $130, $159, $165, $165, $179, $250, $300, $350.
  That is a range of **$99-$350**, with a **median of $165**.
- **The cost of 50 minutes** (cheapest way to buy them at each provider): PATLive $99, MAP $117.50
  (49 + 50×1.37), SAS $121 (44 + 50×1.54), Davinci $129, Posh $130, Moneypenny $165, Abby $165, Ruby $250,
  Smith.ai $300 (50 min ≈ 20 calls on PATLive's own "50 minutes About 20 calls" ratio, which fits inside
  the 30-call plan) and AnswerConnect $350 (its smallest plan). **All ten are ≥ $99.** Six sell a 50-minute
  plan outright ($99, $129, $130, $165, $165, $250), and their **median is $147.50**.
- **The cost of 150 minutes** (the lower of our two allowances), cheapest combination at each
  minute-billed provider: MAP $211.50, SAS $231, Davinci > $239 (the 100-min plan plus unpublished
  overage), PATLive $293.50, Posh $322.50, AnswerConnect $350 (+ $49.99 setup), Moneypenny $371,
  Ruby > $395, Abby ≈ $493.50. **The cheapest of the nine is $211.50.**
- **Per minute:** every published rate at every tier of the nine minute-billed providers is **above $1.00**.
  The lowest anywhere is SAS's 10,000-minute plan, at $1.09 overage and $1.06 effective. The lowest on an
  entry plan with minutes is MAP's $1.43 (179/125). Ruby works out at $5.00 (250/50). Smith.ai charges
  $8.50-$11.50 per call.
- An independent roundup agrees on the range: OnceHub (Sept 2026), "**$175 to $325 a month at entry level**"
  for live answering services, and "$1.75 to $5.40 per minute" for human services.
  https://www.oncehub.com/blog/answering-service-cost

**Fairness notes.** These are **people**: they handle anything, and that is a different product from an AI
agent that answers only from your written answers. Several of these providers also sell their own AI tier,
which is cheaper (see section 4). The comparison is "a human answering service", never "an answering
service can't do what we do".

---

## 2. Agencies and freelancers that build custom AI voice agents / AI receptionists

I was sceptical here and preferred pages that state prices. Only **two agencies publish their own prices**.
The rest are cost guides, several written by platforms that sell to agencies. Those describe what agencies
charge, or should charge, which is weaker evidence.

### 2a. Agencies' own published prices

| Source | Setup / build | Monthly | Quoted text | URL |
|---|---|---|---|---|
| Constant Concepts (self-described "AI-first agency"), "Front Desk (AI Receptionist)" | **$2,500** | **$997** (1,000 min included, then $0.35/min) | "Front Desk (AI Receptionist) … Setup: $2,500 … Monthly: $997 … 1,000 minutes included · then $0.35/min" | https://constantconcepts.ai/pricing/ |
| Agentpro AI, managed voice agent (stated in its own article, Jun 26 2026) | **$1,500** | **$1,500** | "$1,500 for setup and $1,500/month for ongoing service" | https://agentpro.ai/resources/ai-voice-agent-vs-answering-service-vs-new-hire-a-cost-comparison-for-small-businesses |
| AgentZap, done-for-you setup on a SaaS plan (borderline: closer to SaaS) | **$499** one-time | $109 (150 min) | "$499 one-time training & setup fee" | https://agentzap.ai/pricing |

### 2b. Cost guides and agency-pricing guides

| Source (date) | Setup range | Monthly range | Quoted text | URL |
|---|---|---|---|---|
| Ciela (Jan 8 2026) | single agent $1,500-$5,000; **starter receptionist $1,500-$2,500** | single agent $300-$800; **starter receptionist $300-$450** | "Starter receptionist: $1,500 to $2,500 setup, $300 to $450 monthly" | https://ciela.ai/blogs/how-much-to-charge-for-ai-voice-agent |
| Trillet (Jan 28 2026, updated Sep 30 2026), a platform selling to agencies | $297-$997, "many agencies waive these" | small local businesses **$297-$497/mo** | "a common benchmark is a $300/month retainer per client, plus a setup fee and per-minute markup" (the page itself calls these "illustrative agency scenarios") | https://trillet.ai/blogs/voice-agent-pricing-strategy-guide |
| SprintX (Jul 11 2026), an agency with no published prices | simple ~$1,000-$3,500; overall $1,000-$9,000+ | simple **$150-$400/mo all-in**; overall $150-$2,000+ | "Setup (one-time): $1,000 – $9,000+"; "Monthly retainer: $150 – $2,000+" | https://sprintx.net/blogs/ai-voice-agent-pricing |
| SeldonFrame (facts checked Jul 2026) | $500-$3,000 | $500-$2,000 | "one-time setup fees … roughly 500 to 3,000 dollars"; "monthly retainers … around 500 to 2,000 dollars a month" | https://www.seldonframe.com/guides/how-to-price-an-ai-receptionist-service |
| Constant Concepts blog (Jul 1 2026) | "the low thousands" | $500-$2,000 | "$500 to $2,000 per month" | https://constantconcepts.ai/blog/ai-receptionist-cost/ |
| Octavius AI (Jun 25 2026), written from the AU/NZ market | $2,500-$15,000+ | $1,000-$5,000+ | "Agency/Custom-Built … $2,500 to $15,000+ … $1,000 to $5,000+ per month" | https://octavius.ai/voice-ai/ai-virtual-receptionist-cost/ |

### What section 2 supports

- **Monthly floor**, across the 8 sources (6 guides + 2 agencies' own prices): $150, $297, $300, $500,
  $500, $997, $1,000, $1,500. **7 of 8 floors are ≥ $297** ("several hundred"). The one exception, SprintX's
  "simple agent all-in" at $150-$400, is still ≥ 3× $49.
- **Setup floor:** $297, $500, $1,000, $1,500, $1,500, $2,500, $2,500. The **median is $1,500**. Setup is
  typical but not universal: Trillet says "many agencies waive these".
- On top of the retainer, agencies often add usage: "per-minute markup" (Trillet), "then $0.35/min"
  (Constant Concepts).
- **Freelancers (Upwork etc.): not established.** upwork.com returned 403. A search snippet mentioned
  individual Vapi freelancers at ~$30-$55/hr, but no page I could read confirmed it. Do not use it.
- **Custom software builds** (development shops, $3K-$120K+, e.g. ongraph, groovyweb, raftlabs) are a
  different category from "an agency sets up a receptionist for a local business". Leave them out.

---

## 3. An in-house receptionist

**US: BLS Occupational Outlook Handbook, "Receptionists"** (page last modified Aug 27 2026, data May 2025)
- "**2025 Median Pay: $38,010 per year, $18.27 per hour**"
- "The median hourly wage for receptionists was $18.27 in May 2025. The lowest 10 percent earned less than
  $13.83, and the highest 10 percent earned more than $24.01."
- "Most receptionists work full time."
- URL: https://www.bls.gov/ooh/office-and-administrative-support/receptionists.htm
  (the OEWS 43-4171 detail page did not render through the fetcher; the OOH figure is BLS's own summary)

Arithmetic:
- $38,010 ÷ 12 = **$3,167.50/month** in median wages, before benefits and payroll taxes (so conservative).
- 10th percentile: $13.83 × 2,080 h ÷ 12 = **≈ $2,397/month** full-time. Nine in ten full-time receptionists
  earn more than that.
- $49 ÷ $18.27 = **2.68 hours** of median receptionist pay.
- A full-time receptionist covers about 40 of the week's 168 hours.

**UK (optional): statutory floor, not an occupation median.** The National Living Wage is **£12.71/hour
from 1 April 2026** for workers aged 21 and over: "National Living Wage (21 and over) £12.71".
https://www.gov.uk/government/news/national-living-wage-increases-to-1271-per-hour
At 37.5 h/week that is ≈ £2,065/month, the legal minimum for full-time. I could not get an ONS ASHE
receptionist median in this run, so do not use a UK median.

**Fairness notes.** A receptionist does far more than answer the phone. Never write "replace your
receptionist" or "save $3,000 a month". That is an outcome claim, and voice.md position 5 says people should
do "the work only people can do". The comparison is cost per hour of phone coverage, nothing more.

---

## 4. Other AI receptionist SaaS platforms (this section decides what we must NOT say)

| Platform (internal only) | Entry price | Included | Unit | Quoted text | URL |
|---|---|---|---|---|---|
| Smith.ai AI Receptionist | **$0** | 25 calls | per call, $3.00 after | "$0 mo … 25 calls/mo … $3.00/call after that"; Pro "$150/mo" | https://smith.ai/pricing/ai-receptionist |
| Retell AI (developer platform) | **$0** platform fee | usage | per min, ~$0.07+ ($0.055 voice + LLM + $0.015 telephony) | "$0 to start, pay only for what you use" | https://www.retellai.com/pricing |
| Upfirst | **$24.95** | 30 calls | per call, $1.50 over | "$24.95 / month … 30 calls … $1.50 per additional call" | https://www.upfirst.ai/pricing |
| Dialzara | **$29** | 60 min | per min, $0.48 over | "Business Lite … $29 … 60 … $0.48/minute"; "no setup fees" | https://dialzara.com/pricing |
| Allo (phone system) | $45/seat **+ $32/agent** AI add-on | n/a | per seat | "AI Receptionist: Available as add-on at $32/month per agent" | https://www.withallo.com/pricing |
| Rosie | **$49** | **250 min** | per min | "Professional - $49/month … 250 minutes per month" | https://heyrosie.com/pricing |
| Trillet (Small Business) | **$49** | **150 min** | per min, **$0.20** over | "$49/mo … 150 … $0.20/min … Setup fee: None" | https://www.trillet.ai/pricing |
| Moneypenny US, AI answering | $69 | 25 calls | per call, $2.49 over | "25 Calls … $69 … $2.49" | https://www.moneypenny.com/us/pricing/ |
| Goodcall | $79/agent | unlimited minutes, 100 unique customers | per customer, $0.50 over | "Starter - $79/month per agent … Unlimited minutes … $0.50/customer after 100" | https://www.goodcall.com/pricing |
| My AI Front Desk | $99 ($79 annual) | 200 min | credits | "starts at $99/mo … includes 200 voice minutes" | https://www.myaifrontdesk.com/pricing |
| AgentZap | $109 **+ $499 setup** | 150 min | per min, $0.85 over | "150 minutes included … $0.85/min overage … $499 one-time training & setup fee" | https://agentzap.ai/pricing |
| Answering Agent | $249/location + onboarding fee | metered | per min | "Essentials … $249/month per location" | https://www.answeringagent.com/pricing |
| Synthflow | enterprise only | n/a | annual | "Enterprise contracts start at $30,000 annually" | https://synthflow.ai/pricing |
| Abby Connect (hybrid) | AI minutes count as half | n/a | per min | "AI usage counts as 0.5 Abby Minutes" | https://www.abby.com/pricing/ |

**What section 4 means**
- At least **four AI receptionist products start below $49** ($0, $0 platform fee, $24.95, $29), and
  **two sit at exactly $49**. One of those offers 250 minutes. The other (150 min, $0.20 overage) is the
  same shape as our backend Starter.
- So **$49 is not the cheapest AI receptionist**, and "other platforms charge hundreds" is **false** as a
  general claim. The owner's "vs other platforms" can only be made against **human answering services,
  agencies and an in-house hire**, not against AI SaaS.

---

## 5. How the price units compare (keep the script fair)

| Category | What the price buys | Unit | Hidden extras seen |
|---|---|---|---|
| NeuroTechVoice Starter | AI agent; 150 or 400 min (lists disagree) | monthly fee + per-min overage ($0.20/$0.25), rounded up per call | $1.15/mo phone number |
| Live answering service | human receptionists; 0-200 min (or 30 calls) on entry plans | per minute (9/10), per call (1/10); 1-min rounding typical, one bills per second | setup fee at one ($49.99); "taxes and fees" |
| Agency build | someone builds and manages your AI agent | setup + monthly retainer, often + usage markup | integration and change requests |
| In-house receptionist | a person, ~40 h/week, does much more than phones | hourly wage | benefits, payroll tax, cover for leave |
| AI SaaS (others) | AI agent | per min, per call or per customer | some charge setup ($499), numbers, add-ons |

---

## 6. Defensible on-screen claims (≤ 6 words each)

Strength: **A** = true for every source surveyed. **B** = true for the typical or median case, with a
"from", "~" or "+" doing honest work.

| # | On-screen line | Strength | Evidence that makes it defensible |
|---|---|---|---|
| 1 | **"From $49 a month."** / "Starts at $49." | A | Starter = 49 in both site TIERS and backend PLANS. "From" covers the overage and the $1.15 number. |
| 2 | **"Live answering: $99+ for 50 minutes"** | A | The cheapest way to buy 50 minutes is ≥ $99 at **all 10** surveyed US providers ($99-$350). Fair to them because our allowance is ≥ 150 min on either list. |
| 3 | **"~$150 for 50 answered minutes"** (hook, e.g. "Paying ~$150 for 50 minutes?") | B | The median of the six providers that sell a 50-minute plan ($99, $129, $130, $165, $165, $250) is **$147.50**. |
| 4 | **"Answering service: $1+ a minute"** | A | Every published per-minute rate at every tier of the 9 minute-billed providers is > $1.00 (lowest $1.06-$1.09 at 10,000 min). Ours is below $1 on either list ($0.12-$0.33 inside the allowance, $0.20-$0.25 overage), but the reel must **not** print our per-minute figure. |
| 5 | **"Same minutes, staffed: $200+/mo"** (optional; harder to read) | A | At 150 minutes (the lower of our two allowances), the cheapest of the 9 minute-billed providers is $211.50 and the rest run $231-$494. Do not print "150". |
| 6 | **"Agencies: hundreds a month, plus setup"** | B | 7 of 8 sources put the monthly floor at ≥ $297; the two agencies with published prices charge $997/mo + $2,500 setup and $1,500/mo + $1,500 setup. Setup is "often", not always (Trillet: many waive it), so prefer "plus setup, often" in the caption. |
| 7 | **"Agency setup: often $1,500+"** | B | The median setup floor across 7 sources is $1,500; the starter-receptionist package is "$1,500 to $2,500 setup" (Ciela). Weaker than #6 because floors run down to $297. |
| 8 | **"A receptionist: ~$3,170 a month"** (or "$18 an hour") | A for the median | BLS OOH: median $38,010/yr, $18.27/hr, May 2025. ÷ 12 = $3,167.50, in wages only. Say "median" in the caption. |
| 9 | **"$49 ≈ 3 hours of reception pay"** | A for the median | $49 ÷ $18.27 = 2.68 h. Safer wording: "less than 3 hours of a receptionist's pay". |
| 10 | **"Most answering services bill by the minute"** | A | 9 of 10 bill per minute (one bills per call). |

**Recommended shortlist for the script:** #1 with #2 (or #3 as the hook), #6, and #8. They cover three
categories with one figure each and keep the voice-over short.

---

## 7. NOT defensible (do not put these on screen, in the voice-over or in the caption)

| Line | Why not |
|---|---|
| "The cheapest AI receptionist" / "Half the price of other AI tools" | AI receptionists exist at $0, $24.95, $29 and $49 (section 4). |
| "Other platforms charge hundreds" (unqualified) | False for AI SaaS. True only for human answering services, agencies and hires. |
| "Answering service: $99+/mo" with no "for 50 minutes" | Four providers have base plans at $44-$65 (with zero minutes). |
| "Answering services cost $300+/mo" | The median first plan with minutes is $165. Only Smith.ai ($300) and AnswerConnect ($350) start ≥ $300. |
| "Agencies charge $5,000+" / "$10K builds" | Only the upper or complex ranges reach that. Typical setup floors are $297-$2,500. |
| "Save $3,000 a month" / "Replace your receptionist" | An outcome claim with no customer data. A receptionist does more than phones. Also against voice.md position 5. |
| "Save 90%" or any percentage | It depends on call volume and on which of our two minute allowances is real. That makes it a derived statistic, which voice.md rules out. |
| "$49, unlimited" / "$49 all-in" / "No hidden fees" | There is a minute cap and an overage rate, and the number costs $1.15/mo extra. |
| Any of our minutes, our overage rate or other tiers | The site and backend lists disagree (400 vs 150 min, $0.20 vs $0.25). |
| "No setup fee" | The site never says it outright. It is only implied by the pricing note. Owner to confirm first. |
| A per-call figure for answering services from the 2025 roundups ($2.50-$4.50/call etc.) | Not from a provider page. Smith.ai's own page is $300/30 calls ($10/call), and the older $292.50 figure in the roundups is out of date. |
| Freelancer hourly rates | I could not verify them (Upwork 403). |
| Any provider name, logo or UI | voice.md: competitors by name are off limits. |

---

## 8. Sources (all accessed 2026-10-07)

Live answering services (official pricing pages)
- PATLive: https://www.patlive.com/pricing/
- Specialty Answering Service: https://www.specialtyansweringservice.net/pricing/
- MAP Communications: https://www.mapcommunications.com/pricing/
- Posh: https://www.posh.com/pricing
- Davinci Virtual: https://www.davincivirtual.com/virtual-receptionist/
- Moneypenny US (voicenation.com/pricing redirects here): https://www.moneypenny.com/us/pricing/
- Abby Connect: https://www.abby.com/pricing/
- Ruby: https://www.ruby.com/pricing/
- Smith.ai human receptionists: https://smith.ai/pricing/receptionists
- AnswerConnect: https://www.answerconnect.com/plans-direct
- Not used: Nexa (no prices published, https://www.nexa.com/pricing); Answering Service Care (403)
- Roundup: OnceHub, "Answering Service Cost in 2026" (Sept 2026): https://www.oncehub.com/blog/answering-service-cost

Agencies / custom AI voice agents
- Constant Concepts pricing: https://constantconcepts.ai/pricing/
- Constant Concepts blog (Jul 1 2026): https://constantconcepts.ai/blog/ai-receptionist-cost/
- Agentpro AI (Jun 26 2026): https://agentpro.ai/resources/ai-voice-agent-vs-answering-service-vs-new-hire-a-cost-comparison-for-small-businesses
- Ciela (Jan 8 2026): https://ciela.ai/blogs/how-much-to-charge-for-ai-voice-agent
- Trillet guide (updated Sep 30 2026): https://trillet.ai/blogs/voice-agent-pricing-strategy-guide
- SprintX (Jul 11 2026): https://sprintx.net/blogs/ai-voice-agent-pricing
- SeldonFrame (Jul 2026): https://www.seldonframe.com/guides/how-to-price-an-ai-receptionist-service
- Octavius AI (Jun 25 2026): https://octavius.ai/voice-ai/ai-virtual-receptionist-cost/
- AgentZap: https://agentzap.ai/pricing

In-house receptionist
- BLS OOH, Receptionists (modified Aug 27 2026, May 2025 data): https://www.bls.gov/ooh/office-and-administrative-support/receptionists.htm
- GOV.UK, National Living Wage £12.71 from 1 April 2026: https://www.gov.uk/government/news/national-living-wage-increases-to-1271-per-hour

AI receptionist SaaS
- Smith.ai AI: https://smith.ai/pricing/ai-receptionist
- Retell AI: https://www.retellai.com/pricing
- Upfirst: https://www.upfirst.ai/pricing
- Dialzara: https://dialzara.com/pricing
- Allo: https://www.withallo.com/pricing
- Rosie: https://heyrosie.com/pricing
- Trillet: https://www.trillet.ai/pricing
- Goodcall: https://www.goodcall.com/pricing
- My AI Front Desk: https://www.myaifrontdesk.com/pricing
- Answering Agent: https://www.answeringagent.com/pricing
- Synthflow: https://synthflow.ai/pricing

Repo (our side)
- `lib/site.ts`: TIERS (Starter 49 / 400 min / $0.20), PRICING_NOTE (per-call rounding), FAQ ($1.15 number), PRICING_TRIAL
- `types/index.ts`: PLANS.starter (49 / 150 min / $0.25)

**Caveat on method.** The pages were read through an automated fetcher that summarises them. The figures
are as it reported them. Re-open the 3-4 pages behind whichever lines the script uses (PATLive, Posh, MAP,
SAS for #2/#4; Constant Concepts and Ciela for #6; BLS for #8) and check them by eye before posting. Prices
change.
