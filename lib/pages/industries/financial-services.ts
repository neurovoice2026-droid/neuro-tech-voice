import { requiredPlanFor } from "@/lib/billing/entitlements";
import { PLANS } from "@/types";
import type { Trade } from "./schema";

/** Calls are recorded from this plan up; below it, only transcribed. Read off the entitlements. */
const RECORD_PLAN = PLANS[requiredPlanFor("recordings")].name;

/* ------------------------------------------------------------------ *
 * Financial services — accountancy practices, mortgage brokers, IFAs.
 *
 * What makes this trade's phone unlike the other fifteen: its calendar
 * is written by the state, and the whole client base is on it at once.
 * 31 January. 5 April. 15 April. The 19th of the month. The quarter's
 * VAT date. Nine months after each company's own year end. HMRC's own
 * January 2026 release had 5.65 million of twelve million-plus returns
 * still outstanding with twenty-six days to go, and 732,498 people
 * filed on the final day of the previous cycle. That is not demand
 * arriving as it pleases. That is one client base ringing in one
 * fortnight about one date — the fortnight this trade deliberately
 * stops answering the phone, because the work behind the date is a
 * four-hour concentration task where a mistake is a liability.
 *
 * So the page is built on the deadline rather than on the letter.
 * Law firms own the caller holding a dated letter, and own the intake
 * that fails by hearing too much. This one owns the day everybody
 * shares: the call that arrives at ten past four on the twenty-ninth
 * of January, from somebody who is not yet a client, about a date the
 * practice did not set and cannot move.
 *
 * Three decisions worth writing down, because each of them makes the
 * page less impressive on purpose.
 *
 * Nothing is booked on the sample call. A practice in the last week of
 * January does not take a new self assessment on at the switchboard,
 * and a page that showed a tidy green confirmation would be selling
 * the one thing this product cannot do. Hence no settled ink — and no
 * ember either, for a reason that is not squeamishness: ember promises
 * a same-day rescue, and the agent cannot file anything, cannot say
 * whether a penalty stands, and cannot make the thirty-first. What it
 * can do is get a human to the caller before the day ends, which is
 * worth showing honestly and not worth colouring.
 *
 * It asks for a turnover band and never a figure. The band sets the
 * fee range; income, debts, dates of birth and national insurance
 * numbers are the fact-find, and the fact-find is the meeting.
 *
 * Money is quoted in two currencies that were worked out separately
 * rather than one converted at today's rate, because the conversion
 * would be the only number on the page we hadn't actually built.
 *
 * Vocabulary is checked against the trade. A company's year end is not
 * 5 April, and saying otherwise ends the call. The annual return was
 * abolished in 2016; it is a confirmation statement. Small clients are
 * not "audited" — an audit is a statutory engagement most of them do
 * not have, and the thing the caller is frightened of is a compliance
 * check or an enquiry. A DIP is not an offer and an offer is not
 * money. An extension is an extension to file, not to pay. And nobody
 * here quotes a fee; they give a fee range, because a number said on
 * the phone is a number the client will hold you to.
 * ------------------------------------------------------------------ */

