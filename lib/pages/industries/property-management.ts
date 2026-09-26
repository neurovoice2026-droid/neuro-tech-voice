import type { Trade } from "./schema";

/* ------------------------------------------------------------------ *
 * Property management — letting agents, block managers, build-to-rent.
 *
 * What makes this trade's phone unlike the other fifteen: everywhere
 * else, answering is how the business wins the work. A plumber who
 * answers has won a job; a dentist who answers has filled a chair. Here,
 * answering is how the business receives legal notice on behalf of
 * somebody who is not on the call. Under Section 11 of the Landlord and
 * Tenant Act 1985 the repairing duty generally bites from the moment of
 * notice, and in a disrepair claim the agent's call log is the evidence
 * — for both sides. The call costs money to take, earns nothing, and
 * starts a clock that runs against a third party's money.
 *
 * The other half of it: one number, four populations who are not on the
 * same side. A tenant reporting a leak, the landlord whose money will
 * fix it, a leaseholder who owns his flat and is disputing the bill for
 * it, and a contractor stood outside a door nobody answered — all on the
 * same branch line inside the same ten minutes, and none of them may
 * hear what the others said. One careless sentence is a data breach, a
 * discrimination claim or a Tribunal application, depending on which of
 * the four is holding the phone.
 *
 * Vocabulary is checked against the trade, not against a thesaurus. A
 * leaseholder is not a tenant: he owns his flat and pays a service
 * charge, not rent, and calling him a tenant tells a block manager
 * everything about who wrote the page. The landlord is the client; the
 * tenant is not the customer. In England, AST and Section 21 are dead
 * words — the Renters' Rights Act 2025 ended both for new and existing
 * tenancies on 1 May 2026; Wales has contract-holders on occupation
 * contracts, Scotland has a PRT. A UK office has flats, lets, repairs,
 * works orders, voids and check-outs, not apartments, leases,
 * maintenance requests and turns. Work under a landlord's float is
 * authorised, not quoted — "quote" is the wrong verb in this building.
 *
 * Two words this page holds to, because the sales page in this folder
 * holds to them as well. A **lettings appraisal** is not a valuation: a
 * valuation is what a RICS surveyor or a lender produces, and printing
 * "valuation" for the visit where an agent tells a landlord what a flat
 * would let for is a regulatory problem rather than a style one. "Val"
 * is spoken shorthand and stays out of printed copy. And **emergency**
 * is not a loose word: it has a definition in the tenancy agreement with
 * a call-out premium attached to it, which is exactly why a phone is
 * allowed to read that definition out and never allowed to apply it.
 * That refusal is this page's wall.
 * ------------------------------------------------------------------ */

