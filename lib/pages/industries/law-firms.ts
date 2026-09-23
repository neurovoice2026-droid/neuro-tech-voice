import { requiredPlanFor } from "@/lib/billing/entitlements";
import { PLANS } from "@/types";
import type { Trade } from "./schema";

/** Calls are recorded from this plan up; below it, only transcribed. Read off the entitlements. */
const RECORD_PLAN = PLANS[requiredPlanFor("recordings")].name;

/* ------------------------------------------------------------------ *
 * Law firms — high-street and small general practice, three to eight
 * fee earners, one person on reception.
 *
 * What makes this phone unlike the other fifteen: everywhere else an
 * intake call fails by getting too little out of the caller. Here it
 * fails by getting too much. Under ABA Model Rule 1.18 and Formal
 * Opinion 510 (2024), information taken from a prospective client —
 * someone who signs nothing, pays nothing and may never ring again —
 * can disqualify the whole firm from acting against that person in the
 * same matter. The other side is quite often the bigger instruction,
 * and there are practitioners who ring round the good firms in town
 * precisely to burn them. So the ideal legal intake call is
 * deliberately, structurally incomplete: the names, which side the
 * caller is on, what kind of matter, is there a date — then stop and
 * book. A receptionist who is good at her job in every other trade,
 * who draws the caller out and gets the whole picture, is creating a
 * liability with every extra question. An agent that is constitutionally
 * incapable of digging is not a compromise here. It is the spec.
 *
 * Which is why the wall on this page is the only one on the site where
 * the machine catches itself ASKING rather than answering. A refusal to
 * compute a limitation period is a real refusal and it stays here as
 * the perimeter — but every vendor in this category can draw a product
 * that declines to answer. None of them can draw one that stops itself
 * being helpful. The half-sentence that gets struck through is a
 * follow-up question, and the reason it is dangerous is the paragraph
 * above, made visible in four seconds.
 *
 * The second half of the difficulty: the same line carries a man whose
 * son is in a cell at two in the morning and a woman who wants a price
 * for a will, and the number on the display says nothing about which
 * is which.
 *
 * Vocabulary is checked against the profession, not a thesaurus. It is
 * a matter — never a job, and usually not a case; a conveyance is a
 * matter. A fee earner is any of a solicitor, a legal executive or a
 * paralegal, and a paralegal is not a lawyer: saying otherwise is a
 * regulatory problem, not a slip. Counsel is a barrister the firm has
 * instructed, not the firm's own solicitor, and a solicitors' firm has
 * no clerks — that is chambers. A client instructs the firm (UK) or
 * retains it (US). The worst trap is "retainer": in the US it is money
 * paid up front, in England and Wales the retainer is the engagement
 * itself and the money is money on account. And nobody who has merely
 * rung up is a client. They are a prospective client, and that
 * distinction is a conduct rule rather than pedantry.
 *
 * Money is held in two currencies on purpose. The sample call is a UK
 * firm quoting a UK fixed fee; the per-call figure is worked in pounds
 * and stated again in dollars on US matter values. Neither is the other
 * one through an exchange rate, and the reasoning says so.
 *
 * No settled ink on this page, deliberately. Nothing on a legal intake
 * call is confirmed by the end of it: the diary entry stands or falls
 * on a conflict check a human has not run yet, and the page would be
 * lying if it inked green.
 * ------------------------------------------------------------------ */

