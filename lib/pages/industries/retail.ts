import type { Trade } from "./schema";

/* ------------------------------------------------------------------ *
 * Retail & e-commerce — independent shops with a door and a website.
 *
 * What makes this trade unlike the other fifteen: everywhere else the
 * answer to the phone call is in a diary, and the diary does not lie.
 * Look it up, book it, done. Here the answer is on a shelf, the shop's
 * own record of that shelf is an opinion, and the answer is perishable
 * — the last one can be sold at the till while the caller is still
 * describing it. Nobody books a dental appointment and finds it gone
 * mid-sentence. And roughly half of a shop's inbound is money it has
 * already taken: where's my order, is it ready to collect, can I bring
 * this back. Every other trade's phone is revenue to win. A shop's is
 * half revenue to win and half revenue to keep.
 *
 * The agent is further from that shelf than anybody. It has no sight of
 * stock, no sight of an order, no till, no courier feed. It has the
 * shop's own documents and a phone number, and the entire page is built
 * on saying so out loud — because a shop owner will forgive "the system
 * isn't something I can see, let me get someone to look", and will never
 * forgive "yes, we've got one". In the UK, "yes, we've got one" said to
 * an empty shelf is not a customer-service slip; it is a misleading
 * action under the Consumer Protection from Unfair Trading Regulations.
 *
 * The menu card that links to this page now reads "Order found · returns
 * link texted". The second half is true — send_sms texts the caller a
 * link the owner supplied. The first half is not: nothing on this runtime
 * looks up an order, and "order found" is the precise sentence this page
 * spends a thousand words refusing to say. The card lives in lib/site.ts
 * rather than here, so it is not fixed by this file; it is flagged here
 * so the next person to open either one knows they disagree.
 *
 * One tool is deliberately absent. `end_call` is only added to a session
 * when the pipeline is `cartesia_self` (see toolsFor in
 * lib/voice/tools/definitions.ts) — on the managed pipelines the platform
 * hangs up with its own system tool, which is not ours to put on a page.
 * So no beat here shows the agent ending a call as something a customer
 * on a plan is buying. The rep screen below is done with take_message,
 * which every plan has, and the honest claim is narrower: the shop is not
 * interrupted, not that the machine puts the phone down.
 *
 * Vocabulary is checked against the counter, not a thesaurus. "Showing
 * one in the system" does not mean there is one — stock on hand is not
 * available to promise, and every independent lives with phantom stock.
 * The customer says "can you put one by", never "reserve"; it is lay-by
 * in Australia and layaway in the States. Click and collect is UK and
 * EU, BOPIS and curbside are US, and neither owner recognises the
 * other's word. WISMO is an internal term — say it to a customer and
 * you have told them you have a category for them. Do not say warranty
 * when the caller means their statutory rights; do not say "we can only
 * exchange" on faulty goods, which in the UK is unlawful; and a
 * discontinued line is not out of stock, it is never coming back. Till,
 * not register. Queue, not line. Postcode, not zip.
 * ------------------------------------------------------------------ */

