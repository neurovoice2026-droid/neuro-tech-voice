import type { Trade } from "./schema";

/* ------------------------------------------------------------------ *
 * Schools & tutoring — written for a day nursery, and only for a day
 * nursery.
 *
 * The menu label covers four businesses and the first draft of this page
 * tried to serve all four: a tuition centre's sample call, a nursery's
 * register deadline, a driving instructor's FAQ, a music school's
 * vocabulary. Nobody runs all four. A one-car instructor arrived on a
 * page whose hero moment is a ten o'clock register he has never had, and
 * a nursery manager had to read a paragraph about exam boards to reach
 * the part about her own morning. So the page is a nursery's: the call,
 * the artefact, the wall, the rules and every word of the vocabulary are
 * early years. The tuition centre, the music school and the driving
 * school each want a page of their own — the driving school most of all,
 * because since 12 May 2026 nobody but the learner may touch a DVSA test
 * booking, and a refusal that hard-edged is a whole page's spine rather
 * than a footnote on somebody else's.
 *
 * What makes a nursery's phone unlike every other line on this site: in
 * the busiest hour of the day, half of what it carries is not a sale. At
 * 08:04 a mother is discharging an obligation — "Ollie's been sick in
 * the night, he's not in" — thirty seconds, no revenue, and the most
 * important call of the morning, because by ten the register has to be
 * right and a child not accounted for starts somebody ringing emergency
 * contacts. At 08:06 the same handset takes a woman who is twenty weeks
 * pregnant asking about babies in 2028. Miss the first and the setting
 * opens a welfare check on a child who is asleep at his nan's. Miss the
 * second and she rings the nursery on the next road.
 *
 * And the person who ought to pick up is the person who cannot. The
 * manager is the receptionist, and in a small setting she is also
 * counted in the statutory staff-to-child ratio — 1:3 under two, 1:5 at
 * two, 1:8 at three and over — so walking to the office to answer can
 * put a room in breach. The phone rings out because ringing out is the
 * correct decision. The two hours she is least reachable, 07:30 to 09:00
 * and 16:00 to 18:00, are the two hours the phone rings hardest, and in
 * January and February she takes three or four times the calls on the
 * same handset with the same one pair of hands.
 *
 * Vocabulary is checked against the sector and it is unforgiving. Key
 * person, never "key worker" — EYFS says key person, and key worker has
 * meant something else entirely since 2020. Practitioners and early
 * years educators, not teachers; only a school has teachers. Funded
 * hours, or the entitlement, and never "free hours", because the funding
 * rate rarely covers the cost of the session and the word is an insult.
 * Rooms have names, not numbers. Sessions and full days, occupancy,
 * settling-in, show-round, the two-year check, the exclusion period, the
 * DSL. Fees are invoiced monthly in advance — the first draft of this
 * page said termly, which is a tuition centre's invoice and not a
 * nursery's. And a nursery is not a childminder and not a crèche:
 * different registrations, different law, never synonyms.
 * ------------------------------------------------------------------ */

