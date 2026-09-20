import type { Trade } from "./schema";

/* ------------------------------------------------------------------ *
 * Insurance — independent agencies and brokers.
 *
 * What makes this trade unlike the other fifteen: everywhere else an
 * unanswered call is lost revenue. Here it is transferred liability.
 * "It's Hollis, I picked up a second van today, can you stick it on the
 * policy, cheers" sits in a voicemail box until Thursday. On Wednesday
 * the van hits a bus, and because he rang his broker and told them, the
 * agency is the one that may end up paying — "coverage not procured" is
 * around 30% of agency E&O claims, with no other cause above 10%.
 * Everything else on this page follows from that: a phone that has to
 * pick up at the worst hour of somebody's year, and then refuse the
 * first question they ask.
 *
 * The second thing that shapes this page is an absence. There is no
 * customer record anywhere in this product — no declarations page, no
 * policy file, no in-force flag, nothing that could be read back to a
 * caller. An earlier draft of this page had the agent saying "I can see
 * it's in force and who's named on it", which was an invention, on the
 * one page whose whole argument is that it does not invent. The copy
 * now says the opposite out loud, because on this trade the absence is
 * the selling point: a thing that holds no policy cannot half-read one.
 *
 * Vocabulary is checked against the trade. "Full coverage" is not a
 * policy and never was — customers say it constantly, and the agent
 * repeats it back as the customer's phrase rather than adopting it as
 * its own. Deductible is US, excess is UK, and swapping them ends the
 * conversation. An agent is not an adjuster and an agency is not a
 * carrier: the shop does not decide claims and does not pay them.
 * Lapse, cancellation, non-renewal and rescission are four different
 * things with four different consequences. Limits are spoken, not
 * written out — "a hundred three hundred a hundred". And a household is
 * not a policy: it is three policies and one relationship.
 * ------------------------------------------------------------------ */

