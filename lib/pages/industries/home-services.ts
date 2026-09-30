import type { Trade } from "./schema";

/* ------------------------------------------------------------------ *
 * Home services — plumbers, heating engineers, electricians.
 *
 * What makes this trade unlike the other fifteen: everywhere else, the
 * person who does the work and the person who answers the phone are two
 * people in the same building. Here they are the same person, and the
 * work itself is what physically stops him answering — hands in the job,
 * one bar of signal in a cellar, a wet vac running, or a paying customer
 * watching him decide whether to pick up. Every call he takes costs him
 * the job he is on; every call he misses costs him the job he isn't on
 * yet.
 *
 * Vocabulary is checked against the trade, not against a thesaurus.
 * Gas work in Great Britain is Gas Safe registered — CORGI stopped being
 * the registration body in 2009 and using it tells a heating engineer
 * immediately that nobody here has met one. Engineers are registered,
 * not certified. UK homes have a boiler and a cylinder, not a furnace
 * and a water heater. A tripped RCD is "the trip switch" to the caller
 * and a consumer unit is "the fuse box".
 *
 * Three conventions this file is meant to settle, since the other
 * fifteen pages were written from it:
 *
 * Causation. Nothing on the job card inks before the thing that caused
 * it. Every `at` sits at or after the caller turn it quotes or the
 * toolRun named in `from`. The vulnerable-occupant flag inks at 35
 * because that is when save_lead_details returns, two seconds after she
 * says her mother is eighty-four — not at 56, where it used to sit
 * behind its own cause. Drag the playhead back past `at` and a field is
 * un-caused, which is the entire argument of the section.
 *
 * Money. The call is in pounds because everything else here is: a
 * Bristol postcode, a Gas Safe registration, an £85 call-out. The
 * per-call estimate is in pounds for the same reason, and the dollar
 * figure beside it is worked separately off a different job average
 * rather than run through an exchange rate.
 *
 * end_call is deliberately absent. It only exists in the self-run
 * pipeline, so putting it on a page would promise something the product
 * does not do on any plan a customer can buy.
 * ------------------------------------------------------------------ */

