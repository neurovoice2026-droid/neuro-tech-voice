import type { Trade } from "./schema";

/* ------------------------------------------------------------------ *
 * Real estate — sales and lettings, the two-to-six-person independent.
 *
 * What makes this phone unlike the other fifteen: every other trade has a
 * caller with a problem. This one has a caller who is also the stock. The
 * person ringing to view the three-bed on Milton Road has a house of her
 * own to sell, and her house is worth many times more to the branch than
 * the viewing she rang about — the trade calls it the seller behind the
 * buyer, and it is the question a negotiator gets into every inbound call.
 * Which produces the thing that is true here and nowhere else: the
 * highest-value sentence in the business arrives sounding like the lowest.
 * "We're not selling yet, I just wondered roughly what we'd get for it" is
 * an appraisal walking past the door, delivered apologetically, often by
 * someone who rings off before giving her name because she thinks she is
 * wasting yours. The second half is stranger still. A large share of the
 * inbound is not customers at all but the counterparties to deals already
 * agreed — solicitors, surveyors, brokers, the agent four links up the
 * chain — ringing about money the branch has already won and can still
 * lose. No plumber's invoice falls through in week seven because somebody
 * three houses up changed their mind.
 *
 * Vocabulary is checked against a branch, not a thesaurus. A market
 * appraisal is not a valuation: a valuation is what a RICS surveyor or a
 * lender produces, and confusing the two is a compliance problem rather
 * than a style one — so every printed word on this page says market
 * appraisal, and the only place "val" appears is inside a quoted spoken
 * line, which is where branch slang actually lives. Sellers are vendors;
 * registered buyers are applicants, never "leads" anywhere they can hear
 * you. The adjective that decides everything is proceedable — chain-free,
 * cash, sold STC, or a first-timer with an AIP. Nothing is sold until
 * exchange; before that it is SSTC, and writing "sold" about an agreed
 * sale is how you lose an agent by the second paragraph. Prices are
 * reduced, never cut. Never "realtor" in UK copy, never "estate agent" in
 * US copy, and Scotland is a different legal country — Home Report, offers
 * over, missives, and no exchange at all.
 *
 * Two structural decisions, so nobody quietly undoes them. The wall is the
 * price refusal, because the whole page is the appraisal call and a page
 * whose sample call turns on "I can't put a figure on a house over the
 * phone" cannot then spend its refusal on somebody else's lease; the
 * material-information discipline lives in the FAQ instead. And the diary
 * entry is marked provisional, because `settled` is false here: an hour of
 * a lister's Thursday is hers to cancel, and nothing about the house, the
 * price or the instruction was settled by this call.
 * ------------------------------------------------------------------ */