export const insurance: Trade = {
  slug: "insurance",
  label: "Insurance",

  kicker: "It's 12:40. The desk is at lunch and the phone has never been busier.",
  standfirst:
    "It picks up at the hour you are thinnest, takes down the loss report, the change request and the certificate chase word for word — and refuses, every single time, to say whether anything is covered.",

  prongs: [
    {
      id: "change",
      label: "Wants something changed",
      does: "gets it in front of a licensed person",
      caller: "I picked up a second van this morning. Can you stick it on the policy before I drive it?",
      asks: "Takes the request down the way he says it, puts a time on it, tells him plainly that nothing is on cover until a licensed person adds it with the carrier — and pages that person while he is still on the line.",
      urgent: true,
    },
    {
      id: "review",
      label: "Moving the review",
      does: "moves the meeting, never the cover",
      caller: "Can we shift Thursday's review? I still haven't found that dec page you asked me for.",
      asks: "Finds the appointment under the number she is ringing from, offers what the producer's diary actually has free, and texts her the new time with the list of what to dig out.",
    },
    {
      id: "certificate",
      label: "Chasing a certificate",
      does: "queues the certificate a person must sign",
      caller: "They won't let me on site Monday without a certificate. The waiver thing's on my policy, right?",
      asks: "Takes the holder, the job, the wording he has been asked for and the date he needs it by, and puts the request in front of whoever signs certificates in your office. It does not tell him the waiver is on there, because it has no way of knowing and no licence to say.",
    },
  ],

  intents: [
    { chip: "am I covered if my mate drives it", reaches: "transfer_call", then: "A coverage question. It doesn't answer it, doesn't soften it, doesn't guess — it gets a licensed person." },
    { chip: "stick the second van on it", reaches: "notify_team", then: "Pages the producer while he's still talking, and says out loud that nothing is on cover yet." },
    { chip: "need a certificate by Monday", reaches: "take_message", then: "Takes the holder, the job and the deadline for whoever signs them. It won't say what's already on there." },
    { chip: "letter says it cancels Friday", reaches: "transfer_call", then: "Straight to a person while she's on the line. It never tells anyone their cover won't lapse." },
    { chip: "I've just hit someone", reaches: "search_knowledge", then: "Asks if anyone is hurt, then reads your carrier's 24-hour claims number off your own documents." },
    { chip: "water's coming through the ceiling", reaches: "take_message", then: "Logs the loss as she tells it. Whether it's worth claiming is advice, and advice it does not give." },
    { chip: "premium's up $400, nothing changed", reaches: "transfer_call", then: "A rate rise is a retention call, not a service call. It explains nothing and fetches a human." },
    { chip: "your customer hit my gate", reaches: "take_message", then: "Third-party claim. Details down, not one word about fault, routed to whoever handles claims." },
    { chip: "the paper for the DMV, the thing", reaches: "search_knowledge", then: "He can't name it, so it asks what it's for and looks up which document your office issues." },
    { chip: "my husband always dealt with this", reaches: "take_message", then: "Doesn't try to explain the renewal letter. Takes her number and puts a callback in front of a person." },
    { chip: "we've had a baby and we've moved", reaches: "check_availability", then: "Two things that change a policy. It offers the producer's free slots and writes both down unedited." },
    { chip: "can I just pay it over the phone", reaches: "transfer_call", then: "It does not take card details. Not ever, not on request — it gets someone who can take it properly." },
    { chip: "what would you do me for the van", reaches: "save_lead_details", then: "Takes the risk, the current carrier and the expiry date. The price comes from a licensed person." },
    { chip: "can I move Thursday's review", reaches: "find_booking", then: "Finds the appointment under the number she's ringing from before it touches the diary." },
    { chip: "I want to put in a complaint", reaches: "notify_team", then: "Logged as a complaint rather than smoothed over. The regulatory clock starts either way." },
    { chip: "is the lady I usually speak to in?", reaches: "transfer_call", then: "Straight through. It doesn't try to be useful first, and it doesn't ask what it's about." },
  ],

  duration: 78,

  turns: [
    { at: 0, side: "agent", text: "Whitmarsh Insurance — you're through to the answering assistant. I'm not a licensed agent, so I take the details and get them to one. What can I get down for you?" },
    { at: 7, side: "caller", text: "Hollis Barrow. I've picked up a second van this morning and I need it on the policy before I drive it off the lot." },
    { at: 14, side: "agent", text: "I'll get it down exactly as you say it. I can't put it on cover myself — only a licensed person can do that with the carrier. Do you have the VIN there?" },
    { at: 22, side: "caller", text: "Hang on, it's on the paperwork somewhere. One F T B W… 1FTBW2CM4NKA31107." },
    { at: 33, side: "agent", text: "1FTBW2CM4NKA31107. Same commercial auto policy as the other Transit, and who'll be driving it?" },
    { at: 41, side: "caller", text: "Same one. Me, and my son Emmett — he's twenty-three, he's on the other van already." },
    { at: 48, side: "agent", text: "Both down. Yolanda — she's the licensed producer on your account — will want the bill of sale and the lienholder too. I'll put that in a text so you're not hunting twice." },
    { at: 55, side: "caller", text: "So am I covered to drive it off the lot right now, or not?" },
    { at: 59, side: "agent", text: "I can't answer that one, and I'm not going to guess at it. This phone doesn't hold your policy — it holds nobody's. Yolanda can answer it, and her diary's clear from four. Paging her now, marked urgent." },
    { at: 70, side: "agent", text: "Your request is on the file, logged at 12:47, exactly as you put it. The text carries that time and Yolanda's name. The van isn't on cover until she tells you it is." },
  ],

  toolRuns: [
    { at: 44, tool: "save_lead_details", ms: 210 },
    { at: 46, tool: "search_knowledge", ms: 380 },
    { at: 57, tool: "check_availability", ms: 430 },
    { at: 61, tool: "notify_team", ms: 150 },
    { at: 63, tool: "take_message", ms: 260 },
    { at: 72, tool: "send_sms", ms: 520 },
  ],

  rig: {
    title: "File note",
    form: "policy",
    fields: [
      { id: "request", label: "Request, verbatim", value: "Second van onto the commercial auto policy, before he drives it", at: 7, from: "caller", onPhone: true },
      { id: "vin", label: "Vehicle — VIN read back", value: "1FTBW2CM4NKA31107 · Transit", at: 33, from: "caller", onPhone: true },
      { id: "drivers", label: "Drivers named", value: "Hollis Barrow · Emmett Barrow, 23", at: 44, from: "save_lead_details", onPhone: false },
      { id: "producer", label: "Licensed producer", value: "Yolanda Reyes — diary clear from 16:00", at: 57, from: "check_availability", onPhone: false },
      { id: "paged", label: "Alerted", value: "Yolanda — while he was still on the line", at: 61, from: "notify_team", onPhone: true },
      { id: "logged", label: "On the file", value: "12:47 · urgent · nothing on cover yet", at: 63, from: "take_message", onPhone: true },
      { id: "texted", label: "Sent to Hollis", value: "Logged 12:47 · not on cover yet · bill of sale, lienholder", at: 72, from: "send_sms", onPhone: false },
    ],
    receipt: "A timestamped request on the file, in his own words, and Yolanda reading it before he had hung up. Nothing is on cover until she says so — and Hollis has that in a text with the time on it.",
  },

  wall: {
    never: "tell a caller what their policy covers",
    clause:
      "Never state, imply or estimate whether anything is covered — not yes, not no, and not the soft forms: 'that should be fine', 'that's normally included', 'I'd have thought so'. Coverage is determined against the policy form by a licensed person. Say you cannot answer it, and route to one.",
    clauseSource:
      "the system prompt, enforced on our servers before a word is spoken — not a toggle in your dashboard and not something a caller can argue it out of",
    detents: [
      {
        caller: "Quick one — am I covered for a rental while it's in the shop?",
        agent: "That's a coverage question and I'm not licensed to answer it. Yolanda is, and she's your producer — let me get her.",
      },
      {
        caller: "It's a yes or no. You've got my policy up in front of you, haven't you?",
        agent: "I haven't, and I never do — no policy of yours is on this phone at all. What I have is a blank note with your name on it and a line straight to Yolanda.",
      },
      {
        caller: "I'm stood at the counter and they want an answer now. Just read me what it says.",
      },
      {
        caller: "The girl who sold me this said I had it. Are you telling me she lied?",
        agent: "I'm telling you I'm not licensed to interpret your policy, and a guess from me would be worse than useless to you. Yolanda can have your file open in ninety seconds — putting you through now.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "Rental reimbursement is on nearly every commercial auto we write, so you'd be cove",
      instead:
        "— I can't tell you what your policy covers, and there is no policy here for me to read. What I can do while you're stood there: your question goes on the file the way you asked it, with the time against it, and Yolanda gets paged, not messaged. The sentence I started was a guess about somebody else's policy with your money behind it.",
    },
    crosses:
      "A caller who asks a coverage question twice is put through to a licensed person. Twice is the rule, so it never has to weigh up whether the second ask was serious.",
  },

  relay: {
    because:
      "Some calls stop being service calls the moment they open: anyone hurt on a loss report, a fire or a total loss, a solicitor's letter or a subpoena, a caller who is distressed or can't follow the conversation, and anything that sounds like a complaint — because a complaint soothed and not logged is a breach, not a save.",
    who: "the licensed producer on the account, or whoever you marked for escalation",
    by: ["notify_team", "take_message"],
    carries: [
      "who is calling, the number they rang from, and the policy number if they gave one",
      "what happened, untidied and unsummarised — a loss report can be read back in a coverage or fraud investigation",
      "the time it was logged, and that no coverage, price or bind question was answered",
    ],
    seconds: 6,
  },

  rules: [
    {
      label: "Any coverage question goes to a licensed person on the first ask",
      changes: "It stops asking clarifying questions and hands over the moment the word 'covered' appears, rather than waiting for the second ask.",
      on: true,
    },
    {
      label: "Out of hours, take the loss report as well as giving the claims line",
      changes: "At 2am it reads out the carrier's 24-hour claims number and then takes the loss down itself, so your file has it before Monday instead of nobody's.",
      on: true,
    },
    {
      label: "In renewal season, book straight into my diary",
      changes: "During a batch it stops taking callback messages and offers the review slots your calendar actually has, so the queue doesn't quietly become a callback list.",
      on: false,
    },
  ],

  ink: { ember: false, settled: false },

  faq: [
    {
      q: "Can it add a vehicle or a driver? That's half my phone.",
      a: "It can take the request; it cannot make the change. It writes down what was asked for verbatim, puts a time against it, tells the caller out loud that nothing is on cover until a licensed person puts it on with the carrier, and pages that person while the caller is still on the line. It never binds, never backdates, and never lets someone hang up believing their cover changed. What you end up with is the thing your E&O carrier wishes you had: a transcript with a time on it.",
    },
    {
      q: "What does it actually say to “am I covered?”",
      a: "The same sentence every time: it is not able to answer that, and it is getting someone who can. Not yes, not no, and specifically not “that should be fine” or “that's normally included”, which are the answers that cause the trouble. Worth being exact about why it is safe, though, because it is not willpower: there is no customer record in this product. No declarations page, no policy file, no in-force flag, nothing keyed to the caller's number. It could not read your policy out if a caller begged it to, which rules out the failure everyone actually fears — a machine half-reading a dec page and getting it confidently wrong.",
    },
    {
      q: "Does it quote?",
      a: "No, and there is no version of this where it does. Quoting a premium is unlicensed activity in plain terms in most US states, and a machine cannot hold a producer licence. It is scoped to what an unlicensed employee may already do in your office: take the risk details, take the current carrier and expiry date, and put a quote appointment in the producer's diary.",
    },
    {
      q: "What about a first notice of loss at two in the morning?",
      a: "It reads your carrier's 24-hour claims number off your own documents, and then takes the loss report itself — date, time, place, the other vehicle and its insurer, the report number — untidied and unsummarised, because that record may be read in a coverage or fraud investigation later. Anyone hurt, a fire, a total loss: that stops being a phone call and pages a person.",
    },
    {
      q: "These calls carry licence numbers, dates of birth, sometimes injuries. Where does that sit?",
      a: "On your own infrastructure, in the call record attached to the customer, and nowhere else. It is worth being blunt about the comparison: the thing it replaces is a voicemail box nobody transcribed, on a handset in a shared office, holding the same data with none of the record. Recording consent is a setting, because two-party-consent states and UK PECR are not the same rule, and the greeting changes when you turn it on.",
    },
  ],

  jargon: [
    "dec page",
    "binder",
    "endorsement",
    "FNOL",
    "loss run",
    "ACORD 25",
    "additional insured",
    "waiver of subrogation",
    "in force",
    "producer",
  ],

  missRate: {
    value: "About one call in five goes unanswered in office hours",
    reasoning:
      "Our estimate, and worth saying why it is only that: no broker association publishes a missed-call rate for this trade, and the figures circulating online — 39%, 22%, 47% — trace back to answering-service vendors' own blogs citing nothing, so we are not printing them. Ours comes from the shape of the day. The peak hour is the lunch hour, because policyholders ring their broker on the only free hour they have; the person who can lawfully answer is on hold with an underwriter or fifteen minutes into a carrier portal that does not survive an interruption; and one first notice of loss occupies the only trained person for twenty minutes while everyone behind it gets voicemail. Renewal batches and the week after a hailstorm push it past 40%. Out of hours is a separate and much larger claim — evenings and weekends are exactly when people buy cars and crash them. Two weeks of call detail off your phone bill settles it in either direction, and we would rather you checked than took one in five on our word.",
  },

  valuePerCall: {
    value: "About $40 for each call you get back",
    reasoning:
      "Our arithmetic, deliberately pessimistic, and built so you can take it apart line by line. Roughly one recovered call in seven is somebody asking for a price. Put a $2,200 auto policy behind that — the lowest of the three 2026 averages cited below — and assume the agency keeps about an eighth of it in year one and a tenth on each renewal, over a four-year life. We are attributing those two percentages to nobody: a commission schedule is a private contract between an agency and its carriers and none of them publish it, so if yours is fifteen and twelve then the number moves and you should move it. One inbound price-shopper in five actually buys. That is most of the $40. Another one in ten is a household halfway out the door over a rate rise: count a household as the car plus the house, so roughly double that renewal commission for every year it stays, allow two saved years, assume the conversation works a third of the time — and then halve the whole path anyway, because by then it is three guesses stacked on one another. The remaining three-quarters — certificates, ID cards, payments, questions — we count at zero, which is plainly wrong, and it is the direction we would rather be wrong in. The real money is inside that zero: “coverage not procured” is about 30% of agency E&O claims, and the fact pattern is almost always a message. Do not multiply any of this by your call volume. A total we print for you is a number nobody checked.",
  },

  citations: [
    {
      claim: "The largest single cause of agency E&O claims is cover that was asked for and never put on.",
      publisher: "Swiss Re Corporate Solutions claims data, reported in IA Magazine",
      date: "2021-03",
      sample:
        "Agency errors-and-omissions claims handled by Swiss Re Corporate Solutions: “coverage not procured” is roughly 30% of all of them, with no other cause above 10%.",
      interest: "Swiss Re underwrites the agency E&O policies these claims were made against, so it is describing its own book.",
    },
    {
      claim: "A US full-coverage auto policy runs somewhere between $2,200 and $2,900 a year, depending on whose average you read.",
      publisher: "Insurify, read against ValuePenguin and Experian",
      date: "2026",
      sample:
        "Three national annual averages for full coverage published in 2026: Insurify $2,241, ValuePenguin about $2,496, Experian $2,922. They disagree by $681 because they are not counting the same population — marketplace quotes are not policies in force. We used the lowest of the three.",
      interest: "All three publish the figure beside a comparison tool they are paid on, and a higher average makes shopping around look more worthwhile.",
    },
  ],

  objection: {
    asks: "If that thing tells someone they're covered when they're not, it's my licence and my E&O on the line — not yours. And half my book is seventy and wants Debbie.",
    answer:
      "Correct objection, and an owner in this trade who didn't raise it would be the one to worry about. On liability: it never says covered. Not softly, not “probably”, not “that should be fine”. It is scoped to exactly what an unlicensed hire on your front desk may already do — answer, identify, take the details, take the loss report, book with the licensed person, and say plainly that it can't answer that and is getting Yolanda. Coverage, price and bind are hard stops in the system prompt that route to a human, not judgement calls it makes on the fly. It also has nothing to leak: no policy record reaches this phone, so the worst it can do with a coverage question is refuse it. And it writes a timestamped transcript to the file. Your worst documentation exposure today is a voicemail nobody transcribed and nobody returned, which is the exact fact pattern behind the largest category of agency E&O claims; this makes that record better, not worse. On Debbie: it isn't replacing her, it's what picks up while she's on hold with the carrier, keyed into a portal, or at lunch during your busiest hour of the day. Anyone who asks for her by name is put through without being asked what it's about. When she's out, the caller hears when her diary is next free, and her name is on a note she reads that afternoon — which is more than a voicemail box has ever managed.",
  },
};