export const homeServices: Trade = {
  slug: "home-services",
  label: "Home services",

  kicker: "Three calls come in while you're under somebody's sink.",
  standfirst:
    "It answers on the first ring, writes the fault down the way she said it, and puts the job on your diary — without promising a minute you can't hold or a price nobody has seen.",

  prongs: [
    {
      id: "today",
      label: "Needs someone today",
      does: "gets someone out today",
      caller: "There's water coming through the kitchen ceiling. I've turned it off at the mains, I think.",
      asks: "Takes the postcode, checks what today still has left in it, and books the first start your diary can actually support. Then it pages you, before the van has moved.",
      urgent: true,
    },
    {
      id: "booked",
      label: "Goes in the diary",
      does: "fills next week for you",
      caller: "No heating, no hot water since this morning. It's flashing F28.",
      asks: "Takes the fault code letter for letter, offers what you have free, and — once she has said yes to a text — sends her the confirmation with the call-out fee on it.",
    },
    {
      id: "quote",
      label: "Worth a survey",
      does: "gets you onto the doorstep to price it",
      caller: "I want a price for a new boiler. What are you like for a combi?",
      asks: "Books you in to go and look. Nobody prices a boiler on a house they haven't seen, and the caller is told exactly that.",
    },
  ],

  intents: [
    { chip: "smell of gas in the kitchen", reaches: "notify_team", then: "Gives her 0800 111 999, pages you while she's still on the line, and books nothing." },
    { chip: "water through the ceiling", reaches: "check_availability", then: "Asks whether she can reach the stopcock, then looks at what today has left." },
    { chip: "boiler's flashing F28", reaches: "save_lead_details", then: "F28 goes down as F28. It doesn't decide she means F22 because F22 is the commoner one." },
    { chip: "no heating, no hot water", reaches: "save_lead_details", then: "Records which she said. Heating but no hot water is a different job from neither." },
    { chip: "what do you charge to come out", reaches: "search_knowledge", then: "Reads the call-out fee and the hourly rate off your own price list. Never a total." },
    { chip: "he was meant to be here at eight", reaches: "transfer_call", then: "Doesn't try to fix it. Puts her through, and takes the complaint if nobody picks up." },
    { chip: "your lad was here Tuesday", reaches: "transfer_call", then: "Same fault, finished work. A callback never gets re-booked by a machine; it goes to you." },
    { chip: "need the gas cert for my tenant", reaches: "check_availability", then: "Looks for a slot for the safety check. Says nothing about whether he's late or compliant." },
    { chip: "trip switch keeps going", reaches: "check_availability", then: "Looks for an electrician's slot. Never suggests she resets it — that's how people get hurt." },
    { chip: "making a noise like a kettle", reaches: "save_lead_details", then: "Takes the symptom as described. Kettling is a real term; the engineer rules on it, not the phone." },
    { chip: "can I move Thursday to Friday", reaches: "find_booking", then: "Finds the job under the number she rang from. Nothing under that number, nothing moves." },
    { chip: "price for a new combi", reaches: "check_availability", then: "Looks for a survey slot. It won't price a boiler nobody has seen, and it tells her so." },
    { chip: "dripping tap, but mum's 84", reaches: "notify_team", then: "Routine job, flagged occupant. You wrote that rule; it applies it without being clever." },
    { chip: "put me on to the engineer", reaches: "transfer_call", then: "Straight through, first ask. It doesn't ask her why, and it doesn't offer to help instead." },
    { chip: "want to cancel tomorrow", reaches: "cancel_appointment", then: "Finds it under her number first, then cancels. Cancelling tells nobody, so it pages you after." },
    { chip: "no heat and there's a baby here", reaches: "notify_team", then: "Pages you while it is still taking the booking, rather than choosing between the two." },
  ],

  duration: 64,

  turns: [
    { at: 0, side: "agent", text: "Hastings Heating — you're through to the answering assistant. What's happened?" },
    { at: 7, side: "caller", text: "No heating, no hot water since this morning. It's flashing F28." },
    { at: 14, side: "agent", text: "F28, no heating and no hot water. Can I take your name and the address?" },
    { at: 19, side: "caller", text: "Marie Whelan. Fourteen Cotham Road, BS6 6DR." },
    { at: 27, side: "agent", text: "Thank you. Is there anyone in the house who'd struggle without heat tonight?" },
    { at: 33, side: "caller", text: "My mum's staying with us. She's eighty-four." },
    { at: 38, side: "agent", text: "I've flagged that — Gary, the engineer, has a message about her already. Let me see what he's got free." },
    { at: 45, side: "agent", text: "First thing he has is eight tomorrow morning. I'll say morning rather than eight, because I can't promise you the minute. That's the honest answer." },
    { at: 52, side: "caller", text: "Yes, that's fine." },
    { at: 54, side: "agent", text: "Booking it now. Can I text you the confirmation? It has the call-out fee and your cancellation rights on it." },
    { at: 57, side: "caller", text: "Yes, do." },
    { at: 60, side: "agent", text: "Sent. And Gary already has the note about your mum." },
  ],

  toolRuns: [
    { at: 35, tool: "save_lead_details", ms: 190 },
    { at: 36, tool: "notify_team", ms: 160 },
    { at: 39, tool: "check_availability", ms: 410 },
    { at: 55, tool: "book_appointment", ms: 680 },
    { at: 58, tool: "send_sms", ms: 540 },
  ],

  rig: {
    title: "Job card",
    form: "job-card",
    fields: [
      { id: "fault", label: "Fault, in her words", value: "No heating, no hot water · F28", at: 14, from: "caller", onPhone: true },
      { id: "name", label: "Caller", value: "Marie Whelan", at: 19, from: "caller", onPhone: true },
      { id: "where", label: "Address", value: "14 Cotham Road, BS6 6DR", at: 21, from: "caller", onPhone: false },
      { id: "flag", label: "Flagged", value: "Occupant, 84 — no heat overnight", at: 35, from: "save_lead_details", onPhone: false },
      { id: "window", label: "Offered", value: "Tomorrow, first free start 08:00", at: 45, from: "check_availability", onPhone: true },
      { id: "booked", label: "On the diary", value: "Booked · ref 4471 · tomorrow 08:00", at: 56, from: "book_appointment", onPhone: true },
      { id: "texted", label: "Sent to Marie", value: "Call-out £85 · cancellation rights", at: 59, from: "send_sms", onPhone: false },
    ],
    receipt: "Booked for the morning. Marie has the fee in writing. Gary had the note about her mother before a slot was even offered.",
  },

  wall: {
    never: "give you a price for a job nobody has seen",
    clause:
      "Never give a total or an estimate for work that has not been inspected. You may state the published call-out fee, hourly rate and out-of-hours premium. If pressed, repeat the rates and offer to book.",
    clauseSource: "the system prompt, enforced on our servers — not a setting the caller can talk it out of",
    detents: [
      {
        caller: "Roughly what's it going to cost me?",
        agent: "The call-out is £85 and covers the first hour. After that it's £60 an hour, parts on top.",
      },
      {
        caller: "Yeah but ballpark. What am I looking at?",
        agent: "I genuinely can't put a number on it until someone's seen it. The £85 is the part I can promise you.",
      },
      {
        caller: "Come on. Two hundred? Three? Just give me a figure.",
      },
      {
        caller: "The firm down the road quoted me two-fifty over the phone.",
        agent: "Then they've quoted you for something they haven't looked at. Let me get Gary on the phone to you — he prices the jobs, I don't.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "You're probably looking at somewhere around three hun",
      instead:
        "— I can't give you a total for a job we haven't seen. The call-out is £85, the rate is £60 an hour, and the engineer tells you before anything changes that.",
    },
    crosses: "Press it twice on money and it stops refusing and starts dialling. Price is the one subject it hands to a person rather than holds.",
  },

  relay: {
    because:
      "Some calls stop being bookings. A smell of gas, a CO alarm sounding, someone hurt on site — none of that is a job for a diary, and an engineer forty minutes away is the wrong answer to all three. Nobody is put through, because there is nothing for you to say that 0800 111 999 does not say better. You are paged instead, while she is still outside on the pavement; and if the page doesn't land because you're three floors down on one bar, the message is sitting there when you come up.",
    who: "whoever you have on call",
    by: ["notify_team", "take_message"],
    carries: [
      "the address, and that no van has been sent to it",
      "which of the three it was — gas, an alarm, or someone hurt",
      "that she was given 0800 111 999 and told to get everyone out",
    ],
    seconds: 8,
  },

  rules: [
    {
      label: "Flag anyone elderly, a baby, or a medical dependency",
      changes: "The call asks who is in the house before it offers a slot, and pages you the moment it hears an answer.",
      on: true,
    },
    {
      label: "Never book outside my postcodes",
      changes: "Out of area, it takes the details and tells her honestly that you don't cover her street.",
      on: true,
    },
    {
      label: "After 20:00 put emergencies through to my mobile",
      changes: "Out of hours, a real emergency rings you instead of waiting in an inbox until seven.",
      on: false,
    },
  ],

  ink: { ember: true, settled: true },

  faq: [
    {
      q: "Will it tell someone their boiler is fine, or how much a job costs?",
      a: "No to both, and neither is a setting you can turn on. It writes the symptom and the fault code down as spoken and leaves the diagnosis to the engineer, because that is what the engineer is paid for and what his insurance covers. On price it reads your published call-out fee, hourly rate and out-of-hours premium off your own documents, and it will not give a total for a job nobody has seen.",
    },
    {
      q: "What happens if someone rings about a gas smell?",
      a: "It stops being a booking call. The agent tells her to get everyone out, gives her the National Gas Emergency Service number — 0800 111 999, aloud first and then by text if she says yes, because nobody standing outside in the rain remembers nine digits — and pages you while she is still on the line. It is not allowed to book that call, and it is not allowed to say a word about the appliance: only a Gas Safe registered engineer may touch one.",
    },
    {
      q: "Can it promise a time? My customers always ask.",
      a: "It offers a start your diary genuinely has free and then says “morning” rather than “eight”, because the minute is not something it can know. “Someone will be with you within the hour” is the fastest way to lose a customer in this trade, and it is exactly the promise an eager answering service makes.",
    },
    {
      q: "What about the four days a year when it all goes at once?",
      a: "The first proper cold snap doubles the volume for about four days, and nobody staffs for four days a year. That is the week this is worth the most and the week it looks least clever: it will not conjure a slot that does not exist. It offers what the diary actually has, says plainly that the answer is Thursday and not today, and takes the rest as messages with the address and the fault on them — so on Friday you are working down a list instead of guessing who gave up.",
    },
  ],

  jargon: [
    "stopcock",
    "combi",
    "cylinder",
    "consumer unit",
    "RCD",
    "CP12",
    "Gas Safe registered",
    "kettling",
    "TRV",
    "call-out",
  ],

  missRate: {
    value: "About one call in four goes unanswered in working hours",
    reasoning:
      "Our estimate, and a band rather than a number: 20–30% across a year for a one-to-three-van firm, worse in a cold week. It comes from the shape of the day, not from a headline — roughly a third of the calls land between 07:30 and 09:30, which is exactly when the van is being loaded, driven, or already unloaded into somebody's kitchen, and there is nobody else in the building to pick up. None of it needs believing: the list of calls you didn't take is already on the phone in your pocket.",
  },

  valuePerCall: {
    value: "About £43 for every call you get back",
    reasoning:
      "Our arithmetic, and all three numbers in it are yours to change. We put an average completed job at £240 — a £90 tap washer and a £2,500 boiler swap sit inside the same mean — we assume 40% of recovered calls are a real enquiry rather than a chase, a supplier, a price shopper or a wrong number, and 45% of those become a job that is done and paid. £240 × 40% × 45% = £43. Out of hours the same sum comes out nearer £127, because whoever rings at 21:40 is standing in water and is not ringing round. For a US firm we work it separately and get about $63, off a different job average — it is not the £43 through an exchange rate. We stop at the per-call figure on purpose: the annual roll-up is the first number a vendor prints and the first one an owner can disprove.",
  },

  citations: [
    {
      claim: "About a quarter of calls to home-services businesses are never answered.",
      publisher: "Invoca, Home Services Lead Conversion Benchmarks Report",
      date: "2026-07",
      sample:
        "Over 70 million tracked calls across nine home-services sub-industries: 27% unanswered, 52% answered by a person overall, rising to 65% on calls that ring past 15 seconds and 73% past 30, with sub-industries spread between 32% and 74%.",
      interest: "Invoca sells call tracking to home-services advertisers, so the number it measures is the number it is paid to reduce.",
    },
    {
      claim: "Most callers who reach voicemail do not leave one.",
      publisher: "Moneypenny, Small Business Call Report",
      date: "2020",
      sample: "300 UK micro-businesses plus call data from 10,000 businesses; 69% of callers who reached voicemail hung up without leaving a message.",
      interest: "Moneypenny sells a call-answering service — the same thing this page is selling.",
    },
    {
      claim: "The gap is speed of reply, not price.",
      publisher: "Jobber, Home Service Trends Report",
      date: "2026",
      sample:
        "1,050 home-service business owners surveyed in December 2025, ±3 points at 90% confidence: 20% reply to an enquiry within the hour, against 55% of customers who expect a reply inside the hour and 28% who expect one immediately.",
      interest: "Jobber sells scheduling and invoicing software to the businesses it surveyed.",
    },
  ],

  objection: {
    asks: "My customers ring because they want me. They'll hang up on a robot and ring the bloke down the road.",
    answer:
      "He is right, and the comparison is the thing to get straight. It is not you or the agent — the fifteen-year customers ring your mobile anyway and always will. It is the agent or nothing, in the one call in four where nothing is what currently happens: four rings and voicemail, at 07:40, on the A38, with a flue in the back. The person it is for found you on Google ninety seconds ago and has three other numbers open in three other tabs. It says whose phone it is in the first six words, it never pretends to be a person, and the moment somebody asks for you by name it stops talking and dials you.",
  },
};