export const financialServices: Trade = {
  slug: "financial-services",
  label: "Financial services",

  kicker: "It's the twenty-ninth, and you're forty minutes into the agent line.",
  standfirst:
    "It answers every line at once in the fortnight you cannot staff, writes down who rang, what they do and the date they're up against, and puts it in front of the person who is allowed to answer it. No view, no number, and no promise about a date you don't control.",

  prongs: [
    {
      id: "deadline",
      label: "The date everybody shares",
      does: "takes the whole fortnight's calls at once",
      caller: "It's the twenty-ninth and I haven't done my return. Can anybody still take it on?",
      asks: "Answers on the first ring in the two weeks your phone is unstaffed on purpose, takes what a preparer needs before deciding — trade, turnover band, whether they've ever filed — and pages a person while the caller is still talking. It says nothing about whether the date can be met, because it isn't the one who'd have to meet it.",
      urgent: true,
    },
    {
      id: "third-party",
      label: "Somebody who isn't your client",
      does: "tells a lender nothing at all",
      caller: "It's Nationwide — I need an accountant's certificate for a Mr Hendry, and it's urgent this end.",
      asks: "Takes the lender, the name and the number, and confirms nothing: not the document, not the date they want it by, and not that the name means anything to you. Whoever rings back can check what authority is actually on file first.",
    },
    {
      id: "evening",
      label: "After you've shut",
      does: "takes the evening ones you never hear",
      caller: "Sorry, I know you're closed — my fix ends in March and I can't ring about it from my desk.",
      asks: "Half seven on a Tuesday is when an employed caller is finally free, and it is the hour your voicemail box does its worst work. It answers, offers the next two times the diary has free, and holds no view whatsoever on whether March is a good month to be doing anything.",
    },
  ],

  intents: [
    { chip: "it's the thirtieth, am I too late", reaches: "notify_team", then: "A date inside the window you set reaches a person mid-call. Whether it can still be done is theirs to say." },
    { chip: "has my return actually been filed", reaches: "take_message", then: "A voice on a phone isn't identification. The question goes to the preparer, who knows who she is." },
    { chip: "my offer expires on the 14th", reaches: "notify_team", then: "An expiry inside the week reaches the broker on the spot, rather than waiting on a voicemail box." },
    { chip: "is now a good time to fix", reaches: "check_availability", then: "Offers the next two times the diary has free. It holds no view on rates and can't be argued into one." },
    { chip: "which statements do you still need", reaches: "take_message", then: "What's outstanding sits on her file, which nothing here can read. It goes to whoever is chasing her." },
    { chip: "gone self-employed, no idea", reaches: "save_lead_details", then: "Trade, turnover band and the date she started — what you need before anybody mentions a fee." },
    { chip: "Nationwide, after a certificate", reaches: "take_message", then: "A lender gets nothing, including whether the name it just said means anything here. Message taken." },
    { chip: "payroll's Thursday and nobody's answered", reaches: "notify_team", then: "Reaches a named owner during the call. It doesn't try to resolve it and doesn't apologise for you." },
    { chip: "my mum died, there's her ISAs", reaches: "transfer_call", then: "Stops and puts a person on. If the transfer doesn't land it takes it gently and flags it to you." },
    { chip: "roughly what do you charge?", reaches: "search_knowledge", then: "Reads the range off your own price list. A range, never a number, and then the earliest time free." },
    { chip: "IRS notice about 2024, is that bad", reaches: "get_call_context", then: "Gets today's date before anything else. A notice window is counted in days; it won't guess at day one." },
    { chip: "sold a flat in June, tell you now?", reaches: "save_lead_details", then: "Writes the sale date down exactly as she says it. It holds no view on which year it belongs in." },
    { chip: "just go ahead and file it", reaches: "take_message", then: "An instruction isn't accepted by a phone. Her words are stored as she said them and a person owns it." },
    { chip: "can I move Thursday's year end", reaches: "find_booking", then: "Finds the meeting under the number she's ringing from before it moves anything." },
    { chip: "here's my new bank details", reaches: "take_message", then: "Stops her. Bank details are never taken, confirmed or amended — somebody rings her back instead." },
    { chip: "don't want a machine, get a person", reaches: "transfer_call", then: "First time of asking, and it doesn't ask what it's regarding. A line with no way out is the harm." },
  ],

  duration: 106,

  turns: [
    { at: 0, side: "agent", text: "Brandreth Kyle — you're through to the answering assistant, and the call's recorded. What's it about?" },
    { at: 7, side: "caller", text: "It's the twenty-ninth today, isn't it. I haven't done my tax return and I've a carrier bag of receipts. Can somebody do it by Saturday?" },
    { at: 17, side: "agent", text: "I'm not going to tell you yes to that — it isn't mine to promise. What I can do is put it in front of the person who decides, before the day's out. Can I take your name?" },
    { at: 28, side: "caller", text: "Gethin Arrowsmith. I'm a sole trader — dry lining, ceilings, that sort of thing." },
    { at: 36, side: "agent", text: "Two questions and then I'll stop asking. Have you filed one before, and is your turnover under fifty thousand, fifty to a hundred and fifty, or above that? The band sets the fee range and nothing else — I won't ask you anything else about your money." },
    { at: 52, side: "caller", text: "Did the last two myself. Under fifty, nowhere near it." },
    { at: 58, side: "agent", text: "A sole trader return here runs three hundred and fifty to six hundred plus VAT. That's a range on purpose — nobody's seen the carrier bag yet, and a number said on the phone is one you'd be right to hold us to." },
    { at: 71, side: "caller", text: "Right, but can it actually be done by Saturday? Everyone keeps telling me I'll be fined." },
    { at: 77, side: "agent", text: "That's the part I'm not allowed to answer, and you'd be right not to believe me if I did. It's two working days, so it's gone to Bronwen rather than into the callback pile — she's had it while we've been talking." },
    { at: 90, side: "caller", text: "And if she says no?" },
    { at: 93, side: "agent", text: "Then she says no today, instead of you finding out on Monday. That's the only thing I'm promising you, and it's the only one I'm allowed to. I'll text you the two things to have in front of you when she rings." },
  ],

  toolRuns: [
    { at: 3, tool: "get_call_context", ms: 90 },
    { at: 55, tool: "search_knowledge", ms: 340 },
    { at: 62, tool: "save_lead_details", ms: 210 },
    { at: 74, tool: "notify_team", ms: 160 },
    { at: 99, tool: "send_sms", ms: 620 },
  ],

  rig: {
    title: "File note",
    form: "consult",
    fields: [
      { id: "opened", label: "Time, and who rang whom", value: "Thu 29 Jan, 16:06 · inbound", at: 4, from: "get_call_context", onPhone: false },
      { id: "date", label: "The date he's up against", value: "The 31st — “by Saturday”", at: 9, from: "caller", onPhone: true },
      { id: "who", label: "Who rang", value: "Gethin Arrowsmith · sole trader, dry lining", at: 30, from: "caller", onPhone: true },
      { id: "band", label: "Turnover band, for the fee range only", value: "Under £50k · no other figure asked for", at: 54, from: "caller", onPhone: false },
      { id: "fee", label: "Fee range, as you publish it", value: "£350–£600 + VAT · sole trader return", at: 56, from: "search_knowledge", onPhone: true },
      { id: "history", label: "On file before anyone rings back", value: "First return with us · filed his own last two", at: 63, from: "save_lead_details", onPhone: false },
      { id: "owner", label: "Who has it now", value: "Bronwen, on call · alert delivered 16:07", at: 75, from: "notify_team", onPhone: true },
    ],
    receipt:
      "Timed, named, banded, and with Bronwen before he'd hung up. The one thing nobody answered is whether Saturday can be met — and he heard that at ten past four, not from a voicemail on Monday.",
  },

  wall: {
    never: "tell you whether you're still in time",
    clause:
      "You do not rule on dates. You may read back a deadline the business has published and you may record a date the caller reads to you, but you must not say whether a caller has met one, has missed one, is inside a window, will incur a penalty or interest, or has time to get something to you. Any question of the form \"am I alright\" or \"have I still got time\" is answered by putting it in front of a person the same day, never by answering it.",
    clauseSource:
      "the system prompt, applied server-side on every call — it is not a toggle in your settings and the caller cannot talk it off",
    detents: [
      {
        caller: "If I get the paperwork over to you next week, am I still alright?",
        agent: "That's a date question, and dates are the one thing I'm not allowed to be nearly right about. What I can do is get it in front of Bronwen today rather than Thursday.",
      },
      {
        caller: "It's a yes or no. Have I got time or haven't I?",
        agent: "It reads like a yes or no and it almost never is one. There's usually more than one date on the same bill, and they don't all fall on the same day.",
      },
      {
        caller: "It's on your own website. The deadline's the thirty-first and today is the twenty-eighth. You can do that arithmetic.",
      },
      {
        caller: "So nobody in your office can tell me if I'm late. Brilliant.",
        agent: "Somebody can, today. That's the whole reason I'm not doing it from the phone — you'd act on my answer, and you can't act on hers until she's looked. Bronwen has your reference and the date off your letter. Putting you through.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "Then you're well inside it, nothing lands on you before the filing dead",
      instead:
        "— I can't tell you whether you're in time. The date on the website is the one everybody watches, and it is routinely not the one that bites: a payment on account can fall due the same day as the balance, and being on time for one is not being on time for the other. If I told you that you were fine and you weren't, you would have heard it from us. Bronwen has your reference and the date off your letter, and she will tell you today which dates are actually yours.",
    },
    crosses:
      "One thing does cross it, and it is not the loudest caller. A date inside three working days stops being a message and becomes a person's afternoon — it does not wait for Thursday's appointment and it does not sit in an inbox overnight.",
  },

  relay: {
    because:
      "Three calls stop being calls the moment they start: a bereavement, or anyone frightened, ill or being leant on about money; a complaint, where the clock starts when you receive it and not when you get round to reading it; and any instruction to actually do something — file it, switch it, cancel the direct debit. None of the three is finished by a phone.",
    who: "the partner you named for complaints and for vulnerable callers, rather than whoever is sitting nearest the phone",
    by: ["take_message", "notify_team"],
    carries: [
      "who rang, the number it came from, and the minute the clock started",
      "what they actually said, not a tidied version of it",
      "the date printed on whatever they are holding, where there is one",
      "which of your rules it matched, so nobody has to work out why they were paged",
    ],
    seconds: 6,
  },

  rules: [
    {
      label: "Anything with a date inside three working days comes to me, not the inbox",
      changes: "It sets the date the caller gives against today's, works out that it's inside the window, and pages you mid-sentence. On the twenty-ninth of January that is most of the phone.",
      on: true,
    },
    {
      label: "Never confirm someone is a client — not to a lender, not to a spouse",
      changes: "A lender's office gets a message taken and nothing else, including whether the name it just said means anything here.",
      on: true,
    },
    {
      label: "After five, put mortgage callers through to my mobile until eight",
      changes: "The evening ones — the people who can't ring from their desk — reach you instead of a voicemail box you clear on Monday.",
      on: false,
    },
  ],

  ink: { ember: false, settled: false },

  faq: [
    {
      q: "It's the last fortnight of January. Does it cope with that, or does it fall over like everything else?",
      a: "It answers every line at once and nothing about it slows down on the thirtieth, which is the part your phone system cannot do, because your phone system is three people and one of them has been on the agent line since two. What it will not do is get better at the thing that fortnight is actually about: it cannot file anything, cannot tell a caller whether theirs is filed, and cannot say whether a penalty will stand. For those two weeks it is a machine for writing down who rang, what they do and the date they're up against — so that nobody is reconstructing it on 1 February.",
    },
    {
      q: "Will it tell a client their return has been filed?",
      a: "No, and this is the one owners argue with. It has no way of knowing that the voice on the phone belongs to the person whose file it is, and a voice is not identification — not to HMRC, not to the IRS, not to your own body. So a status check becomes a note for the preparer, who does know her, with the callback the same day. To a third party — a lender, a solicitor, a spouse, a bookkeeper — it will not even confirm that the name means anything to you.",
    },
    {
      q: "What does it write down, and what won't it?",
      a: "Name, number, what they're ringing about, the trade, whatever date they're working to, and a turnover band when there's a fee range to give — the band, never the figure, because the band is all the range needs. Not income, not debts, not date of birth, not a national insurance or social security number, and never bank or card details: it will not take them, confirm them or amend them, because invoice redirection runs down a telephone line. A reference read off the top of a letter, yes. The fact-find, no. The fact-find is the meeting.",
    },
    {
      q: "Where do the calls end up? My compliance file needs them.",
      a: "Every call is transcribed, and on " + RECORD_PLAN + " and above recorded too, against your retention policy, with the time, the number, who rang whom and what was said — which is most of what an analogous note is required to contain, and more than survives of the call somebody took standing up last Tuesday. Two honest caveats. The FCA's own finalised guidance treats an automated phone system with no route to a person as poor practice, so the route out is on every call and anyone who asks for a human gets one at the first attempt. And you remain responsible for us: a service provider under the FTC Safeguards Rule in the US, a processor under UK GDPR, someone of yours named to supervise it.",
    },
  ],

  jargon: [
    "UTR",
    "payments on account",
    "the 64-8",
    "confirmation statement",
    "CT600",
    "SA302",
    "compliance check",
    "DIP",
    "ERC",
    "fact-find",
  ],

  missRate: {
    value: "About one call in five goes unanswered in staffed hours",
    reasoning:
      "Our estimate, and worth saying plainly: nobody publishes a real one. The figures you'll find attributed to AICPA or Accounting Today sit on vendors' blogs with no study, no date and no sample behind them, and we're not going to repeat them. Ours comes from the shape of the week — the line held by your own thirty-to-seventy-five-minute call to an agent line or an underwriter that you cannot afford to drop, the closed-door meetings either side of it, and 13:00, reliably the worst answer-rate hour of the day, because the self-employed ring on their lunch break and so do you. In the last fortnight of January we'd say a third, and we wouldn't be surprised to be told it was worse. If you want a number that is actually about your practice, count a fortnight in January and a fortnight in June: the gap between the two is the thing worth knowing.",
  },

  valuePerCall: {
    value: "About £60 a recovered call in the UK, about $75 in the US",
    reasoning:
      "Ours, and it assumes most recovered calls are worth nothing at all. Of a hundred missed ones, roughly twenty are a genuinely new enquiry rather than an existing client, a lender, a solicitor or somebody selling you R&D claims. About half of those book a meeting, because they are ringing three practices this morning; about half of those go on to engage. Five in a hundred, then, against a first-year fee of £1,200 for a small limited-company client — annual accounts, the CT600, the director's own return — which is £60. The US figure is built the same way from a $1,500 first year and comes out near $75; it is not the pound figure converted, and we would rather show both than average them. A mortgage case runs higher, since a procuration fee on a £250,000 loan does most of the work. Advice runs lower, because far more of an adviser's phone is people who are already clients. We've credited one year, not the seven these relationships actually run, and we are not multiplying any of it by your call volume. What none of it prices is the client who rang three times, got through on the third, and is now saying your name at a barbecue.",
  },

  citations: [
    {
      claim: "This phone runs on a calendar the caller did not choose and cannot move.",
      publisher: "HM Revenue & Customs, press release",
      date: "2026-01-05",
      sample:
        "Self assessment for the 2024-25 tax year: 5.65 million of the twelve million-plus returns expected were still outstanding on 5 January, twenty-six days from the 31 January deadline. In the previous cycle 732,498 people filed on deadline day itself.",
    },
    {
      claim: "How fast an enquiry is answered changes whether it ever becomes business — measured on web forms, not on telephones.",
      publisher: "Harvard Business Review — Oldroyd, McElheran and Elkington, \"The Short Life of Online Sales Leads\"",
      date: "2011-03",
      sample:
        "1.25 million sales leads across 59 US companies, timed from web enquiry to the first contact attempt; the odds of qualifying a lead fell sharply between a five-minute and a thirty-minute response. It measured forms, not inbound calls, and we use it for direction only.",
    },
  ],

  objection: {
    asks: "So it says one thing that sounds like advice, and it's my permissions on the line, not yours. Who's holding the file when the Ombudsman asks what was actually said on that call?",
    answer:
      "You are, and you always were — nobody can sell you out of that, and any vendor implying otherwise is telling you something that won't survive a visit. That is the only line of compliance this page is going to spend. What can be done is to make the thing structurally incapable of what you're afraid of: it holds no view on a rate, a product, a liability or a timing, it cannot be argued into one, and \"should I\" makes it stop and book rather than answer. Then weigh that against what you have now. The riskiest call in your practice this week is not the one an assistant took. It's the one that rang out at twenty to seven on a Thursday, went to a voicemail nobody transcribed, and comes back in three weeks as a client's recollection of a conversation you have no record of, because it never happened.",
  },
};