export const retail: Trade = {
  slug: "retail",
  label: "Retail & e-commerce",

  kicker: "It rings while the morning's delivery is in bits on the stockroom floor.",
  standfirst:
    "It answers before the third ring, tells the caller exactly what it knows and exactly what it doesn't, and puts the one thing it cannot see — your shelf — in front of somebody who can walk to it.",

  prongs: [
    {
      id: "shelf",
      label: "Ringing before they set off",
      does: "stops a wasted journey into town",
      caller: "Have you got the brown walking boots in a five and a half? I'd come over from Sedbergh.",
      asks: "It cannot see your shelves and it says so in the same breath. It gets the line and the size down as she said them, puts them in front of whoever is on the floor with her number attached, and tells her only what the shop can actually promise — the price, the closing time and the put-by rule.",
      urgent: true,
    },
    {
      id: "paid",
      label: "Already paid for it",
      does: "looks after the ones who already paid",
      caller: "I ordered on Tuesday and it still says preparing for dispatch. Has it gone or not?",
      asks: "It has no sight of your orders, so it does not guess at one. It takes the order number and the postcode, reads your dispatch and returns policy off your own documents, and hands the lot to whoever picks — before she decides to ring the bank instead.",
    },
    {
      id: "advice",
      label: "Doesn't know what they want",
      does: "books time with someone who actually knows",
      caller: "It's a present for my dad and I haven't a clue. He walks, but I don't know what he's got.",
      asks: "Nobody sells a boot down a phone line. It takes what she does know, offers the fitting slots the diary genuinely has free, and puts her in front of the person who fits boots for a living.",
    },
  ],

  intents: [
    { chip: "got it in a five and a half?", reaches: "save_lead_details", then: "Writes the line and the size exactly as she said them. It never says it's there — it can't see your shelf." },
    { chip: "where's my order, it's been a week", reaches: "take_message", then: "No sight of your orders. Takes the order number and the postcode and hands it to whoever picks." },
    { chip: "the plastic bit on the hose", reaches: "save_lead_details", then: "Keeps her description word for word, hose and all, for whoever knows what she actually means." },
    { chip: "nobody's rung me back, four days", reaches: "notify_team", then: "Doesn't defend the shop and doesn't push her to email. Full detail, to the owner, while she's still on." },
    { chip: "open till five or half five?", reaches: "search_knowledge", then: "Reads your hours off your own documents, the short Sunday included, and the car park round the back." },
    { chip: "can you put one by till Saturday", reaches: "notify_team", then: "Asks the floor to hold it. It requests a put-by, it never confirms one — a person does that." },
    { chip: "I'm stood outside and you're shut", reaches: "notify_team", then: "Collection gone wrong. Your phone goes while she's still on the step, and she is told that it has." },
    { chip: "do you price match? saw it cheaper", reaches: "take_message", then: "No match, no discount, no code. The price question goes to whoever is allowed to say yes." },
    { chip: "wrong size — post it or bring it?", reaches: "search_knowledge", then: "Reads your returns window and what you do about postage. It doesn't rule on whether hers is accepted." },
    { chip: "the charger went bang, it's burnt", reaches: "notify_team", then: "Stops being a returns call. What it did and when she bought it hit your phone before she's finished." },
    { chip: "my card number's four-two-six", reaches: "send_sms", then: "Stopped before the second digit. No card details, ever — it texts the payment link you gave it." },
    { chip: "you got the vapes behind the till?", reaches: "transfer_call", then: "Age-restricted. It won't sell, put by or confirm collection; the first mention goes to a person." },
    { chip: "who looks after your card machine?", reaches: "take_message", then: "A rep, not a customer. He gets a no and a line in your message list, and nobody left the till for it." },
    { chip: "ringing round, who's got one today", reaches: "save_lead_details", then: "She has four numbers open. It has her name and her number before she dials the third one." },
    { chip: "change the address it's going to", reaches: "take_message", then: "Never. An in-flight address change is a person's job every time. It takes the request and stops." },
    { chip: "can I book in for a boot fitting", reaches: "check_availability", then: "Reads the fitting diary before it offers her anything — two real Saturday times, not a maybe." },
  ],

  duration: 71,

  turns: [
    { at: 0, side: "agent", text: "Fell and Field, Kendal — you're through to the shop's answering assistant. What can I look up for you?" },
    { at: 6, side: "caller", text: "Have you got the brown walking boots, the ladies' ones, in a five and a half? I'd come over from Sedbergh." },
    { at: 13, side: "agent", text: "Ladies' brown nubuck, five and a half. Let me find which line that is." },
    { at: 21, side: "agent", text: "That's the Fell Walker II, a hundred and forty-five. What I can't tell you is whether there's one on the shelf — I can't see the shop." },
    { at: 28, side: "caller", text: "Can't you just look on the computer?" },
    { at: 33, side: "agent", text: "I haven't got the stock screen, and I'd rather say that than have you drive in on a guess. Can I take your name and a number?" },
    { at: 39, side: "caller", text: "Rhona Sowerby. Oh seven seven double-oh, nine hundred, four one two. It's forty minutes each way, that." },
    { at: 49, side: "agent", text: "Noted. If it's there it goes under your name till we shut at half five — that's the shop's rule, not mine to bend. All right to text this number?" },
    { at: 56, side: "caller", text: "Yes. And if it isn't there?" },
    { at: 60, side: "agent", text: "Then someone tells you that, before you've spent the petrol. Beth's on the floor and she's gone to look with your size and your number, and the price and our closing time are on their way to you." },
  ],

  toolRuns: [
    { at: 15, tool: "search_knowledge", ms: 520 },
    { at: 45, tool: "save_lead_details", ms: 210 },
    { at: 47, tool: "search_knowledge", ms: 360 },
    { at: 57, tool: "send_sms", ms: 590 },
    { at: 59, tool: "notify_team", ms: 170 },
  ],

  rig: {
    title: "Put-by slip",
    form: "order",
    fields: [
      { id: "want", label: "What she's after", value: "Ladies' brown nubuck boot, 5½", at: 13, from: "caller", onPhone: true },
      { id: "line", label: "Line, off your own list", value: "Fell Walker II, ladies' · £145", at: 21, from: "search_knowledge", onPhone: true },
      { id: "caller", label: "Caller", value: "Rhona Sowerby · 07700 900412", at: 39, from: "caller", onPhone: true },
      { id: "journey", label: "Coming from", value: "Sedbergh — forty minutes each way", at: 46, from: "save_lead_details", onPhone: false },
      { id: "putby", label: "Put-by rule", value: "Under her name till 17:30, if it's there", at: 49, from: "search_knowledge", onPhone: false },
      { id: "texted", label: "Sent to Rhona", value: "£145 · open till 17:30 · Mill Lane car park", at: 58, from: "send_sms", onPhone: false },
      { id: "shelf", label: "On the shelf", value: "Not known — Beth asked to go and look", at: 60, from: "notify_team", onPhone: true },
    ],
    receipt:
      "Nobody has told her the boot is there. Beth has the size and the number, Rhona has the price and the closing time in writing, and if it isn't on the shelf she finds that out before she gets in the car.",
  },

  wall: {
    never: "tell a caller something is in stock",
    clause:
      "You have no sight of stock, orders or deliveries. Never state or imply that an item is in stock, available, put by, reserved or ready to collect. You may state what the business sells, its prices, its opening and collection hours and its returns policy from the business documents. For anything on a shelf, take the item, the size and the caller's number and alert the shop floor.",
    clauseSource: "the system prompt, enforced on our servers — not a setting the caller can talk it out of",
    detents: [
      {
        caller: "Have you got it in a five and a half or not?",
        agent: "I can tell you it's a line we stock and it's £145. What I can't tell you is whether there's a five and a half on the shelf this minute.",
      },
      {
        caller: "Well can't you look on the computer?",
        agent: "I haven't got the stock screen in front of me, and I'd rather say so than guess. Someone on the floor can have the box in their hands in two minutes.",
      },
      {
        caller: "Your website says in stock. Just say yes.",
      },
      {
        caller: "I'm not driving in from Sedbergh for a maybe.",
        agent: "You shouldn't have to. Give me your number and whoever's on the floor texts you the moment they've looked — if it's gone, you've saved the journey.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "Yes, if the website's showing it then there'll be one in the stockro",
      instead:
        "— I can't tell you what's on the shelf. The website counts what the till hasn't sold yet, and it's wrong often enough that I won't send you into town on it. Two minutes, and someone will have looked.",
    },
    crosses:
      "Anyone who wants certainty about a shelf is handed to somebody who can go and stand in front of it, and she is told that person's name before she hangs up.",
  },

  relay: {
    because:
      "Two calls stop being shop calls the moment you hear them. A product that burnt, sparked, cut or made somebody ill — that is a safety report with duties attached, not a return. And the caller who says he's your supplier and needs the bank details changed, or your manager and needs gift cards bought and the numbers read back. Neither waits for the morning, and neither is put through to anyone — not as a limitation we are dressing up, but because the reason this call reached an answering agent at all is that nobody was standing next to the phone. The alert goes to a mobile and the detail is written down behind it, which is the pair that still works at ten past eight on a Sunday.",
    who: "whoever you put on the escalation list — usually the owner",
    by: ["notify_team", "take_message"],
    carries: [
      "the product, when it was bought and what it did, in her words, with no diagnosis added",
      "the order number or the recall number if she has one",
      "her name and the number she rang from, so the call back doesn't open with who's this",
    ],
    seconds: 11,
  },

  rules: [
    {
      label: "Screen the reps — I'm not taking another card-machine call",
      changes: "Anyone opening with who looks after your card processing gets a polite no, and his pitch becomes a line in the message list rather than a handset ringing across a queue. What reaches you is something you can scroll past.",
      on: true,
    },
    {
      label: "A burn, a spark or an injury reaches me the same hour",
      changes: "It stops handling the call as a return, writes down the product and what it did, and your phone goes while she's still on the line.",
      on: true,
    },
    {
      label: "Hold things for 24 hours, not just till closing",
      changes: "The put-by it asks the floor for runs to this time tomorrow, and the caller is told that rather than half five today.",
      on: false,
    },
  ],

  ink: { ember: false, settled: true },

  faq: [
    {
      q: "Can it see my stock?",
      a: "No, and it is not allowed to behave as though it can. It has your documents — what you sell, what it costs, your hours, your collection and returns policy — and it has a phone number. It does not have your till system, your website's stock count or your stockroom. So it says what it knows, asks the floor to look at what it doesn't, and gets the caller's number before she rings the next shop. The thing an owner cannot afford is a phone that is confident about a shelf, and this one is built so it cannot be.",
    },
    {
      q: "Can it tell someone where their order is?",
      a: "No. There is no order lookup, no courier feed and no account history, so it takes the order number and the postcode and puts them in front of whoever picks. That limit has a second edge worth having: it cannot read a customer's home address to a stranger who claims to be them, and it cannot change a delivery address on an order in flight. Both of those are how parcels get diverted, and both are a person's job every time.",
    },
    {
      q: "Somebody will read their card number out. What then?",
      a: "It stops them, and it does not repeat or store a digit of it. A card number spoken on a line you control drags the whole phone system into PCI scope, and a recording with a PAN in it is a problem you did not have that morning. It sends the payment link you gave it by text, or it puts the caller through to a person on a line set up for it.",
    },
    {
      q: "What about the ones quoting consumer law at me over a return?",
      a: "It does not adjudicate. It reads your published returns window and what you do about postage, off your own documents, and it logs what she is asking for with the order number and the date. It will not authorise a refund, waive anything or tell her the return is accepted — and it will not do the opposite either, because no refunds and it's past twenty-eight days are the two sentences that turn a return into a complaint letter.",
    },
    {
      q: "The shop shuts at half five. Does that matter?",
      a: "It is most of the point. The shutters come down and the website carries on selling, so the evening, the Sunday and the bank holiday calls — order chasers, returns, can I collect tomorrow — arrive into a dark shop and every one of them is missed by definition. Those callers get an answer at nine at night and you get the order numbers on the counter at nine in the morning.",
    },
  ],

  jargon: [
    "SKU",
    "available to promise",
    "phantom stock",
    "put by",
    "shrinkage",
    "click and collect",
    "WISMO",
    "RMA",
    "tracked 48",
    "ex-VAT",
  ],

  missRate: {
    value: "About three calls in ten go unanswered, and far worse on a Saturday",
    reasoning:
      "Our estimate, from the shape of a shop's week, because there is no retail-specific published one we would stand behind — the 62% that circulates in this category traces back to a marketing firm with no method attached, and we are not going to launder it by quoting it. What we can reason about is the clash: the phone peaks in the same hour the delivery is being checked in, and again when the floor is at its busiest, so the misses cluster exactly where the footfall is. A wet Tuesday sits nearer a quarter; a Saturday afternoon in December is over half; and everything after the shutters come down is missed by definition, because the website doesn't shut. One caveat we would rather print than hide — a real share of what you miss is somebody selling you a card machine, so not every miss is a lost customer, and you cannot tell which is which without answering. The number that settles it is already in the handset behind your till: scroll the missed list back a fortnight and see how many of those numbers ever tried you again.",
  },

  valuePerCall: {
    value: "Around $8 for each call you get back",
    reasoning:
      "The lowest figure on this site, and correctly so: nineteen calls in twenty are worth nothing — hours, directions, a returns question, a rep — and the twentieth is someone driving in for a £145 pair of boots. Our workings are in pounds because the shop is, and the dollar figure above is the same sum done again for a shop with a till in dollars rather than that one put through an exchange rate. Disagree with whichever step you like: a phone caller's basket runs higher than a browser's because she is asking about one named thing, call it £45; about a third of recovered calls carry purchase intent; about four in ten of those buy; and most of the rest go to whoever answered first. That lands a shade under £7. Then the line other trades don't have — a quarter of a shop's calls are about money you have already taken, and a few of those become a refund demand or a chargeback when nobody picks up, which is where the last pound comes from. We are not going to multiply it by your call volume and print a year's total. Do that on the back of a delivery note, where you can also knock the reps off it.",
  },

  citations: [
    {
      claim: "Shop traffic peaks mid-afternoon, and the Saturday before Christmas is the heaviest day of the year.",
      publisher: "Sensormatic Solutions, holiday shopping traffic forecast",
      date: "2025",
      sample:
        "A forecast rather than a count, built on Sensormatic's own in-store traffic-counting network: daily store traffic peaking between 14:00 and 15:00, with Saturday 20 December projected as the busiest day in the UK and Ireland. We have the year, not the release date, so the year is what this says.",
      interest: "Sensormatic sells the traffic-counting and loss-prevention systems the forecast is built on.",
    },
  ],

  objection: {
    asks: "My customers ring to find out whether the thing is actually on the shelf. Your robot can't walk to the stockroom.",
    answer:
      "He is right, and the answer that dodges it deserves to lose him. It cannot walk to the stockroom, it never will, and it is not even allowed the fiction the stock file offers — it has no sight of your stock at all, only your documents and a phone number. What it does instead is refuse to be confident: it says what the boot is and what it costs, says plainly that it cannot see the shelf, and gets the size and the caller's number in front of someone who was already going out the back for four other reasons. She gets a text instead of a ring-out, and the shop gets a phone number for somebody who was about to spend £145. Then there is the larger half he is not counting. Opening hours, the car park, where's my order, can I bring this back, do you do vouchers: on our estimate about two-thirds of a shop's inbound needs nobody with legs, and it currently comes off the floor in four-minute chunks, because a ninety-second call in a shop is ninety seconds of talking and three minutes of walking. Clearing that is what buys back the time to take the one call that genuinely needs a human eye on a shelf. And the reps are free.",
  },
};
