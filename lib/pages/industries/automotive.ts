import type { Trade } from "./schema";

/* ------------------------------------------------------------------ *
 * Auto sales & service — independent garages, MOT stations, and the
 * small dealership running sales, service and parts through one number.
 *
 * What makes this trade's phone unlike the other fifteen: everywhere
 * else the caller is asking for a visit. Here you are already holding
 * their car and they are standing somewhere without one, so the largest
 * single category of inbound call is not new business at all — it is
 * people chasing the thing they already handed over. No plumber takes
 * your kitchen away for three days. Note what that costs us: a car
 * already on a ramp is a booking that has happened, and the appointment
 * tool only reads ones that have not. So the second prong here is a
 * handover, not a lookup — the reg and the question, in front of the
 * person holding the keys, in seconds. Anything else would be the page
 * inventing a job-sheet feed. The line has to run outward too:
 * before a technician may touch anything beyond what was agreed,
 * somebody has to ring the customer and get the extra spend authorised,
 * and on a single line that outbound call is an inbound call missed,
 * with a lifted car and a technician standing still at whatever the
 * board outside says the labour rate is. Underneath all of it sits a
 * date the customer does not control: a DVSA-recorded MOT expiry, one
 * legal day, bookable one month minus a day beforehand if they want to
 * keep the anniversary. The panic here is calendar-shaped rather than
 * crisis-shaped — "it runs out Thursday" — which is why this page
 * carries no ember ink and does not need any.
 *
 * Vocabulary, checked against the trade rather than a thesaurus. An MOT
 * is a statutory roadworthiness test, not a service; customers conflate
 * the two constantly, and "MOT'd and serviced" is two jobs, not one.
 * Since 2018 a test returns advisories and minor, major or dangerous
 * defects, not a tidy pass/fail, and only the nominated tester records
 * the result. A car goes on a ramp, in a bay — a lift is American and so
 * is the service lane. Cars are class 4; vans over three tonne are
 * class 7. A courtesy car is not a rental and not a loaner. The parts
 * supplier is a motor factor. Part-ex, not trade-in; forecourt, not lot;
 * reg, not plate; technicians, not mechanics, and a franchised dealer
 * will correct you. And never write "quote" where the trade means
 * "estimate": a quote binds once accepted and an estimate does not,
 * which is the whole difference between a page written by somebody who
 * has stood at one of these counters and a page that has not.
 * ------------------------------------------------------------------ */