export const education: Trade = {
  slug: "education",
  label: "Schools & tutoring",

  kicker: "Half eight: the one person who may answer is counted in a room.",
  standfirst:
    "It answers on the first ring, gets the absence to the right room while the register is still open, and takes the days, the age and the month a new family needs — while giving out nothing whatsoever about a child.",

  prongs: [
    {
      id: "register",
      label: "Not in today",
      does: "gets it on the screen before ten",
      caller: "Hiya, it's Leanne, Ollie's mum — he's been sick in the night, he's not in today.",
      asks: "Takes the child's name, his room and the reason in her own words, reads it back, and puts it in front of the manager while the register is still open — so nobody spends the morning ringing emergency contacts about a child who is asleep at his nan's.",
      urgent: true,
    },
    {
      id: "place",
      label: "Wants a place",
      does: "gets the days down before the money",
      caller: "How much is it, and have you got September? She'd be two days, she's nine months now.",
      asks: "Gets the age, the two days and the start month down before anybody says a number, then reads your sessions and your rates off your own fees sheet. It will not tell her whether there's a place, and it will not tell her what she'd pay under the entitlement.",
    },
    {
      id: "waiting",
      label: "Ringing years early",
      does: "puts her on the list, two years out",
      caller: "I'm twenty weeks. Everyone says ring now — what's the wait for babies?",
      asks: "Puts her on the waiting list with the month she'll actually need, not the month she rang. In this trade a caller who is two years early is a caller doing it properly, and she is treated that way.",
    },
  ],

  intents: [
    { chip: "Ollie's not in, he's been sick", reaches: "take_message", then: "Logs it to his room, in her wording, with the time she rang. It doesn't rule on when he's allowed back." },
    { chip: "my mum's getting Freya today", reaches: "notify_team", then: "It cannot add a collector or confirm one. The manager knows inside a minute, and the caller is told so." },
    { chip: "how much is it, got September?", reaches: "search_knowledge", then: "Reads the session times and the day rate off your own fees sheet. Never a total, and never the word free." },
    { chip: "any Mondays left in the baby room?", reaches: "take_message", then: "Nothing in this product knows your occupancy, so it doesn't guess it. It takes her days for you to answer." },
    { chip: "I'm 20 weeks, what's the wait?", reaches: "add_to_waitlist", then: "Takes the month she'll need it, not the month she rang. There's no queue position, so it invents none." },
    { chip: "do I get the thirty hours?", reaches: "take_message", then: "It won't say whether she qualifies or what she'd pay. The question goes up with her number and her days." },
    { chip: "is she in with a temperature?", reaches: "search_knowledge", then: "Reads your sickness policy back as written. It will not apply it to her child, and it says so out loud." },
    { chip: "it's Aimee, I can't come in", reaches: "notify_team", then: "Your own practitioner ringing in sick at twenty to seven decides the day. The manager has it before seven." },
    { chip: "traffic's awful, can you keep her", reaches: "notify_team", then: "The room has to know before six, not after. It pages the setting and says nothing about the late charge." },
    { chip: "filled your form in, nobody rang", reaches: "check_availability", then: "It doesn't defend the fortnight of silence. It offers her a show-round on this call, Saturday included." },
    { chip: "can we do the Saturday instead?", reaches: "reschedule_appointment", then: "Moves the show-round it found under her own number. Nobody is told her Thursday has come free." },
    { chip: "we'd want term-time only", reaches: "save_lead_details", then: "Days, age, start month and the sibling already in pre-school, on the lead before anyone rings her back." },
    { chip: "text me the days and the price", reaches: "send_sms", then: "Texts the session pattern and the monthly fee to the number she rang from. It can't text anybody else." },
    { chip: "can I move her settling-in?", reaches: "find_booking", then: "Finds it only if she booked it on this phone. Booked by dad on his mobile, it finds nothing and says so." },
    { chip: "why wasn't I told she was off?", reaches: "transfer_call", then: "Nothing about a named child leaves this line. The manager, while he is still holding." },
    { chip: "something's happened to a child", reaches: "transfer_call", then: "It stops, asks nothing further, and fetches your safeguarding lead. That is never taken as a message." },
  ],

  duration: 98,

  turns: [
    { at: 0, side: "agent", text: "Hollybank Day Nursery — this is the answering assistant. The manager's in a room at the minute. What can I do for you?" },
    { at: 8, side: "caller", text: "I'm after September. She'd be two days a week — she's nine months now, she'll be one in the August. How much is it?" },
    { at: 16, side: "agent", text: "Two days — do you know which two? It goes by room and by day here, so Tuesday and Wednesday is a different question to Monday and Friday." },
    { at: 26, side: "caller", text: "Tuesday and Wednesday. I'm back at work in the September, that's the whole reason I'm ringing now." },
    { at: 34, side: "agent", text: "At one she'd be starting in Ducklings, the baby room. I can't tell you whether those two days are open — nobody reads that off a screen, the manager holds occupancy room by room. What I can do is get you in to see it." },
    { at: 46, side: "caller", text: "Everyone keeps telling me I'll get the free hours anyway." },
    { at: 52, side: "agent", text: "Funded, not free — and I'm not going to tell you whether you'd get them or what you'd pay, because that turns on a code you get from HMRC and on the days you end up with. The manager does that with your dates in front of her. What I can read you is the sheet: £64 a full day, £38 a morning session, invoiced monthly in advance." },
    { at: 66, side: "caller", text: "Fine. When can I come and look round?" },
    { at: 68, side: "agent", text: "Let me see what she's got for show-rounds." },
    { at: 76, side: "agent", text: "Thursday the twenty-fourth at half nine, or she does one Saturday a month and that's the twenty-sixth, ten o'clock. Can I take your name?" },
    { at: 84, side: "caller", text: "Nia Tregear. Thursday, half nine." },
    { at: 90, side: "agent", text: "Booked. I'll text you the address, the session times and those two rates. You've registered for nothing and there's no deposit — it's a look round." },
  ],

  toolRuns: [
    { at: 36, tool: "save_lead_details", ms: 210 },
    { at: 48, tool: "search_knowledge", ms: 360 },
    { at: 70, tool: "check_availability", ms: 490 },
    { at: 86, tool: "book_appointment", ms: 740 },
    { at: 93, tool: "send_sms", ms: 560 },
  ],

  rig: {
    title: "Place enquiry",
    form: "enrolment",
    fields: [
      { id: "child", label: "The child", value: "Nine months · one in the August", at: 8, from: "caller", onPhone: true },
      { id: "days", label: "Days she needs", value: "Tuesday & Wednesday · from September", at: 26, from: "caller", onPhone: true },
      { id: "room", label: "Room she'd land in", value: "Ducklings, on her age · no place held", at: 48, from: "search_knowledge", onPhone: true },
      { id: "why", label: "Why she rang now", value: "Back at work in the September", at: 38, from: "save_lead_details", onPhone: false },
      { id: "fees", label: "Read off your sheet", value: "£64 a day · £38 a morning · monthly, in advance", at: 50, from: "search_knowledge", onPhone: false },
      { id: "showround", label: "Show-round", value: "Thursday the 24th, 09:30 · Nia Tregear", at: 88, from: "book_appointment", onPhone: true },
      { id: "texted", label: "Texted to Nia", value: "Address · session times · both rates", at: 95, from: "send_sms", onPhone: false },
    ],
    receipt: "Two days, a room, a Thursday morning to come and look — and nothing promised about a place or a price.",
  },

  wall: {
    never: "rule on whether a child is well enough to come back in",
    clause:
      "Never give health advice and never decide whether a child may attend. You may read the setting's sickness and exclusion policy back as it is written; you may not apply it to a named child, count an exclusion period, or say whether a temperature, a rash, a course of antibiotics or a sickness bug clears them to come in. Every 'can I still bring him' goes to the manager with the question and the caller's number, marked urgent.",
    clauseSource:
      "the system prompt, assembled on our servers before the call connects — there is no toggle for it in your dashboard, and no version of 'just this once' that gets round it",
    detents: [
      {
        caller: "He's been right as rain since six, he's had a full bowl of Weetabix. Can I just bring him in?",
        agent: "That isn't mine to call. It's your setting's sickness policy and the manager's judgement, and I'd be deciding it over the phone about a child I can't see. Let me get her the question now.",
      },
      {
        caller: "You've got a sickness policy, haven't you? Read me what it says, then.",
        agent: "That I can do. It's forty-eight hours clear of the last episode before a child comes back, and it's in your registration pack as well. What I can't do is count the hours for Ollie and tell you he's fine — that is hers to say.",
      },
      {
        caller: "Last one was Sunday teatime. It's Tuesday morning. You've just read me the rule, so do the sum.",
      },
      {
        caller: "I'm due on shift at seven. If he can't come in I've lost the day and you've still taken my money.",
        agent: "I'm not going to argue that with you, and I'm not the one who can fix it either. I'm putting you through to her now, and if she can't pick up she has your number, your question and the times you gave me, marked urgent.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "Sunday teatime to now is near enough forty hours, and he's kept his breakfast down, so bring him in after lun",
      instead:
        "— I can't do that sum, and I shouldn't have started it. Whether Ollie comes back tomorrow is your exclusion policy applied by your manager, not forty-eight hours counted by a machine on the phone, and if I'm four hours out it isn't me that has it going round the baby room. She has the question and your number, marked urgent, and I'm putting you through now.",
    },
    crosses:
      "The question reaches a person whether or not she asks for one: she rang a nursery, not a triage line, and she has no reason to know she needs the manager until she has been told no. One medical sentence does survive the rule — if what she is describing sounds like it needs a doctor this morning rather than a nursery place, it says so and points her at 111, or 999 if she is frightened. That is the only health line in the prompt, and it is there because a parent at half six in the morning rings the nursery first.",
  },

  relay: {
    because:
      "Two calls stop being business the moment they start: anything about where a named child is or how they are, and anything a caller begins to disclose about a child's safety. The agent stops, asks nothing further, offers nothing. The alert goes out first and does not wait for the transfer to connect, because a transfer can fail and a disclosure cannot wait for a second attempt.",
    who: "your designated safeguarding lead, or the manager if you haven't named one",
    by: ["notify_team", "take_message"],
    carries: [
      "her sentence as she said it, with nothing added, nothing tidied and no question asked after it",
      "the number she rang from, marked as a number and not as an identity",
      "nothing about the child that she did not volunteer herself",
      "the second it landed, so your safeguarding record and ours agree",
    ],
    seconds: 9,
  },

  rules: [
    {
      label: "Absences on the manager's screen before ten",
      changes:
        "The absence is logged to the room the child is actually in, with the time she rang, instead of sitting in a voicemail box until lunchtime while somebody starts ringing emergency contacts.",
      on: true,
    },
    {
      label: "Never put a call through to anyone who's in ratio",
      changes:
        "The call becomes a message the manager reads when she is off the floor, instead of a practitioner stepping out of the baby room to take it and leaving the room one adult short while she does.",
      on: true,
    },
    {
      label: "Take waiting-list names for dates I can't offer yet",
      changes:
        "September full? It still takes her month, her days and her number, rather than telling a caller who rang two years early to try again in the spring.",
      on: false,
    },
  ],

  ink: { ember: false, settled: true },

  faq: [
    {
      q: "Will it tell a parent whether their child is in today?",
      a: "No, and there is no version of the setup where it will. It takes information in about a child and gives none out — not whether they're on roll, not whether they were here, not who collected them, not to someone who sounds exactly like the mother. An inbound call cannot verify who is speaking, and settings routinely hold do-not-disclose flags where a parent has no parental responsibility or an order is in force. The same rule covers the regulated facts about you: it will not state an inspection grade, a staff-to-child ratio, a qualification level or anyone's DBS status.",
    },
    {
      q: "A parent rings in an absence at ten to eight. What actually happens to it?",
      a: "It takes the child's name, the room, the reason and the time she rang, reads it back to her, and saves it as a message your team is notified about straight away — so the register is right by ten and nobody spends the morning ringing emergency contacts about a child who is asleep at his nan's. It also takes the second half of that call, the one that is really a diary change: she's back Thursday, nan's collecting Friday, she'll drop the fees cheque in. What it does not do is answer the question she asks next, about when he's allowed back; that one is further down this page, and it is the whole reason the rule is flat.",
    },
    {
      q: "Every other call is about the funded hours. What does it actually say?",
      a: "It says 'funded', never 'free' — and then it says less than a parent wants. It will read your session times and your rates off your own sheet, because those are yours and published. It will not tell her whether she qualifies, what a code does to her invoice, or what she'd pay: eligibility runs through an HMRC code the parent obtains and reconfirms every three months, the entitlement rarely covers the real cost of a session, and a setting that lets a phone call imply otherwise has bought itself a fee dispute in September. The question goes to the manager with the parent's number and the days she wants, which is the only form in which it can actually be answered.",
    },
    {
      q: "Will it sign a family up on the phone?",
      a: "No. It books the show-round, and a human closes. An enrolment agreed on a call is a distance contract carrying a fourteen-day right to cancel under the Consumer Contracts Regulations 2013, so a keen answering service that registers someone at 08:15 has handed you a cancellation and an argument about a deposit. It takes no registration fee and no card details — booking a look round creates nothing anybody has to unwind.",
    },
    {
      q: "Our enquiries all land in January and February, for September starts.",
      a: "Which is the case for it rather than against. In those six or seven weeks a setting takes three or four times its usual calls through the same one handset, with the same manager, who is still counted in a room — and the calls arrive in the same two windows as the absences, so they queue behind them. It does not get busy. It answers the thirtieth call of the morning the way it answered the first, takes the age, the days and the month, and leaves them on your desk in one shape instead of eleven voicemails you listen to at nine at night. What it will not do is invent a start date, or tell any of them there's a place.",
    },
  ],

  jargon: [
    "key person",
    "in ratio",
    "funded hours",
    "the entitlement",
    "show-round",
    "settling-in",
    "occupancy",
    "sessions",
    "exclusion period",
    "DSL",
  ],

  missRate: {
    value: "About one call in three, and more than half of the ones at half eight",
    reasoning:
      "Our estimate, and the arithmetic behind it is not the usual one. A nursery office is nominally staffed all day; the trouble is that the person in it is the manager, she is counted in the ratio, and the two windows the phone rings hardest — 07:30 to 09:00 and 16:00 to 18:00 — are the two windows she is on the floor covering a room, on a show-round, or in early because somebody rang in sick at 06:40. Across a whole day we would put it at a fifth to a third; inside those two windows it goes above half, which is where it hurts, because that is when both the absences and the new families ring. We looked for a published figure for early years and there is no credible one — the percentages in circulation are published by firms selling answering services into nurseries. Count a Monday against your own handset instead — that number is worth more than ours.",
  },

  valuePerCall: {
    value: "About £150 for each call you get back",
    reasoning:
      "Our arithmetic, and it is a nursery's rather than an average of four trades. A part-time place grosses a setting somewhere near £150 a week once funded income is counted, and we take 45 weeks of it — £6,750 — then stop at one year, although a child who starts in the baby room is usually still with you at three. We assume one place enquiry in five becomes a registration, which is a soft number with one small case behind it and no survey anywhere; halve it if the show-round is the manager's first go at selling. That puts an answered place enquiry at about £1,350. Then the honest division: roughly one call in nine is a new place, and the other eight are an absence, a fee query, a grandmother, a mother changing her days — worth keeping, worth nothing on this line. £1,350 across nine calls is the £150 above. We have priced it in pounds because a British week is the one we could actually check, and we are not going to hand you a dollar figure that is only today's exchange rate; run the same three lines on your own weekly rate. Nor are we multiplying it by your call volume to print a year. Every brochure in this category leads with that total, and not one of them has seen your Monday.",
  },

  citations: [
    {
      claim: "A nursery place is priced by the week, which is why one recovered enquiry is worth a year of them.",
      publisher: "Coram Family and Childcare, Childcare Survey 2026",
      date: "2026-03-18",
      sample:
        "Annual survey of childcare prices reported by local authorities across England, Scotland and Wales: a 25-hour place at £133.08 a week in Scotland, £166.33 in Wales, and £189 a week for families in England not eligible for the entitlement.",
      interest:
        "Coram campaigns on childcare affordability, so what it collects is the price parents pay, not the money a setting banks — the two differ by the shortfall on every funded hour, which is the reason nobody in this trade says 'free'.",
    },
  ],

  objection: {
    asks: "I'm not having a machine talk to my parents about their children. If a mum rings because something's happened to her little boy and she gets a robot, I'm finished.",
    answer:
      "She is right, and that call is not the one it takes. It never handles a disclosure, never discusses a named child, never gives out one fact about who is on site; the moment a call turns towards a child's welfare it stops and fetches a person, and if that person is in a room it takes the number and marks it urgent rather than trying to help. What it takes is the other four calls in five — Ollie's not in today, how much is it and have you got September, can my mum get her tonight, what's the wait for babies. And the comparison isn't the agent against her. It's the agent against what a parent actually gets at 07:40 on a Monday, while she's covering the baby room because someone rang in sick at 06:40 and she can't leave without breaking ratio: nine rings and a recording. A mother who rang three nurseries and got voicemail at two of them doesn't think the third one is warmer. She thinks it's open.",
  },
};
