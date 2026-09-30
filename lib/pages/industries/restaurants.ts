import type { Trade } from "./schema";

/* ------------------------------------------------------------------ *
 * Restaurants — independents, bistros, neighbourhood dining rooms.
 *
 * What makes this phone unlike the others: everywhere else it rings
 * where nobody can see it — an empty office, a van, a workshop, a desk
 * whose whole job is the phone. This one rings at the host stand, in
 * front of a queue of people who came all the way here, and they can
 * watch the host decide. Picking it up means turning your back on a
 * guest who has already arrived. So the host doesn't, forty times a
 * night, and every single time that is the correct decision.
 *
 * The second thing: demand and incapacity are the same event. Six to
 * eight on a Friday is the hour the phone rings hardest and the hour
 * the floor is deepest, so the caller gets the din, the engaged tone or
 * a 73-second hold. And what is being sold is perishable in a way a
 * plumber's Tuesday is not — a 7:30 table nobody booked does not get
 * rescheduled. The food was prepped, the staff were rostered, and the
 * chairs sit there. The table is an airline seat.
 *
 * Vocabulary is checked against the trade. A British independent takes
 * bookings, not reservations, and counts covers, not customers — the
 * people are guests. There is a first and a second sitting (US:
 * seating). A room that is booked out is fully committed. A dish that
 * has run out is 86'd. Dietaries is the plural noun for the whole
 * category, and collection is what the US calls pickup. Last orders
 * comes from the licence and is not last seating; service is the meal
 * period, never the service charge.
 *
 * And the one that would cost us the reader: nothing here says a dish
 * is nut-free or gluten-free. Kitchens that cannot guarantee it write
 * "made without gluten-containing ingredients" and "we cannot
 * guarantee against cross-contamination". Getting that phrasing wrong
 * on a marketing page tells an operator we have never once stood in
 * front of the liability they carry.
 * ------------------------------------------------------------------ */