export const automotive: Trade = {
  slug: "automotive",
  label: "Auto sales & service",

  kicker: "Three cars are being written up at the counter and the phone is going.",
  standfirst:
    "It picks up while the counter is full, takes the reg before it takes anything else, and puts the car on a ramp on a day you can actually do it — without naming a fault, naming a price, or telling anybody their car is safe to drive.",

  prongs: [
    {
      id: "expiry",
      label: "MOT that's expiring",
      does: "finds the last slot before it expires",
      caller: "My MOT runs out Thursday. Have you got anything before then? Anything at all.",
      asks: "Takes the reg and reads it back, then searches for the last slot before her expiry date rather than the next one free — and texts her the time and what to bring with her.",
      urgent: true,
    },
    {
      id: "holding",
      label: "A car you're holding",
      does: "gets the reg to whoever has her keys",
      caller: "Is my car ready yet? Nobody's rung me and I've got to get the kids at three.",
      asks: "Takes the registration, reads it back, and puts her actual question — is it ready, can she have it by three — in front of whoever is holding the keys while she is still on the line, or hands her straight over if an advisor can pick up. It has no sight of your ramp and never says ready.",
    },
    {
      id: "forecourt",
      label: "A car on the forecourt",
      does: "puts her name in the test-drive diary",
      caller: "That silver Golf you've got on Auto Trader — still there? Can I drive it today?",
      asks: "Takes the stock number and what she's part-exing and books her in to drive it. It will not tell her the car is still there, and it will not take a deposit to hold one.",
    },
  ],

  intents: [
    { chip: "MOT runs out Thursday", reaches: "check_availability", then: "Searches for the last slot before her expiry date, not the next one free. Those are different questions." },
    { chip: "is my car ready yet", reaches: "notify_team", then: "Reg and question, live, to whoever has her keys. It cannot see your ramp, so it never answers this itself." },
    { chip: "you've had it since Monday", reaches: "transfer_call", then: "A complaint about a car you're still holding never gets handled by a machine. Straight to a person." },
    { chip: "orange light, the engine one", reaches: "save_lead_details", then: "Writes down which light and whether it's steady or flashing. It does not tell her if she can drive it." },
    { chip: "it's making a noise, sort of", reaches: "check_availability", then: "Stops asking her to describe it better and offers the diagnostic hour. That is what the hour is for." },
    { chip: "I'll take a cancellation", reaches: "add_to_waitlist", then: "Nothing free before Thursday, so she goes on the list — told plainly that it's a list, not a slot." },
    { chip: "won't start, just goes click", reaches: "search_knowledge", then: "Reads your own note back — you don't recover, here's who does — and never offers to come out to her." },
    { chip: "how much for a full service", reaches: "search_knowledge", then: "Reads the menu price off your price list, then asks for the reg before it says anything else." },
    { chip: "it's a 3.5-tonne Sprinter", reaches: "search_knowledge", then: "Reads your own page: Class 4 only, no Class 7. She hears that now, not when the van's on your forecourt." },
    { chip: "silver Golf on Auto Trader", reaches: "save_lead_details", then: "Takes the stock number and what she's part-exing. It will not tell her the car is still there." },
    { chip: "wing mirror, 18-plate Astra", reaches: "take_message", then: "That needs a VIN-level lookup nobody does mid-call. Reg and part down, parts desk rings her back." },
    { chip: "do I get a car if I leave it", reaches: "search_knowledge", then: "Reads your courtesy car terms back — age limit, daily charge, licence. It promises nobody a car." },
    { chip: "letter about a recall", reaches: "take_message", then: "Takes the reg off the letter and says nothing else. Recalls are answered by VIN, by the warranty desk." },
    { chip: "can I drop it Friday instead", reaches: "find_booking", then: "It only sees what was booked on the number she's ringing from. Finds Thursday there, then moves it." },
    { chip: "need to cancel, it's sold", reaches: "cancel_appointment", then: "Pulls the booking up first — it can only cancel one it has found — then takes it off Wednesday's sheet." },
    { chip: "I'm on the hard shoulder, M6", reaches: "notify_team", then: "Behind the barrier, 999 or recovery, and she's off the line in twenty seconds — and you're told her car's coming in." },
  ],

  duration: 84,

  turns: [
    { at: 0, side: "agent", text: "Calder Street Garage — you're through to the answering assistant. What's the car, and what's it wanted for?" },
    { at: 6, side: "caller", text: "My MOT runs out Thursday. Have you got anything before then? Anything at all." },
    { at: 12, side: "agent", text: "Let me take the reg, and I'll look at what's left before Thursday." },
    { at: 17, side: "caller", text: "Y-N-one-nine, K-H-F. It's a Qashqai. Can you service it while it's in? It's on sixty-two thousand." },
    { at: 28, side: "agent", text: "YN19 KHF — Yankee November one nine, Kilo Hotel Foxtrot. That's two jobs, then: the test and a full service. One moment." },
    { at: 38, side: "agent", text: "Wednesday. It goes on at half eight, so drop it any time from eight, and it's with us the day — that's the last one I've got before your Thursday." },
    { at: 46, side: "caller", text: "Do I get a car? I can't be without one, I've got work." },
    { at: 52, side: "agent", text: "There are two courtesy cars — fifteen pounds a day, over twenty-fives, licence with you on the day. I can't promise one's free; Mirek on the service counter confirms that when he opens." },
    { at: 63, side: "caller", text: "Go on then, book it. The tyres are near the line — will it fail?" },
    { at: 70, side: "agent", text: "I can't call that. Only the tester can, with the car in front of him. You're on at half eight Wednesday, drop from eight — I've texted you that and a note to bring the locking wheel nut key, and Mirek's got a message about the car." },
  ],

  toolRuns: [
    { at: 12, tool: "get_call_context", ms: 70 },
    { at: 30, tool: "check_availability", ms: 460 },
    { at: 49, tool: "search_knowledge", ms: 380 },
    { at: 67, tool: "book_appointment", ms: 730 },
    { at: 68, tool: "save_lead_details", ms: 200 },
    { at: 69, tool: "send_sms", ms: 540 },
    { at: 71, tool: "take_message", ms: 230 },
  ],

  rig: {
    title: "Booking-in sheet",
    form: "bay",
    fields: [
      { id: "expiry", label: "MOT runs out", value: "Thursday · her word for it, not a lookup", at: 8, from: "caller", onPhone: true },
      { id: "reg", label: "Reg", value: "YN19 KHF · Nissan Qashqai", at: 19, from: "caller", onPhone: true },
      { id: "work", label: "Booked in for", value: "Test and a full service · 62,000 on the clock", at: 27, from: "caller", onPhone: false },
      { id: "left", label: "What's left", value: "Wed 08:30 — the last start before Thursday", at: 38, from: "check_availability", onPhone: true },
      { id: "courtesy", label: "Courtesy car", value: "£15/day · over 25s · licence on the day · not held", at: 52, from: "search_knowledge", onPhone: false },
      { id: "ramp", label: "On the ramp", value: "Wed 08:30 · test first, then the service", at: 68, from: "book_appointment", onPhone: true },
      { id: "texted", label: "Texted her", value: "Drop 08:00–08:30 Wed · locking wheel nut key", at: 71, from: "send_sms", onPhone: false },
    ],
    receipt: "Tested Wednesday, before her Thursday. The drop window and the wheel nut key are on her phone in writing, and Mirek has a note to sort a courtesy car before she gets there.",
  },

  wall: {
    never: "tell you whether your car is safe to drive",
    clause:
      "Never state or imply that a vehicle is safe or unsafe to drive, and never name a likely fault. Record the symptom in the caller's own words with the registration, offer the earliest inspection, and if the caller is in any doubt tell them not to drive it and to call their breakdown provider.",
    clauseSource:
      "the system prompt that ships with every automotive agent, enforced on our servers — the caller can't argue it out of it, and neither can you",
    detents: [
      {
        caller: "It's only an orange light. Is it all right to drive it to work and back?",
        agent: "I can't tell you that — nobody can, without the car in front of them. I've got half eight tomorrow. If you've any doubt tonight, don't drive it.",
      },
      {
        caller: "It's two miles. I'm not asking you to guarantee it, I just want to know if it'll be all right.",
        agent: "I understand, and I still can't answer it. What I can do is write down exactly what the light's doing and get you the first slot there is.",
      },
      {
        caller: "You're a garage. I'm ringing a garage to ask whether my car is drivable. Just say yes or no.",
      },
      {
        caller: "Right. I'll drive it, and if it goes bang on the ring road that's on you.",
        agent: "I'd still rather you didn't. I'm putting you through to Mirek now — he can talk to you about the car, I can't.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "Steady amber and no misfire, on a car that age, is nearly always a sensor rather than anything that'll leave you at the sid",
      instead:
        "— and there it is: I've named a part and I've told you it's drivable, and I'm allowed to do neither. Only the technician with it in front of him can. What the light's doing is written down against your reg, half eight tomorrow is yours, and if you're in any doubt tonight, leave it where it is.",
    },
    crosses:
      "One line goes straight over the wall: “let me get you Mirek.” It doesn't win the argument first and it doesn't make her prove the car is bad enough to deserve a person. And if Mirek is out on a road test the transfer simply fails — at which point the reg, the light and her own sentence about it are sitting on the counter before he's parked up. The worst case is a technician ringing her back. It is never a machine talking her into a verdict.",
  },

  relay: {
    because:
      "Two calls stop being bookings, and both are about a car you have already touched. A customer who has been ringing since Monday about one you're still holding — nobody is calming that down with a booking slot. And someone rejecting a car they bought off you last week, which is a statutory right with a thirty-day clock attached, running from the moment the words are said. Neither of those is a message. They are a person, now, and if nobody picks up they are a written record with a timestamp on it.",
    who: "whoever you marked for transfers — the owner, the service manager, or the sales floor",
    by: ["transfer_call", "take_message"],
    carries: [
      "the registration, so whoever picks up knows which car before they say hello",
      "which of the two it is — a job going quiet, or a rejection with a clock on it",
      "what she said, word for word, and the minute the call landed",
    ],
    seconds: 11,
  },

  rules: [
    {
      label: "No slot until I've got the reg",
      changes: "It won't offer a time before the registration has been read back to it, because the price, the parts and the hours all hang off the car.",
      on: true,
    },
    {
      label: "Recall letters go to the warranty desk",
      changes: "It takes the reg or the VIN off the letter, offers no opinion on whether it applies, and leaves the message for whoever reads the manufacturer's system.",
      on: true,
    },
    {
      label: "Nothing in the last test slot of the day",
      changes: "It stops offering the four o'clock MOT, because a fail at half four is a car nobody can legally drive home.",
      on: false,
    },
  ],

  ink: { ember: false, settled: true },

  faq: [
    {
      q: "Someone rings up and asks what's wrong with it and what it'll cost. What does it actually say?",
      a: "No to either, and neither is a switch you can turn on. On a fault call it does one thing: writes the symptom down the way she said it — “clunking when I turn, worse when it's cold” — with the reg and the mileage attached, and says a technician will ring. On price it reads what you've published: the MOT fee, the menu service, the diagnostic hour. Everything else is an estimate that comes from a person after the car has been looked at, and it says so in those words. Estimate and quote have different legal weight in this trade, and it never says the second one.",
    },
    {
      q: "Can it tell me whether a car will pass its MOT?",
      a: "No, and it won't be pushed into it. A result is recorded on DVSA's testing service by the nominated tester who conducted the test; nobody on a phone can state one, predict one, or hint at one. What it does do is the bit customers actually ring about — book inside the month-minus-a-day window so they keep their anniversary date, and tell them plainly when the last slot before their expiry has gone.",
    },
    {
      q: "Most of our calls are people chasing a car we've already got. Does that help?",
      a: "It helps, and it is worth being exact about how, because the obvious answer would be a lie. Nothing in this product can see your ramp, your job sheet or your technician, and the appointment side of it only reads bookings that have not happened yet — the moment her car is actually in your hands it is invisible to the machine. So it does not answer her. It takes the registration, reads it back, takes the question underneath the question — is it ready, can I have it by three, has the part landed — and puts both in front of whoever has her keys while she is still on the line, or transfers her if an advisor can take it. What you get back is the three or four minutes an advisor burns walking to a screen with somebody waiting at the counter, several times a day, and a customer who has been spoken to rather than left ringing out.",
    },
    {
      q: "Can it ring the customer for authorisation when the bill goes up?",
      a: "No. It answers calls; it doesn't make them, and it shouldn't make this one. The authorisation call is the conversation that decides what somebody is billed — under the Motor Ombudsman's Service and Repair Code it's an obligation before extra work starts, and in California it's written law. What it can do is stop that call competing with the switchboard: while you're chasing one customer at work for three attempts, the line isn't engaged for everyone else.",
    },
    {
      q: "It's one number for sales and service. Sunday callers get the sales floor and it's useless to them.",
      a: "It asks which they want before it does anything else, and the answer changes the tools it's allowed to touch. A Sunday caller with a service question gets a real slot in next week's diary instead of a sales floor that can't book them; a caller about a car on the forecourt gets booked in to drive it and told nothing is held. The two halves of the business stop sharing one answerphone message.",
    },
  ],

  jargon: [
    "reg",
    "on the ramp",
    "Class 4",
    "advisory",
    "diag",
    "EML",
    "courtesy car",
    "locking wheel nut key",
    "motor factor",
    "part-ex",
  ],

  missRate: {
    value: "Roughly a quarter of calls ring out while the shop is open",
    reasoning:
      "Ours, and it comes off the clock rather than out of a survey. The biggest hour on the phone and the biggest hour on the counter are the same hour: between eight and ten the drop-off rush is being written up face to face — keys, mileage, “can you also look at the noise” — on the same line the commuters are ringing down. One person on a counter has no overflow. Add the twenty minutes somebody is out road-testing a car to chase an intermittent knock, and the twenty-odd on hold to a manufacturer's technical line, and a quarter of staffed-hours calls is not a dramatic number. We have not printed a seven-day figure: the evenings, the Sunday and the Saturday half-day would roughly double it, and at that point we would be selling you arithmetic rather than a phone. The only automotive answer rate we will put a source against is in the citations below, and read what it measures — American dealerships with switchboards, not four bays and the owner on his back under a car.",
  },

  valuePerCall: {
    value: "Around $55 of work behind each service call you get back",
    reasoning:
      "Ours, and deliberately pessimistic. About four calls in ten are genuine new work — the rest are status chases, parts questions, price shoppers who were never booking, a motor factor and a rep. Of those four we assume 45% book, not the 60% the dealer trainers quote. That is 0.18 jobs a call; against a $400 average repair order at a US independent it is $72, and we take a further quarter off for the people who would have rung back anyway. The same sum on this side of the water runs off the one benchmark we can actually cite — £300 average invoice at UK independents to December 2024 — and lands near £40. We hold those two apart rather than converting one into the other, and if your average repair order is not $400, redo it with yours; the shape survives, the number changes. A recovered sales call is a different animal altogether, worth roughly three of these, and we don't blend the two into one average. Two things the figure leaves out on purpose: a status call the phone handles gives an advisor three or four minutes back, and an MOT that looks like fifty quid of work is the front door to a relationship that runs a year at a time — the garage that answers on Tuesday afternoon takes that customer off the one that didn't. We are not going to print a year's worth of this. A workshop's call mix moves with the MOT calendar and an annual figure hides that. We don't know your volume, and a garage owner who has been shown a number like that before can smell it coming.",
  },

  citations: [
    {
      claim: "About one call in six to a dealership went to voicemail.",
      publisher: "Marchex, mobile call analysis",
      date: "2014-09",
      sample:
        "1,000 randomly sampled mobile consumer calls to US car dealerships; 16% reached voicemail. Read it for what it is: a decade old, American, and measuring dealerships with a switchboard rather than a four-bay independent with one person on the counter.",
      interest: "Marchex sells call tracking and conversation analytics to dealerships.",
    },
    {
      claim: "The average invoice at a UK independent garage was £300.",
      publisher: "Garage Hive, workshop benchmark",
      date: "2025-01",
      sample:
        "Over a million transactions across 175+ UK workshops, to December 2024. The average already includes cheap MOT-only invoices, which is what makes it safe to build on.",
      interest: "Garage Hive sells garage management software.",
    },
  ],

  objection: {
    asks: "They'll ask it something technical and it'll make something up. Then I've got a bloke on my forecourt saying your phone told him two hundred quid — and I'm the one having that argument, not you.",
    answer:
      "That is the right risk to name, and it's sharper here than almost anywhere: a careless sentence on this phone doesn't just lose a customer, it becomes a price you're held to or a diagnosis the customer has already accepted before the car arrives. So it states published prices and nothing else — the MOT fee, the menu service, the diagnostic hour — and on a fault call it writes the symptom down the way she said it, with the reg and the mileage on it, then stops. It won't say what's wrong, it won't say what it'll cost, and it won't say the car is safe to drive. But the honest half of the answer is that the calls worth catching mostly aren't technical. MOT runs out Thursday. Is the silver Golf still there. Can I move Thursday to Friday. Is it ready — which it answers by getting your reg and her question to the counter in seconds, not by pretending it can see the ramp. None of those need a technician, and every one of them is going to voicemail at twenty past eight on a Monday while you're taking a locking wheel nut key off somebody in the car park.",
  },
};