export const realEstate: Trade = {
  slug: "real-estate",
  label: "Real estate",

  kicker: "It's 8:48 on a Wednesday. The branch shut two hours ago and it's ringing.",
  standfirst:
    "It answers, reads back only what's written on your own listing, gets the viewing or the market appraisal into the diary — and asks the one question a voicemail never asks: have you got somewhere to sell?",

  prongs: [
    {
      id: "viewing",
      label: "Wants to see it",
      does: "registers her and books the viewing",
      caller: "Is the three-bed on Milton Road still available? I saw it on Rightmove last night.",
      asks: "Reads back only what the listing actually says, then asks what a negotiator would ask — is there a house to sell, and is there a mortgage agreed in principle — before it offers a viewing the diary can support.",
    },
    {
      id: "tonight",
      label: "Tonight's viewing moves",
      does: "moves the viewing before anyone sets off",
      caller: "I'm stuck at work. Can we do half six instead of half five, or have I blown it?",
      asks: "Finds the viewing under the number she's ringing from, moves it, and gets it to the negotiator who is already in the car — because the vendor has hoovered and is sitting there waiting.",
      urgent: true,
    },
    {
      id: "appraisal",
      label: "Thinking about selling",
      does: "turns “just wondering” into a Thursday",
      caller: "We're not selling yet, I just wondered roughly what we'd get for it.",
      asks: "The most valuable call the branch gets, and it arrives sounding like the least. It books the market appraisal, says plainly that nobody puts a figure on a house they haven't stood in, and briefs whoever's knocking before they knock.",
    },
  ],

  intents: [
    { chip: "is the Milton Road one still on", reaches: "search_knowledge", then: "Reads your own listing back as written. If the file doesn't say it's still on, neither does it." },
    { chip: "we're not selling yet, but roughly", reaches: "check_availability", then: "Opens the diary you connected, offers two windows. The number she rang to get never gets said." },
    { chip: "can we push tonight's five thirty", reaches: "find_booking", then: "Finds the viewing under the number she's ringing from before it touches anybody's diary." },
    { chip: "any feedback from Saturday's lot", reaches: "notify_team", then: "Names the property and puts it in front of her negotiator inside a minute. It doesn't attempt the feedback." },
    { chip: "five weeks and not one phone call", reaches: "transfer_call", then: "The angry one gets a person while she's still on the line. It doesn't explain and it doesn't defend you." },
    { chip: "twenty under, cash, no chain", reaches: "take_message", then: "Writes the offer down word for word and says nothing back. Offers go to the vendor in writing, by law." },
    { chip: "what's the service charge on it", reaches: "search_knowledge", then: "Reads tenure, lease years and service charge back off your own file — or says it'll come in writing." },
    { chip: "is it a decent area for kids", reaches: "take_message", then: "It has no opinion about anybody's street and isn't allowed one. A negotiator rings her back instead." },
    { chip: "do you take DSS", reaches: "check_availability", then: "Answers by offering a viewing, like anyone else. Screening on benefits is unlawful, not a preference." },
    { chip: "solicitor for the buyer at 14 Elm", reaches: "transfer_call", then: "Chain calls go to the progressor. It never guesses where a file has got to." },
    { chip: "board's been up since February", reaches: "save_lead_details", then: "The neighbour ringing to be nosy is next year's instruction. It asks whether they're moving too." },
    { chip: "mum passed in March, the house", reaches: "take_message", then: "Slows right down, takes it gently, and gets a senior name and a time on it. No sequence, no pitch." },
    { chip: "not sure who I need to speak to", reaches: "search_knowledge", then: "Asks one thing at a time and looks up what the branch actually does, rather than sending her away." },
    { chip: "ringing round, what do you charge", reaches: "search_knowledge", then: "Reads your fee basis off your own documents. It never calls a rate standard, typical or set." },
    { chip: "can't make Saturday now", reaches: "cancel_appointment", then: "Finds it under her number first, then cancels it. Telling the negotiator is a separate message." },
    { chip: "nothing under a grand on your site", reaches: "add_to_waitlist", then: "Adds her to the waitlist with what she's after. There's no queue position and it can't invent one." },
  ],

  duration: 96,

  turns: [
    { at: 0, side: "agent", text: "Ridley Kane — you're through to the answering assistant. The branch is shut till nine. What's it about?" },
    { at: 8, side: "caller", text: "It's probably nothing. We're not selling yet, I just wondered roughly what we'd get for it." },
    { at: 16, side: "agent", text: "That's not nothing, it's the right call to make. I can't put a figure on a house over the phone, but I can book you a market appraisal — someone comes and stands in it. Whereabouts are you?" },
    { at: 29, side: "caller", text: "Thirty-one Holmwood Rise, the S11 end. It's only a three-bed. Is it free, this?" },
    { at: 38, side: "agent", text: "Free, and nothing's charged unless you instruct us and it sells. Have you seen somewhere you'd be moving to, or is this a first look?" },
    { at: 48, side: "caller", text: "There's a bungalow in Dore we keep driving past. We've done nothing about it. We had the loft done four years back, if that makes any difference. My husband thinks I'm daft ringing." },
    { at: 58, side: "agent", text: "You're not. Half the appraisals I book, nobody's decided anything. Let me look at Nuala Brennan's week — she does the listings this end of the city." },
    { at: 65, side: "agent", text: "Thursday the twenty-fifth at half six, or Saturday at ten. She'll want the hour, and she won't have a figure until she's been round the house. Who shall I put it under?" },
    { at: 78, side: "caller", text: "Thursday. Rosalind Thackray. And don't text me — I'd rather it didn't come up on the phone." },
    { at: 84, side: "agent", text: "No text. Thursday the twenty-fifth, half six, Nuala Brennan. Nothing's committed by that — if you change your minds, ring the branch and we'll take it back out." },
  ],

  toolRuns: [
    { at: 0, tool: "get_call_context", ms: 80 },
    { at: 33, tool: "search_knowledge", ms: 340 },
    { at: 50, tool: "save_lead_details", ms: 210 },
    { at: 59, tool: "check_availability", ms: 430 },
    { at: 81, tool: "book_appointment", ms: 720 },
    { at: 87, tool: "take_message", ms: 230 },
  ],

  rig: {
    title: "Appraisal card",
    form: "viewing",
    fields: [
      { id: "asked", label: "What she rang to ask", value: "Not selling yet — “roughly what we'd get”", at: 8, from: "caller", onPhone: true },
      { id: "property", label: "The house", value: "31 Holmwood Rise, S11 — three bed", at: 29, from: "caller", onPhone: true },
      { id: "fees", label: "What she was told about fees", value: "Appraisal free · no sale, no fee", at: 38, from: "search_knowledge", onPhone: false },
      { id: "onward", label: "Onward purchase", value: "Bungalow in Dore — not viewed, no offer", at: 50, from: "save_lead_details", onPhone: true },
      { id: "notext", label: "Do not text this number", value: "Her request — time read back twice", at: 78, from: "caller", onPhone: false },
      { id: "diary", label: "Market appraisal, provisional", value: "Thu 25th, 18:30 · Nuala Brennan · hers to cancel", at: 81, from: "book_appointment", onPhone: true },
      { id: "brief", label: "To Nuala, before she knocks", value: "Loft done 4 yrs · may be buying · no figure given", at: 87, from: "take_message", onPhone: false },
    ],
    receipt: "An hour of Thursday that Rosalind can take back out, and nothing else. No figure was given, nothing was promised, and Nuala knows about the loft and the bungalow before she knocks.",
  },

  wall: {
    never: "put a figure on your house",
    clause:
      "Never state, estimate, imply or agree to a price, a value, a range, a guide or a rent for any property, including the caller's own home and including a figure the caller proposes first. Do not quote sold prices, portal estimates or what similar properties achieved. Only a market appraisal carried out at the property produces a figure. Book one, or take the caller's details for a member of the team to ring back.",
    clauseSource: "the system prompt, held server-side — a caller can push on it all they like, it isn't theirs to move",
    detents: [
      {
        caller: "Go on, roughly. What's a three-bed up our end going for these days?",
        agent: "I'd only be guessing, and a guess is the expensive kind of help — too high and it sits on the portal going stale, too low and you've handed somebody forty thousand pounds. Nuala can stand in it on Thursday.",
      },
      {
        caller: "You must see the numbers all day. What did the one at number nineteen go for?",
        agent: "Sold prices are public — you can look nineteen up as fast as I can. What it won't tell you is what nineteen had done to it and what yours has had done, and that is the whole of the difference between the two figures.",
      },
      {
        caller: "I'm not going to hold you to it. My husband's asking and I've got to tell him something tonight.",
      },
      {
        caller: "Rightmove put a number on it in four seconds and it's never once rung me back.",
        agent: "It did, and it has never been up your stairs. I'm not going to argue you into Thursday, though. Nuala Brennan does the listings this end of the city — I'll get your number to her tonight and she'll ring you in the morning. She'll tell you exactly what I have, only she can change it by standing in the house.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "Round there you'd probably be asking four-twen",
      instead:
        "— no. I'm not putting a price on a house nobody has walked round, and you shouldn't take one off a phone. Tell him a woman called Nuala is coming Thursday at half six with everything that's actually sold on your road, and that you'll get the reasoning as well as the number.",
    },
    crosses:
      "One thing does get through it: a person. A caller who needs a figure tonight — probate, a divorce, a lender's deadline — stops being asked questions and is put through, or gets a name and a time on a message the branch sees at once. The figure still waits until somebody has stood in the house. She doesn't wait for anyone to ring back.",
  },

  relay: {
    because:
      "Three calls here are finished by a person or they are not finished: anyone angry, anyone in a chain — a solicitor, a surveyor, the agent four links up — and anyone whose call has quietly become a bereavement. In branch hours it puts them straight through. At twenty to nine at night there is nobody to put them through to, so it takes the call down properly instead and the team is notified the moment it lands.",
    who: "the negotiator on that property, or whoever you marked for transfers",
    by: ["transfer_call", "take_message"],
    carries: [
      "who is calling and the number she rang from",
      "which property, as she named it, plus the reference if your listing carries one",
      "her sentences rather than a summary of them, and how long she has been waiting",
    ],
    seconds: 11,
  },

  rules: [
    {
      label: "Ask every caller whether they've got somewhere to sell",
      changes: "The question goes into every inbound call, including the ones that sound like nothing, and the answer lands on the card.",
      on: true,
    },
    {
      label: "Vendors on a live instruction go to their own negotiator, nobody else",
      changes: "It asks which property before anything else — it can't tell from the number — then says who is ringing back and by when, and puts it in front of them inside a minute.",
      on: true,
    },
    {
      label: "Out of hours, put anything about a chain through to my mobile",
      changes: "Evenings and Sundays, a solicitor or an agent up the chain reaches you instead of a message you read at nine the next morning.",
      on: false,
    },
  ],

  ink: { ember: false, settled: false },

  faq: [
    {
      q: "Will it answer my buyers' questions about the property?",
      a: "No — and that is the pitch, not an apology for it. It reads back what is written on the listing file you gave it and nothing else. Tenure, lease length, ground rent, service charge, council tax band, flood history, cladding: all of that is material information, all of it is a regulated statement under the Digital Markets, Competition and Consumers Act since 6 April 2025, and the CMA can now fine directly rather than through a court. So ask it how many years are left on a lease and, unless that number is on the file, it will not produce one — not eighty, not “about eighty”, not a number softened with “roughly”. What it produces instead is “I'll have that confirmed for you in writing” and a person's name. In the US the refusal is the same and the reason is different: a voice agent is an unlicensed assistant in every state, and discussing price, terms or condition is unlicensed practice.",
    },
    {
      q: "If it won't give her a number, doesn't she just ring the next agent?",
      a: "Some will, and those were never yours — the caller shopping for the highest number over the phone is the one who over-prices, sits for four months and reduces. The refusal buys the only thing that converts an appraisal call, which is somebody standing in the hall with the comparables in her hand. The number that decides whether this is worth anything to you is how many of your booked appraisals become instructions, and you already know yours better than any vendor of software does.",
    },
    {
      q: "Someone will try to put an offer in over the phone. Then what?",
      a: "It takes the name, the number and the offer in the caller's own words, says it will go to the vendor, and stops. It does not say whether there are other offers, what they are, whether the vendor would take it, or why the vendor is selling. Under the Estate Agents Act 1979 every offer goes to the vendor promptly and in writing, and that is an agent's job rather than a phone's.",
    },
    {
      q: "What actually happens to the calls at half eight at night?",
      a: "It answers them. It can read the listing, register the applicant, put a viewing or an appraisal in the diary and get a message to whoever is on call. What it cannot do is ring anybody back — there is no outbound calling in it at all — so what the caller gets is a slot and a name, and what you get at nine is a card instead of a voicemail light.",
    },
    {
      q: "Does it work on the lettings side?",
      a: "For catching, qualifying and calendaring, yes: applicants, viewings, and a waitlist for the queue that forms behind every rental home. It will not quote a tenant a fee — charging one is an offence under the Tenant Fees Act — will not take a holding deposit or card details, will not do Right to Rent or any ID check, and will not tell anybody what notice they can be given while that law is mid-reform. A tenant reporting damp, no heat or a lock-out is an escalation, not a message.",
    },
  ],

  jargon: [
    "market appraisal",
    "instruction",
    "vendor",
    "applicant",
    "proceedable",
    "AIP",
    "SSTC",
    "chain-free",
    "fall-through",
    "tenure",
  ],

  missRate: {
    value: "About one call in five goes unanswered while the branch is open",
    reasoning:
      "Our estimate, from the shape of the week rather than a published figure: the 16:00–18:00 caller peak lands exactly on the after-work viewing run, and Saturday nine till one is the most concentrated demand of the week staffed by the fewest people, because the whole negotiating team is out in other people's houses. In those two windows we'd put it nearer a third. Evenings are a separate and much larger claim — see the study below. The real number for your branch is already sitting in the Saturday call report your phone provider emails you and nobody opens.",
  },

  valuePerCall: {
    value: "About £60 for each call you get back, or $75 in the US",
    reasoning:
      "The working, so you can argue with it. An average UK sale at roughly 1.4% inclusive is about £4,150 of gross fee; TwentyEA put 23.7% of agreed sales through the floor in Q1 2026, so an instruction realises nearer £3,100. Then two assumptions that are ours rather than anybody's research: that a third of booked appraisals become instructions — that ratio is on your own whiteboard and you should substitute yours — and that about one recovered call in twenty is a genuine appraisal request rather than a cancellation, a solicitor chasing a form or somebody asking whether it's still available. A third of a twentieth of £3,100 is £52, and we add a few pounds for the recovered lettings applicant and the recovered viewer, both of whom are worth far less than an agency calculator claims. The dollar figure is worked separately from a listing side on a median US sale, not converted at today's rate, which is why the two don't line up. The industry's own missed-call calculators put £2,000 on a missed call by assuming every unanswered ring was a vendor; it wasn't. And we have not multiplied any of this by a call volume — the headline annual loss is the oldest move in this category and the first thing a principal stops believing.",
  },

  citations: [
    {
      claim: "After the door is locked, the phone is answered by almost nobody in this trade.",
      publisher: "InStep AI",
      date: "2026-08-05",
      sample: "3,047 unique UK sales and lettings agency numbers called on weekday evenings 18:00–21:00 between May and July 2026, each left to ring until the receiving line ended it: 93.8% reached nobody, 4.1% were answered by a person.",
      interest: "InStep AI sells voice AI to estate agents, and the study tested evenings only — it measures a closed office, not a failing team.",
    },
    {
      claim: "Nearly a quarter of agreed sales never complete, which is why a fee is not a fee until exchange.",
      publisher: "TwentyEA",
      date: "2026",
      sample: "Agreed sales tracked to completion or collapse across TwentyEA's national record of UK residential listings, for Q1 2026: a 23.7% fall-through rate, against 24.0% a year earlier. We have the quarter the figure covers and not the day it was published, so the year is all we will assert.",
      interest: "TwentyEA sells this data to agents by subscription, and the fall-through series is its headline number.",
    },
  ],

  objection: {
    asks: "My vendors ring me because they want me. It's a relationship business. If Mrs Ackroyd rings for her feedback and gets a robot, she'll tell the whole school gate I've stopped answering my own phone. And no machine is booking a val on my behalf.",
    answer:
      "He's right, and it should be conceded before anything else — call him Ellis Kane, because his is the Kane on the board. The vendor feedback call is not the call to automate: it is fifteen minutes that turns into the price reduction conversation, and his fee depends on him having it himself. So the agent doesn't try to have it. It asks which property in the first ten seconds, tells Mrs Ackroyd that Ellis is out on a viewing and will ring her back within the hour, and puts it in front of him inside a minute with the address on it. That beats what happens now, which is a voicemail box he clears at twenty to seven. The value was never Mrs Ackroyd anyway. It is the 8:48pm applicant who found the Milton Road house on Rightmove, rang, got nothing and rang the agent marketing the house down the road — and in InStep AI's evening study of 3,047 UK agency numbers, 93.8% of weekday evening calls reached nobody, so that caller was never choosing between Ellis and a machine. On the second objection, the one about his redress scheme, the answer is to agree rather than reassure: an agent that improvises material information is a liability, and one that improvises a price is a worse one. So it doesn't improvise and it doesn't price. The pitch is not that it answers his buyers' questions. It is that it will never answer his buyers' questions — it catches the caller, asks the one question a voicemail never asks, gets them in the diary and hands him somebody worth ringing back.",
  },
};
