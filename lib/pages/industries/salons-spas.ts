import type { Trade } from "./schema";

/* ------------------------------------------------------------------ *
 * Salons & spas — hair, beauty, nails and treatment rooms.
 *
 * What makes this trade unlike the other fifteen: everywhere else, one
 * call books one visit. Here, roughly half the colour calls are two
 * bookings — the colour she rang for, and an allergy alert test she does
 * not know exists, does not want, and will argue about, at least 48
 * hours earlier, in the salon, signed and kept. So the real work of a
 * ninety-second call is persuading a stranger to make a separate journey
 * for five minutes that produce nothing she can see. Every other page on
 * this site is about answering the call. This one is about what a good
 * call makes the caller do next.
 *
 * And the reason the phone is not answered is chemical rather than
 * organisational. Colour develops on a clock that cannot pause: bleach
 * left on five minutes longer because someone took a booking is not a
 * delay, it is damage. Gloves covered in tint cannot touch a handset and
 * then touch the next scalp. Two dryers put the room at the noise floor
 * of a busy pub. A therapist mid-wax is behind a closed door with an
 * undressed client and a timer. Saturday has no gaps in it at all, by
 * design, because Saturday is the week's money.
 *
 * Vocabulary is checked against the trade, not a thesaurus. UK salons
 * colour hair; they do not dye it — dye is what you buy in Boots. It is
 * a blow-dry, never a blowout; an infill, never a fill; a therapist in
 * the treatment room, never a technician and never an esthetician. The
 * patch test and the strand test are two different things and outsiders
 * always conflate them — which is why the word is not used anywhere on
 * this page: the allergy alert test is 48 hours before and tests the
 * person, the strand test is on the day and tests the hair. Brazilian
 * leaves a strip, Hollywood does not, and booking one for the other is
 * the kind of mistake nobody forgets. A stylist's day is her column —
 * not her calendar, not her schedule. And a chair renter is a separate
 * business under the same roof: the salon cannot book her, price her, or
 * speak for her.
 *
 * One capability line the copy holds to, because getting it wrong would
 * be the most expensive lie on the page: the agent reads one diary, the
 * one you connected. It cannot see whose column is whose and it never
 * says who is working. It takes the name the caller asks for, writes it
 * on the booking, and leaves the columns to the person who opens the
 * book in the morning.
 * ------------------------------------------------------------------ */