export const restaurants: Trade = {
  slug: "restaurants",
  label: "Restaurants",

  kicker: "The phone rings at the host stand while you walk a six to table twelve.",
  standfirst:
    "It picks up on the fourth ring, when the stand is three deep, puts the covers in the book you're already looking at, and never confirms a table it can't see.",

  prongs: [
    {
      id: "tonight",
      label: "A table tonight",
      does: "puts tonight's covers in the book",
      caller: "Have you got a table for four tonight? Any time, really — we're not fussy.",
      asks: "Checks the book before it says a word, offers only the times it actually has free, and texts her the one she takes with the street name. If tonight is committed it says so and offers the waitlist.",
      urgent: true,
    },
    {
      id: "change",
      label: "Changing the book",
      does: "moves the booking, resells the seven",
      caller: "We're in Friday at seven under Brightwell — any chance of moving it to eight?",
      asks: "Finds the booking on the number she's ringing from, moves it, and puts seven o'clock back in the book while there is still a week left to sell it.",
    },
    {
      id: "group",
      label: "A group of fourteen",
      does: "writes the fourteen up for the manager",
      caller: "It's my mum's 70th, there'd be about fourteen of us — maybe sixteen. Can you do that?",
      asks: "Takes the covers, the date, the dietaries and the fact that it's a 70th, then has the manager ring her back. Nothing over eight covers gets booked by a phone.",
    },
  ],

  intents: [
    { chip: "table for four tonight, not fussy", reaches: "check_availability", then: "She's ringing down a list of four places. It looks at the book before it says a word." },
    { chip: "my daughter's got a nut allergy", reaches: "save_lead_details", then: "Writes the allergy down against her name and tells her the kitchen will confirm. It assures her of nothing." },
    { chip: "stuck on the A40, we'll be late", reaches: "notify_team", then: "The floor knows before the table goes to a walk-in. Whether it's still there at ten past is the host's call." },
    { chip: "are you the one on the high street", reaches: "search_knowledge", then: "Reads your address off your own documents rather than sending her to the other site." },
    { chip: "the bread thing — gluten, is it", reaches: "take_message", then: "She hasn't got the word for it. It writes down what she said and lets the kitchen name it." },
    { chip: "two katsu and a — hang on, Wes", reaches: "take_message", then: "Waits while she asks Wes, reads the order back, and leaves it for the kitchen. It quotes no pickup time." },
    { chip: "we ate Saturday, my wife's ill", reaches: "transfer_call", then: "Stops being a booking. Straight to the manager — nothing admitted, nothing offered, nothing discussed." },
    { chip: "parking? And can I get a pram in", reaches: "search_knowledge", then: "Ten seconds, off your own documents, and nobody left the host stand to answer it." },
    { chip: "what time's last orders Sunday", reaches: "search_knowledge", then: "Reads this year's last orders off your documents, not the ones still sitting on Google." },
    { chip: "under Brightwell — make it eight", reaches: "find_booking", then: "Finds the booking on the number she's ringing from before it moves anything." },
    { chip: "we'll have to cancel Saturday", reaches: "cancel_appointment", then: "Cancels only the booking it already found under her number. The covers go back in the book, a week out." },
    { chip: "ring me if Friday drops", reaches: "add_to_waitlist", then: "Fully committed isn't the end of the call. She goes on the waitlist with the nights she could come." },
    { chip: "mum's 70th, fourteen of us", reaches: "save_lead_details", then: "Covers, date, dietaries, the cake she wants to bring — then a person rings her. It books none of it." },
    { chip: "want a card for the deposit?", reaches: "send_sms", then: "Never takes a card number aloud. If you've given it a deposit link, it texts that instead." },
    { chip: "engaged all evening, every evening", reaches: "transfer_call", then: "Angry gets a person, not a policy. It doesn't explain why the phone was busy." },
    { chip: "is Marcus Ibbotson in tonight?", reaches: "take_message", then: "It won't say who is dining, for any reason. It takes a message and leaves that to a person." },
  ],

  duration: 73,

  turns: [
    { at: 0, side: "agent", text: "Rossiter's — this is the answering assistant. Yanna's got a queue at the stand, so you've got me. What can I do for you?" },
    { at: 7, side: "caller", text: "Have you got a table Friday, around eight? There'd be six of us." },
    { at: 14, side: "agent", text: "Six covers, Friday. Let me have a look at the book." },
    { at: 21, side: "agent", text: "Eight is fully committed, I'm afraid. What the book has free is half six, or quarter to nine after it." },
    { at: 29, side: "caller", text: "Quarter to nine's fine. It's my husband's birthday, actually — can you do anything with that?" },
    { at: 36, side: "agent", text: "I'll put it on the booking and let the floor know. I can't promise you a cake or the window table — that's Yanna's call on the night." },
    { at: 44, side: "caller", text: "Understood. It's Josephine Tiplady. Oh — one of us doesn't eat dairy." },
    { at: 51, side: "agent", text: "Josephine Tiplady, six at quarter to nine, no dairy written on the booking. The kitchen will take you through it at the table — I can't tell you what's in a dish myself." },
    { at: 59, side: "caller", text: "That's fine. Thank you." },
    { at: 64, side: "agent", text: "Booked. You'll get a text with the time and the address — we're the one on Chandos Street, not the high street." },
  ],

  toolRuns: [
    { at: 12, tool: "get_call_context", ms: 90 },
    { at: 15, tool: "check_availability", ms: 380 },
    { at: 38, tool: "notify_team", ms: 150 },
    { at: 53, tool: "save_lead_details", ms: 210 },
    { at: 61, tool: "book_appointment", ms: 640 },
    { at: 66, tool: "send_sms", ms: 520 },
  ],

  rig: {
    title: "Booking slip",
    form: "slip",
    fields: [
      { id: "covers", label: "Covers", value: "6", at: 10, from: "caller", onPhone: true },
      { id: "sitting", label: "Sitting", value: "Friday 20:45 — free in the book", at: 21, from: "check_availability", onPhone: true },
      { id: "occasion", label: "Flagged to the floor", value: "Birthday · nothing promised", at: 38, from: "notify_team", onPhone: false },
      { id: "name", label: "Booking name", value: "Josephine Tiplady", at: 46, from: "caller", onPhone: false },
      { id: "dietary", label: "Dietaries", value: "No dairy · kitchen to confirm at the table", at: 53, from: "save_lead_details", onPhone: true },
      { id: "booked", label: "In the book", value: "Fri 20:45 · a six", at: 61, from: "book_appointment", onPhone: true },
      { id: "texted", label: "Texted to Josephine", value: "20:45 Friday · Chandos Street", at: 66, from: "send_sms", onPhone: false },
    ],
    receipt: "Six covers at quarter to nine. The birthday's with the floor, and nobody on the phone told her what's in the food.",
  },

  wall: {
    never: "tell a caller a dish is safe for their allergy",
    clause:
      "Never state or imply that a dish, a fryer or a kitchen is free of any allergen, and never say an allergy can be accommodated. Record the allergy against the booking, say the kitchen will confirm directly, and hand the call to a person if the caller needs an answer now.",
    clauseSource:
      "the system prompt, enforced on our servers before the call connects — there is no switch for it in your dashboard and no wording that gets round it",
    detents: [
      {
        caller: "My daughter's got a nut allergy. Is that going to be a problem with your kitchen?",
        agent: "I'll put the nut allergy on the booking now, and the kitchen will go through the menu with you before you order. I can't tell you what's in a dish myself.",
      },
      {
        caller: "I'm not asking for a guarantee. Off the menu — is there peanut in the satay?",
        agent: "I know how that sounds. I still can't answer it: the answer moves with the supplier and I'd be guessing with your daughter. Chef can tell you in two minutes.",
      },
      {
        caller: "She's eleven. I just need to know if she can eat here. Is the fryer separate or not?",
      },
      {
        caller: "Every other restaurant I've rung tonight managed to answer that.",
        agent: "Then one of them told you something they can't stand behind. I'm putting you through to the kitchen now — they can answer it and I can't.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "The fryer's separate, so she'd be fine with the chi",
      instead:
        "— I can't tell you what's in a dish or how it's cooked. I've written 'nut allergy, eleven years old' on your booking and I'm putting you through to the kitchen now.",
    },
    crosses:
      "An allergy that needs an answer rather than a note goes to a person while the caller is still on the line. It never offers to check and ring back, because by then she has booked somewhere that picked up.",
  },

  relay: {
    because:
      "Two calls stop being bookings the moment they start. Someone who says they were ill after eating with you, and anyone who says they are the press, environmental health, trading standards or a solicitor. Neither gets an apology, a refund or a word about what they ate. The duty manager's phone buzzes with the facts first, so she is not hearing it cold when the call lands a second later — and the insurer gets a call nobody has already half-answered. Nobody is asked to leave a message: a complaint that goes to voicemail is a complaint that goes to Google instead.",
    who: "the duty manager, or whoever you marked for transfers",
    by: ["notify_team", "transfer_call"],
    carries: [
      "who is calling and the number she rang from",
      "the date they say they ate with you, quoted rather than summarised",
      "that nothing was admitted, offered or discussed",
    ],
    seconds: 8,
  },

  rules: [
    {
      label: "Nothing over eight covers without me",
      changes: "A nine goes from a booking to a brief: covers, date, dietaries, pre-order, and your callback — it books none of it.",
      on: true,
    },
    {
      label: "No booking after 21:15 — that's the last sitting",
      changes: "Past the last sitting it stops offering tonight and puts her down for the next service instead of a table the kitchen can't cook.",
      on: true,
    },
    {
      label: "Offer the waitlist when we're committed",
      changes: "A full Friday ends with her on the waitlist and the nights she could come, rather than with an apology and a dial tone.",
      on: false,
    },
  ],

  ink: { ember: false, settled: true },

  faq: [
    {
      q: "Will it tell someone a dish is gluten-free?",
      a: "No, and there is no version of this where it does. It records the allergy against the booking in the caller's words, says plainly that the kitchen will confirm, and puts her through to a person if she needs the answer now. It will not even repeat your own menu wording back at her, because a phone line is distance selling: allergen information has to be available before the order is concluded and given again at handover, and whoever says it, the restaurant carries the liability.",
    },
    {
      q: "Can it double-book my Saturday?",
      a: "It books into the connected calendar the floor is looking at, or it does not confirm at all. Where there's no live availability it takes the request as a message, tells the caller straight on the call that the restaurant will confirm, and leaves it with whoever has the book. It cannot ring her back later and it doesn't pretend it will. An honest \"someone will come back to you\" has never put two sixes at the door at eight.",
    },
    {
      q: "What about deposits on the big tables?",
      a: "It never takes a card number, an expiry or a CVV. Card details spoken down a phone are a MOTO transaction and drag the whole call into PCI scope, which is a problem you do not want and we do not want. If you've given it a deposit link it texts that; otherwise the manager takes the deposit the way they always have.",
    },
    {
      q: "Will it take a collection order?",
      a: "Yes, at the caller's pace, including the twenty seconds where she asks Wes what he wanted. It reads the order back and leaves it for the kitchen as a message. What it will not do is quote her a collection time, because it cannot see how deep the pass is at half seven — the kitchen gives her that, not the phone. It will not take a drinks order for collection either, and it will not confirm anybody's age: alcohol is licence-bound and time-bound and a phone cannot check a date of birth.",
    },
    {
      q: "Someone rings asking whether a named guest is in tonight.",
      a: "It doesn't answer that, for anyone, for any reason — not the table, not the time, not who they're with. It takes a message and leaves the decision to a person. Most of those calls are harmless. The ones that are not are the reason this is a rule rather than a judgement call.",
    },
  ],

  jargon: [
    "covers",
    "the book",
    "sitting",
    "fully committed",
    "turn the table",
    "dietaries",
    "pre-order",
    "last orders",
    "collection",
    "86'd",
  ],

  missRate: {
    value: "About one call in seven goes unanswered while you're open",
    reasoning:
      "Our estimate, and it counts open hours only. Revmo AI recorded 12,091 restaurant calls and put full-service misses at 9.0%; we've adjusted that up for a one-line independent where nobody's actual job is the phone. Inside Friday six-to-eight it is far worse than one in seven — Maple's installed base ran at a third of calls missed at peak, and those are sites that bought the product because they already knew. Every call that lands on your closed day, or in the 3-to-5 changeover with the door locked, is missed outright: a separate and much bigger number, which we are not blending in to make either one look dramatic. A missed Tuesday lunch call and a missed Friday-at-seven call are not the same loss, and a single percentage is built to hide exactly that.",
  },

  valuePerCall: {
    value: "Around $24 for each call you get back",
    reasoning:
      "Built from the call mix, not the best case. Of a hundred recovered calls roughly thirty-eight are booking calls, about three-quarters of those end in a booking, and an average party of 2.8 covers at a $34 head spend is worth something like $86 once no-shows are taken off. Add the collection orders and a badly-converting slice of large-group enquiries. Count the hours, directions, parking and lost-property calls at nothing, because that is what they are worth. Then take a quarter off the lot, because some of the people you missed rang back, booked online or walked in anyway. We stop at the per-call figure. Turning it into a week or a year needs a call count we do not have and would be guessing at.",
  },

  citations: [
    {
      claim: "Full-service restaurants miss fewer calls than the headline figures suggest — and the callers who do wait don't wait long.",
      publisher: "Revmo AI, State of Restaurant Calls 2026",
      date: "2026-08-20",
      sample:
        "12,091 recorded calls with the method stated and split by segment — full-service 9.0% missed, fast casual 24.8%, QSR 40.1%, pizza 6.9%; callers abandoned after an average of 5.5 rings, and average hold at full-service was 73 seconds.",
      interest: "Revmo AI sells AI phone answering to restaurants.",
    },
    {
      claim: "The miss rate that matters is the peak-hour one, and it looks nothing like the all-hours average.",
      publisher: "Maple, restaurant phone data from its own installed base",
      date: "2025-12",
      sample:
        "1.2 million calls at more than 1,000 US restaurant locations, December 2023 to November 2025; 33% of calls missed during peak hours, 42% of callers abandoning before the vendor's system went in, and an average call length of 1 minute 45 seconds.",
      interest:
        "Maple sells restaurant phone answering, and every location in the sample is one that bought it — read the pre-install figures as the strongest version of the case for the product.",
    },
  ],

  objection: {
    asks: "Hospitality is the voice that answers the phone. Someone rings my place, gets a robot, and my whole brand's gone in four seconds — and then it double-books my Saturday and I've got two sixes at the door at eight and one of them's going on Google.",
    answer:
      "He is right about the voice, which is why it is not the first thing anyone hears. It picks up on the fourth ring, or when the line is engaged, or when the door is locked — never in front of a host who could have got there. So the comparison isn't the agent against Yanna on the door. At 7:40 on a Friday the comparison is the agent against seventeen rings, an engaged tone, or a voicemail nobody plays back until twenty to midnight, by which time the caller wanted a table at eight and it is over. On the double-booking: it writes into the calendar the floor is looking at, or it doesn't confirm at all — it takes the request, says plainly on the call that you'll confirm, and leaves it with whoever has the book. And the part we'll concede on the page: it will not sell the room. It will never hear that the caller is nervous about a first date and put them on the window table. That is the argument for letting it have the parking calls, and for keeping your host free for the ones that matter.",
  },
};