export const propertyManagement: Trade = {
  slug: "property-management",
  label: "Property management",

  kicker: "It's twenty to ten on a Monday and the weekend arrives at once.",
  standfirst:
    "It answers the ninth call of the nine o'clock wall, gets the property, the flat and the defect down in the caller's own words, and pages a person for anything that could hurt somebody — without deciding what counts as an emergency or promising a date nobody can hold.",

  prongs: [
    {
      id: "report",
      label: "Reports a repair",
      does: "writes the report that becomes the record",
      caller: "Do I ring you or the landlord about a blocked sink? I don't know if that's your job.",
      asks: "Checks the address against your own managed list, then takes which flat, what is happening, since when, who is in the household and when they can give access — and puts the time on it, because from that minute a landlord is on notice and the log is the evidence, for both sides.",
    },
    {
      id: "access",
      label: "Somebody needs in",
      does: "gets a human to the man on the doorstep",
      caller: "It's Errol, gas safety — nobody's in at 14b. I've been sat outside twenty minutes.",
      asks: "Nothing comes back under the number he is ringing from, and it does not pretend otherwise: the office made that access slot, not him, so there is nothing of his to look up. It takes the property, the flat and how long he can hold on, and has the manager for that block on the line while he is still parked up. An aborted visit is billed to a landlord and the gas safety record expires on the date it expires.",
      urgent: true,
    },
    {
      id: "instruction",
      label: "A flat to let out",
      does: "books the appraisal before agent two",
      caller: "I've a flat in Kirkstall, empty since June. Do you do fully managed, or just tenant find?",
      asks: "The one call on this phone that is worth money rather than risk. It takes the address and the rooms, offers the lettings appraisal slots your diary genuinely has, and texts her the confirmation — while she is still on this call and not on the next agent's.",
    },
  ],

  intents: [
    { chip: "do I ring you or the landlord?", reaches: "search_knowledge", then: "Checks the address on your own managed list and tells him which of you it is. Half these calls start here." },
    { chip: "water through the light fitting", reaches: "transfer_call", then: "Water near live electrics is not logged. It's a person on the line before he's finished the sentence." },
    { chip: "the mould's been reported since March", reaches: "save_lead_details", then: "Writes his words, and against the date he gives for call one — not today's. Today's date is what loses it." },
    { chip: "is a blocked loo an emergency?", reaches: "search_knowledge", then: "Reads the definition straight out of your own tenancy agreement. It will not tell her whether this is one." },
    { chip: "no hot water, newborn in the flat", reaches: "notify_team", then: "Takes the report, writes down the household because she offered it, and pages the rota phone." },
    { chip: "nobody's in at 14b, I'm gas safety", reaches: "notify_team", then: "Nothing to find under his number: the office made that slot. It pages the block's manager while he's parked." },
    { chip: "shift my viewing to half six?", reaches: "find_booking", then: "Finds it under the number she booked it on — hers, never somebody else's — then offers a window you have." },
    { chip: "has the Alma Road two-bed gone", reaches: "search_knowledge", then: "Reads it off your own file — let agreed or still on — and gives every caller the same next step." },
    { chip: "what would you charge to manage it", reaches: "check_availability", then: "The one call here that's worth money. Offers her the appraisal slots your diary genuinely has, before she rings agent two." },
    { chip: "£1,100 for the communal windows", reaches: "take_message", then: "A leaseholder, not a tenant. Named and routed to the block manager. It says nothing about the charge." },
    { chip: "is the tenant still in there", reaches: "take_message", then: "Confirms nothing about who lives where — not to family, not to anyone. Takes his number instead." },
    { chip: "how much notice do I have to give", reaches: "transfer_call", then: "Says notice only counts in writing, then puts her through. It cannot accept notice and doesn't pretend to." },
    { chip: "block alarm's been going since two", reaches: "transfer_call", then: "No stay put, no evacuate, no \"it's probably a fault\". A person, immediately." },
    { chip: "you lot are an absolute joke", reaches: "transfer_call", then: "Doesn't defend anybody. Offers a person, and takes the complaint word for word if nobody picks up." },
    { chip: "what's the key safe code, I'm out", reaches: "take_message", then: "Never reads out a key safe, door or alarm code. Not to a tenant, not to a contractor, not once." },
    { chip: "nothing left for Saturday viewings", reaches: "add_to_waitlist", then: "Puts her on the list for the next viewing slot instead of letting her ring the next agent." },
  ],

  duration: 122,

  turns: [
    { at: 0, side: "agent", text: "Kemp and Rowe lettings — you're through to the answering assistant. Which property is it?" },
    { at: 7, side: "caller", text: "Flat 6, Carlisle House. Delroy Ferriby. It's the damp in the back bedroom again. I rang on the second of September, I rang on the ninth, and I rang last Tuesday and got the machine." },
    { at: 29, side: "agent", text: "So this is a chase, not a new one. I'll log it against the second of September — I'm not putting today's date on it and starting you again." },
    { at: 42, side: "caller", text: "Well it's worse now. There's black on the wall behind the wardrobe and the paper's coming away." },
    { at: 50, side: "agent", text: "Black mould on the back bedroom wall, spreading behind the wardrobe. Is there anyone in the flat with a chest condition, or a child under two?" },
    { at: 62, side: "caller", text: "My daughter's two in November. She sleeps in that room. That's why I keep ringing." },
    { at: 70, side: "agent", text: "That's on the report, and I've alerted Bea, who manages Carlisle House — she has it in front of her now. I'm not going to give you a date, because I'd be making it up." },
    { at: 84, side: "caller", text: "That's what the last one said. Nobody came. I'm in after two most days if anyone does — but the dog's in the kitchen." },
    { at: 93, side: "agent", text: "After two, dog in the kitchen — that's on the report so he knows before he knocks. And your tenancy pack has a complaints procedure in it. It only counts in writing, so I'll text you where to send it." },
    { at: 110, side: "agent", text: "Text's gone: what you reported, and the date it's logged against, which is the second of September and not today." },
  ],

  toolRuns: [
    { at: 3, tool: "get_call_context", ms: 140 },
    { at: 31, tool: "search_knowledge", ms: 420 },
    { at: 66, tool: "save_lead_details", ms: 210 },
    { at: 68, tool: "notify_team", ms: 170 },
    { at: 90, tool: "search_knowledge", ms: 380 },
    { at: 99, tool: "save_lead_details", ms: 180 },
    { at: 107, tool: "send_sms", ms: 560 },
  ],

  rig: {
    title: "Repair log",
    form: "unit",
    fields: [
      { id: "unit", label: "Property and flat", value: "Flat 6, Carlisle House · Delroy Ferriby", at: 9, from: "caller", onPhone: true },
      { id: "dated", label: "Taken", value: "Monday, 09:41", at: 3, from: "get_call_context", onPhone: true },
      { id: "first", label: "First reported", value: "2 September · third call, not a new one", at: 27, from: "caller", onPhone: true },
      { id: "defect", label: "What he reported", value: "Damp, now black mould — back bedroom wall", at: 45, from: "caller", onPhone: true },
      { id: "household", label: "Household", value: "Child under two sleeps in that room — volunteered", at: 66, from: "save_lead_details", onPhone: false },
      { id: "told", label: "Bea alerted", value: "Damp chase, third call, child under two", at: 68, from: "notify_team", onPhone: false },
      { id: "access", label: "Access", value: "After 2pm most days · dog in the kitchen", at: 99, from: "save_lead_details", onPhone: false },
    ],
    receipt: "A third call logged as a third call. Nothing promised, nothing closed, and Bea had it before he'd hung up.",
  },

  wall: {
    never: "decide that a job is an emergency",
    clause:
      "You may read the emergency definition from the business's own tenancy agreement back to the caller, word for word. You may never apply it. Do not say that what a caller describes is or is not an emergency, do not say whether a call-out charge applies or who pays it, do not instruct, dispatch or authorise a contractor, and do not give a timescale. Take the report and get a person on the line.",
    clauseSource:
      "the system prompt, read fresh from our servers on every call — there is no version of it a caller can argue into a different shape, and no switch in your dashboard that removes it",
    detents: [
      {
        caller: "It's Marlena, flat 3 Brudenell Grove. The only loo in the flat's blocked and it's gone ten. That's an emergency, isn't it — you'll get somebody out tonight?",
        agent: "I can read you what your tenancy agreement calls an emergency, word for word, and I will. What I can't do is tell you whether this is one — that's a decision with a call-out charge on the end of it, and it isn't mine to make.",
      },
      {
        caller: "You've just read me \"loss of an essential facility\". A toilet's essential. I'm not a solicitor but that's not complicated, is it.",
        agent: "That's the wording, and I've given it to you exactly as it's printed. Whether tonight meets it is still the property manager's call. The report's down with the time on it and I'm getting hold of somebody now.",
      },
      {
        caller: "Just say yes or no. Is it an emergency? Because if it is I want a plumber tonight, and if it isn't I'll go to bed and stop wasting my evening.",
      },
      {
        caller: "Unbelievable. You're the emergency line that won't tell anybody what an emergency is.",
        agent: "I'm the line that writes it down accurately and wakes somebody up. That word costs your landlord money one way and costs you a night the other, so a person says it, not a phone. I'd rather wake somebody at half ten than guess on your behalf, and that is what is happening.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "Yes — the only toilet in the flat is loss of an essential facility, so that's an emergency under your agreement and I'll have an out-of-hours plumber with you before midni",
      instead:
        "— no. That isn't mine to say. I can read you the definition out of your own agreement as many times as you want it, and I have. Calling this an emergency puts a call-out premium on your landlord's account tonight; not calling it one leaves you without a toilet until Monday. Both of those are somebody's money and somebody's morning, and a phone doesn't get to pick. What I've done is put your flat, your words and the time you rang in front of whoever is carrying the rota, and they're being rung now.",
    },
    crosses:
      "The word it won't say, it won't say to anybody — but the call doesn't sit in a log waiting for Monday either. Six seconds after she said it a person's phone is ringing, and it rings with the report already finished rather than with a name and a mood. Refusing to decide is not the same as refusing to act; the decision belongs to whoever carries the cost of it.",
  },

  relay: {
    because:
      "Two kinds of call stop being a report. The ones where somebody could be hurt — a smell of gas, a sounding carbon monoxide alarm, smoke, a block alarm, water reaching electrics, a forced door, a person shut in a lift. And the regulated conversations: arrears, deposit deductions, notice, possession. Neither kind is logged and neither is answered. The rota is alerted first, so the details are already on the screen when it rings; then the caller is put through. At eleven at night the rota phone sometimes rings out, and that is the only reason a message is taken instead.",
    who: "whoever is carrying the rota phone, or the property manager for that block",
    by: ["notify_team", "transfer_call"],
    carries: [
      "the property and the flat number, not just the street",
      "what they said, before anyone tidied it up",
      "who is in the flat, if they told us",
      "the number they rang from, and whether it matches the one on file",
    ],
    seconds: 6,
  },

  rules: [
    {
      label: "If they've rung before, log it as a chase",
      changes:
        "It takes the date the caller gives for the first report and writes it up as \"third call, first reported 2 September\" — instead of opening a fresh one with today's date on the top of it. A brand new report every time is what a disrepair solicitor takes apart.",
      on: true,
    },
    {
      label: "Out of hours, only water, gas, fire and no heat reach me",
      changes:
        "At eleven at night your phone rings for those four, with the flat number and the household already on the screen. The blocked sink is on the log at nine instead of in a voicemail nobody plays.",
      on: true,
    },
    {
      label: "Stop offering viewings once it's let agreed",
      changes:
        "The moment a property is marked let agreed in your own documents, it stops holding slots on it and takes her details for the next one — instead of booking a Saturday viewing somebody has to ring back and cancel.",
      on: false,
    },
  ],

  ink: { ember: true, settled: true },

  faq: [
    {
      q: "Will it tell a tenant when somebody's coming?",
      a: "No, and there is no setting that makes it. Not \"someone will be out today\", not \"within 24 hours\", not \"we'll get it sorted this week\". That sentence becomes a promise, then a complaint, then an exhibit — and the person who would have to keep it is out at a check-in with no idea the call happened. What it does instead is take the report properly, put the time on it, and tell the caller plainly that it is not going to invent a date.",
    },
    {
      q: "If it won't decide what's an emergency, who does — at half ten at night?",
      a: "Your rota holder, the same as now, but woken up holding a finished report rather than a number and a tone of voice. The agent reads your own definition back to the caller as often as they ask for it, takes the flat, the fault, the household and the access, and pages the rota with all of it attached — so the decision that carries the call-out premium is made by the person whose landlord pays it, in about four seconds, off a screen rather than off a groggy phone call. It never instructs a contractor and it never books one.",
    },
    {
      q: "Half my callers own their flat, they don't rent it.",
      a: "Then they are leaseholders, they pay a service charge rather than rent, and the call that follows a Section 20 notice or a demand for the communal windows is fifteen to twenty-five minutes long and should be. The agent takes the name, the block and the flat, records what they are disputing in the words they use for it, and routes it to the block manager. It does not discuss whether the charge is reasonable, and it does not mention the Tribunal.",
    },
    {
      q: "What stops it asking an applicant the wrong question?",
      a: "It is never asked to qualify a letting enquiry, so it never has a reason to. In England, since 1 May 2026, the Renters' Rights Act 2025 makes it unlawful to do anything that makes someone less likely to get a home because they have children or receive benefits; in the US the Fair Housing Act applies to your tools exactly as it applies to your staff, and that liability is not delegable to a vendor. So it does not ask about children, benefits, nationality, age, health or who else will be living there, it does not record it if it is offered, and every caller gets the same information, the same next step and the same speed — because on an applicant call the evidence is the difference between callers, not the refusal itself. On an existing tenancy it is the other way round: a household detail a tenant volunteers about a repair goes on the report, because that is what the contractor and the property manager need.",
    },
    {
      q: "We already push repairs to an online portal.",
      a: "So do most agents, and tenants ring anyway — now unanswered and annoyed rather than just unanswered. The portal works for the tenant who was going to use it. The ones on the phone at 09:40 on a Monday are the ones who weren't, and telling them to go online is the first line of most of the complaints that end up in front of a redress scheme. The agent takes the report on the phone and it lands in the same place.",
    },
  ],

  jargon: [
    "leaseholder",
    "service charge",
    "Section 20",
    "Section 11",
    "works order",
    "the landlord's float",
    "lettings appraisal",
    "CP12",
    "EICR",
    "let agreed",
    "void",
  ],

  missRate: {
    value: "About 28% of in-hours calls never reach a person",
    reasoning:
      "Our estimate, from the shape of the working week rather than a survey — no trade body publishes this one, and the vendor figures in circulation (74%, \"over 60%\") carry no method, no sample and no date, which is why we are not repeating them. Two or three people cannot answer thirty calls between nine and ten on a Monday, and half the team is in somebody else's hallway holding a set of keys. Out of hours is a separate and much larger number: 121 of the week's 168 hours have nobody in the office at all. If you want a real figure rather than an argued one, sit next to the handset next Monday from nine to ten and count what rings out. Ours is reasoning. Yours would be evidence.",
  },

  valuePerCall: {
    value: "Around $30 for each call you get back",
    reasoning:
      "Built on one call in sixteen, not on all of them, and we would rather say so. Out of a hundred missed calls roughly six are a landlord asking whether you would take a flat on; about one in five of those instructs you, because a landlord ringing round is ringing three agents and picking up first only puts you in the running. A first year of tenant find plus management on a £1,100 flat is about £2,684 gross, and we knock three quarters off for the ones you would have won anyway, which lands on £32 a call. The $30 is that arithmetic done again from scratch on a $1,400 unit at a 75% leasing fee and 9% management — a second figure, not the first one through an exchange rate. The other ninety-four calls earn nothing. Tenant calls generate no fee at all, and an applicant call is worth close to nothing on its own, because you have a waiting list for every decent two-bed and the flat lets whether or not you answered that particular caller. What the ninety-four are worth is avoided cost and avoided liability, and neither of those gets a price from us. Nor is there a yearly total at the bottom of this page.",
  },

  citations: [
    {
      claim: "Out of hours, a property phone in the UK is very close to not being answered at all.",
      publisher: "InStep AI",
      date: "2026-08-05",
      sample:
        "3,047 unique UK sales and lettings agency numbers called on weekday evenings between 18:00 and 21:00, May to July 2026, each left to ring until the receiving line ended it: 93.8% reached nobody, 4.1% were answered by a person. Independents 93.6%. It tested the evening only, so it measures a closed office rather than a failing team, and evenings are a minority of this phone's volume.",
      interest: "InStep AI sells voice AI to property agents.",
    },
  ],

  objection: {
    asks: "My tenants already can't get hold of a human and they're livid about it. You want me to put a robot in front of them? The first time it tells someone with a ceiling coming down that their request has been logged, I'm in front of the Ombudsman.",
    answer:
      "The first half is correct, and it is the reason the agent does not triage. It never decides what is an emergency, never offers a date, and never closes anything. Water, gas, fire, electrics, loss of heat or a vulnerable occupier and it stops taking a report and gets whoever is carrying the rota phone, with the flat number and the household already on the screen. The second half answers itself, in your favour: yes, the ceiling call will keep ringing until somebody picks up. That call was never the problem. The problem is the sixty calls a day that are not the ceiling — has my gas certificate been sent, when's my inspection, can I have a copy of my tenancy, I'm ringing about the two-bed on Alma Road — sitting on top of it and making it ring out. Clear those and the nine o'clock wall stops being a wall. And there is one caller to care about more than any of them: the landlord ringing on a Tuesday evening to ask whether you would take their flat on. She is ringing three agents. At the moment you are the one who didn't answer.",
  },
};