export const salonsSpas: Trade = {
  slug: "salons-spas",
  label: "Salons & spas",

  kicker: "Gloves on, tint on, timer running — and the phone is across the room.",
  standfirst:
    "It answers at ten to seven and at half eleven on a Saturday, books the service the caller actually names at the length your own list gives it, and books the test before it books the colour.",

  prongs: [
    {
      id: "colour",
      label: "First colour with you",
      does: "books the test before the colour",
      caller: "I want to go blonde. I've got box dye on it from about six months ago.",
      asks: "Doesn't decide what that is. It puts her in for a consultation with a colourist and the five-minute allergy alert test, and writes “box dye, six months ago” down as she said it for whoever opens the card.",
    },
    {
      id: "late",
      label: "Twenty minutes out",
      does: "tells the floor before the tint goes on",
      caller: "Sorry — I'm stuck on the M6, twenty minutes late for my colour with Kelly. Can she still do me?",
      asks: "Finds her booking under the number she is ringing from and alerts the floor while there is still a decision in it — then says plainly that Kelly decides, not the phone. Twenty minutes late on a colour isn't her appointment that moves, it's the two behind her.",
      urgent: true,
    },
    {
      id: "unsayable",
      label: "She won't say the word",
      does: "books it without making her say it",
      caller: "I need a wax. The... you know. The full one. Not just a tidy-up.",
      asks: "Reads back the two names you actually use — Brazilian and Hollywood — and lets her pick one instead of describing it. Books the one she picks at its own length, and the text afterwards carries the time and the salon and not the treatment.",
    },
  ],

  intents: [
    { chip: "is Kelly in? it's Sandra", reaches: "check_availability", then: "Offers what's free and writes the stylist she asked for onto the booking. It doesn't say who's in." },
    { chip: "you're the fourth place I've rung", reaches: "search_knowledge", then: "Reads the from-price off your own list and books the free consultation. She is not given a total." },
    { chip: "stuck in traffic, twenty minutes", reaches: "find_booking", then: "Finds her booking under the number she rang from, then alerts the floor while there's still a choice in it." },
    { chip: "prom Saturday, anything at all", reaches: "add_to_waitlist", then: "Saturday's gone. She goes on the cancellation list with what she needs, not a vague “I'll see”." },
    { chip: "my colour's gone green", reaches: "transfer_call", then: "Straight to the owner. It does not diagnose it, apologise for it, or offer a redo." },
    { chip: "do I have to do that test again", reaches: "search_knowledge", then: "Reads your test rule back as written. It can't waive it and it doesn't try to." },
    { chip: "there's box dye on it", reaches: "save_lead_details", then: "Writes “box dye, six months” down word for word, and books a consultation rather than a full head." },
    { chip: "move Thursday to the week after", reaches: "find_booking", then: "Finds it under the number she's ringing from before it moves anything." },
    { chip: "can I pay for a voucher by phone", reaches: "take_message", then: "It can't take a card — there's no payment on this phone. Name, number, amount, and the desk rings back." },
    { chip: "will I get charged if I cancel", reaches: "find_booking", then: "Finds it under her number first, then reads your policy back word for word. It never waives a charge." },
    { chip: "the gel that builds them up, BIAB?", reaches: "search_knowledge", then: "Pulls BIAB off your service list with its real length, so it isn't booked into a shellac's forty minutes." },
    { chip: "pregnant — can I have highlights", reaches: "transfer_call", then: "Nobody's safety question gets answered by a phone. It hands over and says nothing reassuring first." },
    { chip: "eight of us, wedding in June", reaches: "take_message", then: "Bridal isn't booked by a machine. Date, party size, number — and you ring her back." },
    { chip: "I want Leah, she rents the chair", reaches: "take_message", then: "Leah is a separate business under your roof. It takes her number; it does not touch Leah's column." },
    { chip: "think I left my sunglasses", reaches: "take_message", then: "Not a booking, still a call. It's saved and flagged to the desk, instead of eight rings and nothing." },
    { chip: "how much for a cut", reaches: "search_knowledge", then: "Asks which level first. A cut with an art director isn't a cut with a stylist, and the price says so." },
  ],

  duration: 78,

  turns: [
    { at: 0, side: "agent", text: "Colour Rooms, Bishopston — you're through to the salon's booking assistant. What can I get you in for?" },
    { at: 7, side: "caller", text: "It's Sandra Pryce. I need my roots doing before I go away Friday. Is Kelly about?" },
    { at: 14, side: "agent", text: "Roots, and you'd like Kelly. I'll put her name on the booking — who's on the floor is the desk's to square, not mine. Let me see what's free." },
    { at: 24, side: "agent", text: "There's Thursday at half four, or Friday at quarter past nine." },
    { at: 29, side: "caller", text: "Thursday half four. That's ideal, that is." },
    { at: 33, side: "agent", text: "Before I write it in — when did you last have your allergy alert test with us?" },
    { at: 39, side: "caller", text: "Ooh, ages ago. I've been coming to you six years, love." },
    { at: 44, side: "agent", text: "I can't see your test history from this phone and I'm not going to guess at it. It has to be done here, forty-eight hours clear of the colour — so Thursday's out, and Friday at quarter past nine is on if you can get in today for five minutes." },
    { at: 60, side: "caller", text: "I could come at half five on my way home. Go on then." },
    { at: 65, side: "agent", text: "Half five tonight for the test, Friday quarter past nine for your roots. Two visits instead of one and I'm sorry about that — Friday doesn't happen without tonight. I'll text you both times and let the salon know to expect you at half five." },
  ],

  toolRuns: [
    { at: 16, tool: "check_availability", ms: 380 },
    { at: 30, tool: "get_call_context", ms: 90 },
    { at: 31, tool: "search_knowledge", ms: 460 },
    { at: 61, tool: "check_availability", ms: 310 },
    { at: 62, tool: "book_appointment", ms: 640 },
    { at: 63, tool: "book_appointment", ms: 590 },
    { at: 70, tool: "send_sms", ms: 470 },
    { at: 72, tool: "notify_team", ms: 150 },
  ],

  rig: {
    title: "Record card",
    form: "chair",
    fields: [
      { id: "service", label: "What she's having", value: "Roots — regrowth, not a full head", at: 9, from: "caller", onPhone: true },
      { id: "column", label: "Whose column", value: "Kelly, asked for by name. Not promised by the phone.", at: 12, from: "caller", onPhone: true },
      { id: "rule", label: "Your colour rule", value: "Allergy alert test, in salon, 48 hours clear", at: 32, from: "search_knowledge", onPhone: false },
      { id: "gap", label: "Five minutes today", value: "17:30 — the last free start before you shut", at: 61, from: "check_availability", onPhone: false },
      { id: "test", label: "Test in the book", value: "Today 17:30 · allergy alert test", at: 62, from: "book_appointment", onPhone: true },
      { id: "colour", label: "Colour in the book", value: "Friday 09:15 · roots, 45 min · “Kelly” on the card", at: 63, from: "book_appointment", onPhone: true },
      { id: "texted", label: "Texted to Sandra", value: "Both times and the address. The service isn't named.", at: 70, from: "send_sms", onPhone: false },
    ],
    receipt: "Two appointments out of one call. Sandra knows why she's coming in tonight, and there's a card waiting to be signed before anybody touches her hair on Friday.",
  },

  wall: {
    never: "tell your regular she can skip the allergy alert test",
    clause:
      "Never tell a caller an allergy alert test can be skipped, shortened, posted out, or done on the day of the colour, and never state that a caller is exempt for any reason, including length of custom. You cannot see test records, so never say when anyone was last tested and never supply a date: say the salon will check, and offer to book one. Colour on anyone under sixteen is a human decision.",
    clauseSource: "the system prompt, held on our servers — being lovely on the phone does not edit it",
    detents: [
      {
        caller: "Do I have to do that test thing again? I've been coming to you for years.",
        agent: "Anyone having colour needs one in date, and I can't see yours from here. It's five minutes and you can do it on your way past.",
      },
      {
        caller: "I've never reacted to anything in my life. Can't you just put me in for Saturday?",
        agent: "I can put you in for the test tonight and the colour Saturday. I can't put you in for Saturday on its own — that isn't something I'm able to do.",
      },
      {
        caller: "Kelly's never made me do one. Ring her and ask her yourself.",
      },
      {
        caller: "Fine. I'll go to the place on the corner, shall I?",
        agent: "That's your call and I'd not blame you for it. I can't speak for them. Ours is that the test comes first — I'll leave half five in the book until six in case you change your mind.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "Six years with Kelly, so I'll carry your last test over and we'll call it still in da",
      instead:
        "— there's no carrying one over, and I was about to invent a date I cannot see. The test is done here, at least forty-eight hours before the colour, and it's signed and kept, because that card is what your insurer asks for on the day somebody reacts. If Kelly wants to make that call on her own client of six years, it is hers to make and not mine. Let me put you through to her.",
    },
    crosses:
      "One thing does get past it: the name of whoever can actually say yes. It says out loud that the rule is yours and not its own, puts her through to the floor, and warns her the answer may still be no. It does not soften a rule to get off the phone, and it does not argue with your clients on your behalf.",
  },

  relay: {
    because:
      "Two calls stop being bookings. A reaction — a scalp that's blistered, a lip line swollen after a wax, an eye closed up after lashes — and a colour that has gone wrong on someone who is upset about it. The first needs a qualified person and possibly a doctor; the second needs you, and no admission of fault from a phone. Nobody leaves a message on either of them: the alert goes out to whoever is on the list while she is still talking, and then she is put through.",
    who: "the owner, or whoever you've marked to take a reaction",
    by: ["notify_team", "transfer_call"],
    carries: [
      "her name and the number she's ringing from",
      "what she says she can see or feel, in her own words, untidied",
      "who did the work and when, if she says",
      "that nobody has told her it's normal or that it will settle",
    ],
    seconds: 11,
  },

  rules: [
    {
      label: "Two bookings for every colour, never one",
      changes: "A colour call turns into a five-minute test first and the colour on the far side of forty-eight hours, and she is told why before she picks a day.",
      on: true,
    },
    {
      label: "Keep the treatment out of the text",
      changes: "Confirmations carry the time and the salon and nothing else. A Hollywood on a lock screen in somebody's kitchen only has to happen once.",
      on: true,
    },
    {
      label: "Hold Saturday for colour",
      changes: "Saturday cut requests get offered the week instead, so the day's columns keep the slots that pay for them.",
      on: false,
    },
  ],

  ink: { ember: false, settled: true },

  faq: [
    {
      q: "Sandra's been coming to me fifteen years. She'll clock in two seconds that it's a machine.",
      a: "She will, and she won't be talking to it. Sandra rings at eleven on a Tuesday, Kelly picks up, and nothing about that changes — while the salon is open and somebody is free, the phone is theirs. What this takes is the twenty-to-seven call, the Sunday call, and the Saturday at half eleven when every column is full and the phone rings eight times and dies. Those callers are not getting a relationship today. They are getting an answerphone, and then the next salon on the list.",
    },
    {
      q: "Can it put someone in a particular stylist's column?",
      a: "No — and be careful of anything that says it can. It reads one diary, the one you connected, and it offers the times that diary has free. The stylist the caller names goes onto the booking exactly as she asked for her, and the person who opens the book in the morning does what a person has always done with it. That is a limit and we would rather print it than have Sandra turn up on Friday for a Kelly who isn't in. What it will never do is quietly move her into somebody else's column to fill a gap — clients are loyal to a person, not a building, and that is the one mistake a machine would make cheerfully.",
    },
    {
      q: "What about the girls who rent chairs off me?",
      a: "It doesn't book them, price them or speak for them. A chair renter is a separate business under your roof with her own diary, her own prices and her own clients, and a phone that books into her column on your behalf is a problem you didn't have before. A caller asking for her gets a message taken with her name on it, and she rings back. If she wants her own diary connected, that is her arrangement to make, not yours.",
    },
    {
      q: "They ask me constantly whether things are safe — pregnancy, medication, their skin. What does it say?",
      a: "Nothing, and that is the whole answer. Pregnancy and highlights, isotretinoin and waxing, a diabetic foot in a pedicure, blood thinners and microblading, a scalp condition, hair loss after chemotherapy — every one of those arrives on this phone dressed as a booking question, and there is no version of this where a machine is entitled to answer it. It does not screen, does not reassure, and specifically does not say “that's usually fine”. It gets a person. Handing over quickly is not the product failing here; it is the product working.",
    },
    {
      q: "Will it argue with someone about a deposit or a late cancellation?",
      a: "It reads your policy back as you wrote it, and it never waives a charge, discounts one or negotiates — it cannot take a payment either, so there is nothing for it to give away. A dispute goes to you with the booking attached. What it does do is make the cancellation easy to make at six the night before instead of nine the next morning: a cancellation you hear about in time is a chair you can still sell, and a no-show is chair time that no longer exists.",
    },
  ],

  jargon: [
    "column",
    "regrowth",
    "rent-a-chair",
    "development time",
    "allergy alert test",
    "strand test",
    "colour correction",
    "BIAB",
    "infill",
    "rebook",
  ],

  missRate: {
    value: "About three calls in ten go unanswered in the hours you're open",
    reasoning:
      "Our estimate, and worth saying why it is only that: nobody credible publishes a missed-call rate for this trade. The dramatic ones in circulation — 35–40% at peak, 1.82 billion missed salon calls a year — come from companies selling AI receptionists, and the report behind them says in its own pages that it synthesises Census and trade-association estimates and contains no call-log data. Ours comes from the shape of the week instead. A salon with a real front desk is nearer one in ten; a salon without one, which is most of this market, nearer one in three; Saturday between ten and three, comfortably over half. And that counts trading hours only — closed Mondays and Sundays and shut at half five, the line is unattended for roughly seventy percent of the week's clock, which is arithmetic rather than a claim. Before you believe a word of it: your network will itemise missed and abandoned calls by hour for nothing, and that is the number this page should be judged against.",
  },

  valuePerCall: {
    value: "About £17 for each call you get back — $23 in a US salon",
    reasoning:
      "Our arithmetic, in the currency the rest of this page is written in, and shown so you can argue with it. A blended ticket — men's cuts, brows, an infill, a blow-dry — averages about £55, not the price of a balayage, and using the colour price here would be the easiest way to flatter this number. Of ten calls you get back, roughly three book: three are existing clients moving or cancelling, two are questions, two ring four salons and book none of them. Take off the 3% who never turn up and the 8% who cancel and it lands near £17. The US figure is the same arithmetic run on US prices — a $75 blended ticket, $23 — and not this one through an exchange rate. Note the words got back: a third of the people who ring a salon and get nothing find it anyway, so count the calls you actually recovered rather than the ones you missed. Two things we left out because we can't prove them for your salon: a colour client comes back every six to eight weeks rather than once, and a cancellation you hear about the night before is a slot you can still sell. We have not multiplied any of it by your call volume, and we are not going to.",
  },

  citations: [
    {
      claim: "A booked appointment is not money until somebody sits down.",
      publisher: "Zenoti, Benchmark Report",
      date: "2025",
      sample:
        "Transaction data from more than 30,000 salon, spa and medspa businesses across the US and Canada, covering calendar year 2024: 3% no-show and 8% cancellation on salon appointments. The report carries a year and no month, so neither do we.",
      interest: "Zenoti sells salon and spa booking software.",
    },
  ],

  objection: {
    asks: "It'll book things wrong. Someone rings up wanting “a colour”, it puts them in for an hour, and it's a correction — and now my whole Saturday's out the back door.",
    answer:
      "That is the right fear, and it is worse than she says: under-booking a colour does not cost one appointment, it derails every column behind it for the rest of the day, which is materially worse than not answering the phone at all. So it is not allowed to decide what a service is. It books what the caller names, off your own service list, at your own length — and when the name she uses isn't on that list, it asks her which one she means rather than picking. The moment a call contains box dye, henna, extensions, a wedding, the word correction, or anything it would have to guess at, it books a twenty-minute consultation and flags it to you. A consultation booked in error costs you twenty minutes. A colour booked in error costs you the afternoon. It is built to make the cheap mistake.",
  },
};