export const lawFirms: Trade = {
  slug: "law-firms",
  label: "Law firms",

  kicker: "Both partners are in court, and the phone is having its busiest hour.",
  standfirst:
    "It answers on the first ring, takes the names, which side you're on and the date on the paperwork — then stops asking, because in this trade the next question is the one that costs you.",

  prongs: [
    {
      id: "served",
      label: "Served this morning",
      does: "gets the paperwork in front of a solicitor",
      caller: "A bloke knocked on the door and handed me an envelope. It says I've got fourteen days.",
      asks: "Writes the date off the seal exactly as he reads it out and says nothing whatsoever about what fourteen days from it comes to. Takes both parties for the conflict check, then finds him the first appointment there is.",
      urgent: true,
    },
    {
      id: "open",
      label: "A matter already open",
      does: "gets the chase onto the right file",
      caller: "Is Yusuf there? He's got my mum's probate and nobody's rung me back in three weeks.",
      asks: "Doesn't discuss the matter and won't confirm to a voice it can't place that anyone is a client of yours. Puts the chase on the file with the three weeks in it and pages the fee earner — that call is one week away from being a complaint.",
    },
    {
      id: "unnamed",
      label: "Can't name the problem",
      does: "takes the names, never the story",
      caller: "It's about my dad's house and my brother. I don't even know if it's a legal thing.",
      asks: "Nobody has to know which area of law they need before they're allowed to ring you. It takes the names, which side of it she's on and the date on anything she's holding, and offers the earliest appointment. Which kind of matter it is, a solicitor decides.",
    },
  ],

  intents: [
    { chip: "they've arrested my son", reaches: "transfer_call", then: "Custody isn't booked by a machine. It names who it's connecting her to and hands the live call over." },
    { chip: "he's not brought the kids back", reaches: "transfer_call", then: "A child not returned goes to a person. It doesn't take the story and it doesn't offer Tuesday." },
    { chip: "landlord's changed the locks", reaches: "notify_team", then: "Pages whoever is on call while she's still talking. An eviction that has happened isn't an appointment." },
    { chip: "served me this morning, 14 days", reaches: "save_lead_details", then: "Writes the date off the seal exactly as he reads it. Says nothing about what fourteen days from it means." },
    { chip: "what do I need to bring", reaches: "send_sms", then: "Texts the list — photo ID, proof of address, the letter. It can't check the ID; that's a person's job." },
    { chip: "rear-ended on the ring road", reaches: "save_lead_details", then: "Takes both drivers' names and the insurer that keeps ringing her. It says nothing about what to sign." },
    { chip: "exchanging Friday, no pack yet", reaches: "take_message", then: "A completion chase, usually the agent rather than the client. Onto the file with Friday's date on it." },
    { chip: "is Yusuf there, mum's probate", reaches: "take_message", then: "Won't discuss a matter with a voice it can't place. Message on the file, and Yusuf gets paged." },
    { chip: "nobody has rung me back since Tuesday", reaches: "transfer_call", then: "An angry client is a complaint in progress. It stops booking and finds someone with authority." },
    { chip: "how much to get divorced", reaches: "search_knowledge", then: "Reads the fixed fee off your own price list. Anything that isn't on the list, a solicitor prices." },
    { chip: "is the first bit free or not", reaches: "search_knowledge", then: "Says what the first appointment costs before the diary comes out. Nobody arrives expecting free." },
    { chip: "dad's in hospital, no will", reaches: "check_availability", then: "Finds what today has left and offers it. Whether he can give instructions is a solicitor's call." },
    { chip: "I don't know what I need", reaches: "save_lead_details", then: "Can't name the area of law. Takes the parties and the date on the document; a solicitor sorts it." },
    { chip: "I act for the other side", reaches: "take_message", then: "Name, number, message, and not one substantive word. It doesn't matter how reasonable the ask is." },
    { chip: "can I move Tuesday's appointment", reaches: "find_booking", then: "Finds the appointment against the number she's ringing from before it moves anything." },
    { chip: "has my ex already rung you?", reaches: "take_message", then: "It won't confirm that anyone has rung, or that a name it hears means anything here. Message taken." },
  ],

  duration: 110,

  turns: [
    { at: 0, side: "agent", text: "Pargeter and Roe — you're through to the answering assistant. I'm not a solicitor and I can't advise, but I can take the details and get you in front of one. What's happened?" },
    { at: 11, side: "caller", text: "A bloke knocked this morning and handed me an envelope. It's a court thing — Brackmill Plant Hire are claiming six thousand off me. It says fourteen days." },
    { at: 22, side: "agent", text: "Right. I'm not going to ask you what the dispute is about — a solicitor needs to hear that, not me. Can I take your name, and the full name of the company that's claiming?" },
    { at: 33, side: "caller", text: "Wilf Standen. It's Brackmill Plant Hire Limited, the yard out on the bypass." },
    { at: 41, side: "agent", text: "Thank you. And you're the one being claimed against, not the one claiming — I have to be exact about that, it's for the conflict check. Is there a date printed on the form?" },
    { at: 51, side: "caller", text: "Being claimed against, yeah. It's stamped the fifteenth. Fourteen days from then, is that right? What happens if I just don't answer it?" },
    { at: 62, side: "agent", text: "I've written the stamp date down exactly as you read it. I'm not allowed to work out what fourteen days from it comes to, or what happens when it runs out. Anything with a court seal on it gets flagged to the team here the moment it's said, so that's gone — Duncan's the one who picks those up. Let me see what he's got." },
    { at: 77, side: "agent", text: "Half eight tomorrow morning, with Duncan Roe, before he's in court. The first appointment is a fixed £150 plus VAT — that's our published fee, and he'll set out the basis for anything after it." },
    { at: 90, side: "caller", text: "Half eight's fine. What do I need to bring — can you text it to me?" },
    { at: 95, side: "agent", text: "Sending it now: everything that came in that envelope, including the sheets you think don't matter, and the hire paperwork. And half eight is provisional until a solicitor has run the conflict check on Brackmill; if it can't stand, someone rings you this evening. Duncan has the date on the form either way." },
  ],

  toolRuns: [
    { at: 53, tool: "save_lead_details", ms: 190 },
    { at: 57, tool: "notify_team", ms: 150 },
    { at: 66, tool: "search_knowledge", ms: 320 },
    { at: 70, tool: "check_availability", ms: 460 },
    { at: 93, tool: "book_appointment", ms: 720 },
    { at: 100, tool: "send_sms", ms: 540 },
  ],

  rig: {
    title: "Enquiry sheet",
    form: "matter",
    fields: [
      { id: "parties", label: "Parties, for the conflict check", value: "Wilf Standen · Brackmill Plant Hire Ltd", at: 37, from: "caller", onPhone: true },
      { id: "side", label: "Which side he's on", value: "Defendant — the one being claimed against", at: 53, from: "caller", onPhone: false },
      { id: "dates", label: "Date on the form", value: "Sealed the 15th · the form says fourteen days", at: 54, from: "caller", onPhone: true },
      { id: "matter", label: "Kind of matter", value: "Civil dispute — plant hire charges, claim served", at: 55, from: "save_lead_details", onPhone: true },
      { id: "flagged", label: "Flagged to the team", value: "Gone, while Wilf was still talking", at: 59, from: "notify_team", onPhone: false },
      { id: "diary", label: "In the diary, provisional", value: "Tomorrow 08:30 · Duncan Roe · check pending", at: 94, from: "book_appointment", onPhone: true },
      { id: "texted", label: "Texted to Wilf", value: "What to bring · and that 08:30 isn't confirmed", at: 101, from: "send_sms", onPhone: false },
    ],
    receipt: "Both parties down for the conflict check, and the date off the seal exactly as he read it. Not one line about what the dispute is actually about. Half eight is held, not confirmed — and Wilf was told so twice.",
  },

  wall: {
    never: "ask you what happened — or tell you whether you're still in time",
    clause:
      "Never state, estimate or confirm a time limit, limitation period or filing deadline, and never say whether a caller is in or out of time — including when the caller states the rule themselves and asks you only to agree. Record any date the caller reads out, verbatim. Ask for the names of everyone involved, which side the caller is on, the kind of matter and any date on their paperwork, and nothing else. Do not ask what happened, do not ask a follow-up about the substance, and do not draw the caller out — including when one more question would plainly help you.",
    clauseSource:
      "the system prompt, enforced on our servers — where neither the caller nor a well-meaning member of your staff can edit it mid-call",
    detents: [
      {
        caller: "The letter's dated the second and it gives me till the twenty-fourth. Have I still got time or not?",
        agent: "I've got both dates down exactly as you read them. Whether they leave you in time is a solicitor's call, not mine.",
      },
      {
        caller: "It's a yes or a no. I've looked it up, I know what it says. Just tell me I'm not imagining it.",
        agent: "I'm not allowed to do that arithmetic, even when it looks like arithmetic. What I can do is get you in front of an employment solicitor first thing.",
      },
      {
        caller: "Then let me just tell you the whole thing and you'll see it's nowhere near out of time. It started back in March, when the new manager—",
      },
      {
        caller: "So you won't answer me and you won't listen to me either. What use are you?",
        agent: "Not much on that question, and I'd rather be no use than wrong about a date. Let me put you through to our office manager — if the date is pressing, she's the one who can move something today.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "And what did he actually say to you when he sacked y",
      instead:
        "— no. I shouldn't have asked that and I'm not going to finish it. What you tell me about what was said to you is the one thing that can conflict this firm out of ever acting for the other side of it, and that is not a decision a phone gets to make at twenty to five. So: your name, their name, which side you're on, and the dates off the letter. A solicitor hears the rest from you, first and once, Tuesday at ten past nine.",
    },
    crosses:
      "The only thing that gives under pressure is the arguing. A caller who needs a date ruled on today gets a person rather than a better-worded refusal — waiting until Monday to find out whether the clock has run is the one thing on this page that can genuinely cost somebody their claim.",
  },

  relay: {
    because:
      "Three calls stop being intake the moment they start: someone in police custody or ringing about someone who is, anyone with a hearing today or tomorrow, and an existing client who is angry — that last one is a complaint in progress and it needs a person with authority, not an appointment. It pages before it puts anyone through, because in a firm where both partners are in a court building the person who ought to take that call is rarely the person who would pick up.",
    who: "the fee earner on your transfer list, or the duty solicitor if you keep a rota",
    by: ["take_message", "notify_team"],
    carries: [
      "the name they gave and the number the phone is ringing from",
      "every other name they mentioned, so the conflict check can start before anybody rings back",
      "what they volunteered, untidied — and nothing the agent went and asked for",
    ],
    seconds: 6,
  },

  rules: [
    {
      label: "Names of everyone involved, on every enquiry",
      changes: "The parties and which side the caller is on come before the diary does, so a conflict check can start before anyone rings back.",
      on: true,
    },
    {
      label: "Say the fee before you offer a time",
      changes: "It reads your published fixed fee off your own documents and says it out loud first, so nobody arrives on the day believing the first half hour is free.",
      on: true,
    },
    {
      label: "Put custody calls through to my mobile, day or night",
      changes: "At eleven on a Saturday a custody call rings you instead of sitting in an inbox until Monday morning.",
      on: false,
    },
  ],

  ink: { ember: false, settled: false },

  faq: [
    {
      q: "Can it run a conflict check?",
      a: "No. It takes the names of everyone involved and which side the caller is on, and stops there; a person runs the check against your files. That is also why nothing it says is a confirmation. The appointment sits in the diary as provisional, and the caller is told that out loud and again in the text — because a firm that has to ring someone back and unbook them has a much easier conversation when it never promised in the first place.",
    },
    {
      q: "They'll start telling it the whole story anyway. Doesn't that conflict me out regardless?",
      a: "Less than you think, and the difference is the question that never gets asked. A caller who volunteers three minutes of narrative has told you what they chose to tell you; a caller who is drawn out with “and had he done that to anyone else?” has been walked through the parts that are actually significantly harmful, which is the Rule 1.18 exposure. So it does not interrupt, it does not probe, and the enquiry sheet holds the parties, which side, the kind of matter and any date they read out — nothing else. Where it is honest to be uncomfortable: the call itself is transcribed — and recorded, on " + RECORD_PLAN + " and above — and either is information received. That is your retention policy's problem, not a thing a vendor can wave away, and this is the one trade where we would tell you to set that policy short and mean it.",
    },
    {
      q: "Will it say anything at all about a time limit?",
      a: "No — and not even to agree with a caller who has already looked it up. The rule people find online is three months less a day; what they don't find is early conciliation stopping the clock, or the effective date of termination not being the day somebody was told to go. Being confidently wrong about a date is how a prospective client is reassured out of the door and how a complaint arrives instead. It writes the date down as the caller reads it and gets them booked.",
    },
    {
      q: "Can it tell an existing client where their matter is up to?",
      a: "No. It does not discuss a matter, it will not confirm to a caller that a named person is a client of the firm, and it cannot take instructions. It puts the message on the file with what they actually said in it and pages the fee earner. Ask any practice what its complaints are really about and it is hardly ever the legal work — it is the three weeks of silence, and it starts life as the third unreturned chase.",
    },
    {
      q: "Legal enquiries carry special category data. What happens to the call?",
      a: "It is transcribed and the transcript sits with the enquiry, so a partner can read exactly what was asked and what was refused. Before you switch it on, that transcript is a document your DPO has a view about: health, criminal allegations and Article 10 offence data arrive on the first call in this trade. The AI disclosure in the opening line is not a setting and cannot be turned off; the recording notice is a switch, and in a two-party-consent state you turn it on.",
    },
  ],

  jargon: [
    "matter",
    "fee earner",
    "conflict check",
    "prospective client",
    "money on account",
    "client care letter",
    "disbursements",
    "the other side",
    "limitation period",
    "DX",
  ],

  missRate: {
    value: "About three calls in ten go unanswered while somebody is in to answer them",
    reasoning:
      "Our estimate, in staffed hours only, from the shape of the week rather than a published figure: the busiest hour of a small firm's week is 10 to 11, which is also the hour a litigator is most likely to be in a court building with the phone off; the phones go to answerphone deliberately between one and two; and one person on reception already on a ten-minute call is a busy signal for everyone else in those ten minutes. Out of hours is a separate and much larger claim — from five on Friday to nine on Monday most small firms answer nothing at all, which is arithmetic rather than a statistic. There is a $109-billion-a-year figure circulating for this trade with no published workings behind it; we are not going to print it. Nor should you take ours on trust — a fortnight of your own numbers settles it, and we would much rather be corrected than believed.",
  },

  valuePerCall: {
    value: "About £70 for each call you get back, or $90 on US fees",
    reasoning:
      "Ours, and it carries every call that is worth nothing. A first matter actually instructed averages about £2,000 — a will is a few hundred, a residential conveyance more, a modest probate more again. Roughly one inbound call in five is a genuine new enquiry rather than a client chasing, an estate agent, the other side, the court or somebody selling you search-engine work. Three in ten of those enquiries instruct, and we treat six in ten of the missed ones as gone for good, because most voicemails are never returned and a person with a legal problem rings the next firm on the page. £2,000 × 20% × 30% × 60% is £72. The $90 is the same arithmetic on a $2,500 US matter, held as a separate figure rather than converted — we are not running an exchange rate through a page about honest numbers. Seven of every eight recovered calls are worth nothing directly, and that is the point of the figure. Personal injury and criminal defence run four to ten times it and deserve their own number; a wills-and-conveyancing practice is under half. Multiply it by your own volume if you like — we are not going to print the total for you.",
  },

  citations: [
    {
      claim: "Four in ten prospective clients don't reach a person, and most of them never hear back.",
      publisher: "Clio, Legal Trends Report",
      date: "2019-10",
      sample:
        "A third-party mystery shop of US firms advertising family, criminal, bankruptcy, employment and business work: 500 phone calls and 1,000 emails. 56% of calls were answered by a person, 39% went to voicemail, and 57% of the voicemails left had no callback inside 72 hours.",
      interest: "Clio sells practice-management software to law firms.",
    },
  ],

  objection: {
    asks: "My callers have just been arrested, or their mother's died. They need a human being. And if that thing says one word that sounds like advice, it's my practising certificate on the line, not yours.",
    answer:
      "Both halves are true, and neither is an argument for the answerphone that is there now. Start with the part he hasn't said, because it is the bigger risk: in this trade the danger on an intake call is not what the phone says, it is what it hears. Rule 1.18 and Opinion 510 mean a prospective client who never signs anything and never pays a penny can conflict the firm out of acting against them — and the other side is often the larger instruction. The receptionist who is genuinely good at her job, who draws the caller out and gets the whole picture, is manufacturing that exposure with every extra question. This one cannot dig. It takes the parties, which side, the matter type and any date, and stops, which is what Opinion 510 says intake ought to do anyway. It has no view on merits, offers none, quotes nothing beyond the fees you publish, clears no conflicts and accepts no instructions. On the calls he is describing — custody, a child at risk, a bereavement, a hearing tomorrow — it doesn't try; it hands over mid-sentence. And every call is transcribed and sits with the enquiry, so a partner can read exactly what was said, which is more than can be said for the note the junior took last Tuesday. It is not competing with him at 4:40 on a Friday. It is competing with nothing.",
  },
};
