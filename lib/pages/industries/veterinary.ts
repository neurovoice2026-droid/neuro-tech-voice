import { requiredPlanFor } from "@/lib/billing/entitlements";
import { PLANS } from "@/types";
import type { Trade } from "./schema";

/** Calls are recorded from this plan up; below it, only transcribed. Read off the entitlements. */
const RECORD_PLAN = PLANS[requiredPlanFor("recordings")].name;

/* ------------------------------------------------------------------ *
 * Veterinary — first-opinion small-animal practices.
 *
 * What makes this trade unlike the other fifteen: everywhere else the
 * caller knows what is wrong. Here the caller is a bystander describing
 * a patient who cannot speak, using the most ordinary words in the
 * language — and the two most lethal emergencies in small-animal
 * practice arrive disguised as the dullest sentences anyone says on a
 * phone. "He keeps going to his tray and nothing's coming out" is a
 * blocked cat that is dead by Thursday. "She's trying to be sick and
 * nothing's coming up" is a stomach that has already turned over.
 * Neither caller thinks they have an emergency, and both are being
 * perfectly reasonable.
 *
 * The person who hears it is the least clinically trained member of
 * staff in the building, and professional regulation forbids her from
 * forming an opinion about what she just heard. Her job is to carry a
 * life-or-death judgement across the room without ever making it. Then,
 * on the same line, in the same hour, ten seconds after a flea
 * treatment reorder, somebody rings to arrange the death of a member of
 * their family and cannot get the word out.
 *
 * Vocabulary, checked against the practice and not a thesaurus.
 * "Surgery" means the building or the session — evening surgery — not
 * only an operation, and getting that wrong is an instant tell.
 * Speying is females, castration is males. It is a jab, not a shot; a
 * booster, not a yearly shot. An RVN is a registered veterinary nurse
 * and never an assistant, and a nurse clinic is a real, separate,
 * cheaper booking type. It is "put to sleep", or PTS, and "put down"
 * only after the owner has said it first. "Pet parent" is US corporate
 * and is openly mocked in British practices — owner, or client. And
 * nothing on this page calls a live call "routine": in this trade that
 * word is a clinical claim, and it is not ours to make.
 * ------------------------------------------------------------------ */

export const veterinary: Trade = {
  slug: "veterinary",
  label: "Veterinary",

  kicker: "It's 8.50. Eight ops to admit, and every hand in the building is full.",
  standfirst:
    "It answers on the first ring, writes the owner's sentence down exactly as she said it without deciding what it means, and puts the animal in the book — then hands you every call that has stopped being a booking.",

  prongs: [
    {
      id: "today",
      label: "Wants seeing today",
      does: "gets him in front of a vet today",
      caller: "He's off his food since last night and he's just not himself. I don't know if it can wait.",
      asks: "Takes the words down unaltered — not himself, not right — and looks at what today still has in it. It books the vet rather than the nurse, because that is the cheap mistake; whether it could have waited is never its sentence.",
      urgent: true,
    },
    {
      id: "book",
      label: "Changes the book",
      does: "moves the op, frees the slot",
      caller: "He's in for his dental on Thursday but we're away that week — can we shift it?",
      asks: "Finds the op on the list before it touches anything, moves it, and tells the desk the same minute. Thursday's theatre hour goes back on the board while there is still time to fill it, instead of being found empty at 8am on the day.",
    },
    {
      id: "round",
      label: "New in the area",
      does: "takes her details, quotes your own list",
      caller: "We've just moved here. Are you taking clients, and what do you charge to spay a spaniel?",
      asks: "Takes her details, then reads the bitch spay off your published price list — your figure, not a range it invented — and asks which practice holds the history, so somebody can send for it. A family that has just moved is not a price enquiry: it is the longest relationship on your books, and it starts with whether anybody picked up.",
    },
  ],

  intents: [
    { chip: "nothing's coming out in his tray", reaches: "transfer_call", then: "Straining in the tray is on the list your vets wrote. It hands over before it books anything." },
    { chip: "trying to be sick, nothing comes", reaches: "transfer_call", then: "It doesn't name it and it doesn't book it. A person, mid-sentence if that's where it lands." },
    { chip: "he's just not himself", reaches: "check_availability", then: "ADR is not a diagnosis and it is not nothing. It looks at today and writes her words down whole." },
    { chip: "he's had a bar of chocolate", reaches: "save_lead_details", then: "Takes his weight, the time, how much, and the cocoa percentage off the wrapper. Advises nothing." },
    { chip: "I think it's time", reaches: "take_message", then: "Stops offering slots. A named person rings back — a death does not go in the book by machine." },
    { chip: "more of Bella's tablets", reaches: "take_message", then: "Logs the repeat for a vet to approve. It cannot approve one and never says it will be ready." },
    { chip: "booster due, lost her card", reaches: "check_availability", then: "Offers what today has free, then books it. Which jab she's had is read off the record by a human." },
    { chip: "I've been on hold twice today", reaches: "check_availability", then: "One line of apology, then a slot. It doesn't explain why nobody picked up the first two times." },
    { chip: "how much to spay a cocker?", reaches: "search_knowledge", then: "Reads the bitch spay off your published list — one figure, yours — and offers the pre-op consult." },
    { chip: "just moved here, taking clients?", reaches: "save_lead_details", then: "Takes her details into your new-client fields, and asks which practice holds the history." },
    { chip: "cat in the road, not mine", reaches: "transfer_call", then: "Not your client, not a booking, not a machine's call. A person, first ring, no questions asked." },
    { chip: "has he gone down yet?", reaches: "transfer_call", then: "Holds for the ward nurse. How an anaesthetic went is a sentence only a person gets to say." },
    { chip: "move his dental to next week", reaches: "find_booking", then: "Finds the op on the list before it moves anything, then puts Thursday's theatre hour back." },
    { chip: "can't make Saturday's nurse check", reaches: "cancel_appointment", then: "Frees the nurse slot, once it has found the booking under her number. Telling the desk is a person's job." },
    { chip: "ring me if you get a cancellation", reaches: "add_to_waitlist", then: "Waitlists her with the days she can do. You ring her — it cannot ring anybody back." },
    { chip: "do you see rabbits?", reaches: "search_knowledge", then: "Reads your species list. If you don't see exotics it says so instead of booking one in." },
  ],

  duration: 88,

  turns: [
    { at: 0, side: "agent", text: "Larkfield Veterinary Surgery — you're through to the answering assistant. Who's calling, and which animal is it about?" },
    { at: 9, side: "caller", text: "Jo Beckett. It's Milo, my lurcher. He's just not himself. He's not right, and I don't know if it can wait." },
    { at: 19, side: "agent", text: "I'll write that down in your words — not himself, not right. Whether it can wait is a vet's call and not mine." },
    { at: 26, side: "caller", text: "He's not eaten since last night and he's shaking. Is that bad? Should I be worried?" },
    { at: 34, side: "agent", text: "I'm not able to tell you that and I won't guess at it. What I can do is get you in front of a vet today. Has he had anything he shouldn't?" },
    { at: 44, side: "caller", text: "Not that I know of. He was fine at teatime yesterday." },
    { at: 50, side: "agent", text: "Thank you. Let me see what's left today." },
    { at: 57, side: "agent", text: "There's a vet consult at ten past five, on Amara's list. If you'd rather speak to somebody here before then, I'll put you through now instead." },
    { at: 66, side: "caller", text: "No, ten past five's fine. I'll get out of work." },
    { at: 71, side: "agent", text: "Booked, ten past five with Amara. The note she reads before she opens the door says: not himself, not right, not eaten since last night, shaking. The desk has been told, and you'll get a text with the time and the consult fee — if anything changes before five, ring us back." },
  ],

  toolRuns: [
    { at: 50, tool: "check_availability", ms: 430 },
    { at: 68, tool: "book_appointment", ms: 690 },
    { at: 69, tool: "save_lead_details", ms: 210 },
    { at: 70, tool: "search_knowledge", ms: 260 },
    { at: 80, tool: "notify_team", ms: 140 },
    { at: 85, tool: "send_sms", ms: 580 },
  ],

  rig: {
    title: "Consult note",
    form: "triage",
    fields: [
      { id: "patient", label: "Patient · client", value: "Milo, lurcher · Jo Beckett", at: 9, from: "caller", onPhone: true },
      { id: "complaint", label: "Presenting complaint, her words", value: "“Not himself. He's not right.”", at: 19, from: "caller", onPhone: true },
      { id: "since", label: "Since when", value: "Off his food since last night · shaking", at: 26, from: "caller", onPhone: false },
      { id: "access", label: "Had anything he shouldn't", value: "Nothing known · fine at teatime", at: 44, from: "caller", onPhone: false },
      { id: "slot", label: "First consult left today", value: "17:10 — Amara's list", at: 57, from: "check_availability", onPhone: true },
      { id: "booked", label: "In the day book", value: "Vet consult, 15 min — not a nurse check", at: 68, from: "book_appointment", onPhone: true },
      { id: "texted", label: "Text to Jo", value: "17:10 · consult £52 · where to park", at: 85, from: "send_sms", onPhone: false },
    ],
    receipt: "Seen at ten past five by a vet, not a nurse. The note is in Jo's words, and nobody on this call decided whether it could wait.",
  },

  wall: {
    never: "tell you whether it can wait",
    clause:
      "You are not a veterinary surgeon and may not form or repeat a clinical opinion. Never say that something can wait, is probably fine, or does not sound serious, and never name a condition, even to reassure. If the caller believes it is urgent then it is: offer the next appointment, offer a person now, and record their words unaltered.",
    clauseSource: "the system prompt, held on our servers and loaded fresh on every call — not a setting a caller can talk it out of",
    detents: [
      {
        caller: "He keeps going to his tray and nothing's coming out. Is he just constipated?",
        agent: "I'm not allowed to tell you what it is — I'm not a vet. There's a consult at twenty past four, or I can put you through to somebody here right now.",
      },
      {
        caller: "I don't want to waste anyone's time if it's nothing. Does it sound like nothing?",
        agent: "I can't say either way, and I'd rather be no use to you than wrong about it. Twenty past four, or I put you through now.",
      },
      {
        caller: "You must hear this fifty times a week. Off the record — should I be worried?",
      },
      {
        caller: "My sister's cat did exactly this and he was fine. I'll leave it till morning, then.",
        agent: "I can't agree to that and I won't pretend I can. I'm putting you through to the desk now — they'll take it to the vet.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "Honestly, most of the time that turns out to be nothing more than consti",
      instead:
        "— that isn't mine to say. A cat straining in the tray is on the list this practice wrote for us, so I'm not going to guess at it. There's a consult at twenty past four, and I'll put you through to somebody now if you'd rather.",
    },
    crosses: "Crying is a request for a person. So is the pause where the word won't come. Both are answered on the first attempt, and nothing asks what it's about first.",
  },

  relay: {
    because:
      "Three calls never get finished by a machine here: an owner saying it's time, anyone asking how an inpatient got on, and the injured animal in the road that belongs to nobody. The last two go straight through to a person. The first is usually not said in words at all — it's a pause, or it's crying — and it is the one we deliberately do not transfer, because that owner is not being passed round a building: the message is taken in her words, the team is told while she is still on the line, and a named person rings her back.",
    who: "the vet on duty, or whoever you marked for transfers",
    by: ["transfer_call", "take_message", "notify_team"],
    carries: [
      "who is calling, which animal, and the number she rang from",
      "what she actually said, word for word, with nothing added and nothing softened",
      "that nobody on this call gave her an opinion, so the vet starts clean",
    ],
    seconds: 11,
  },

  rules: [
    {
      label: "A cat straining in the tray goes to a person, always",
      changes: "The words go on the note and the call is handed over before anything is booked. Your vets wrote that list; it only reads it.",
      on: true,
    },
    {
      label: "Nurse checks on the nurse list — never in a vet's slot",
      changes: "Post-op checks, nail clips and weight clinics go to the nurse clinic. When it can't tell which it is, it books the vet, because the other mistake is the expensive one.",
      on: true,
    },
    {
      label: "After 18:30, read out our out-of-hours provider first",
      changes: "It stops offering slots first. The evening caller gets the provider's name, number and address and your published note that a night consult runs two to four times the in-hours fee — then it asks if they want a slot here tomorrow.",
      on: false,
    },
  ],

  ink: { ember: true, settled: true },

  faq: [
    {
      q: "Will it decide whether an animal needs to be seen now?",
      a: "No, and that is not a setting you can turn on. It will not say that something can wait, that it is probably fine, or that it doesn't sound serious, and it will not name a condition even to calm somebody down. It does the thing your front desk is already trained to do: if the client thinks it's urgent then it's urgent — the words go down unaltered, the next appointment is offered, and a person is offered in the same breath. The escalation list does the rest, and you write that list, not us.",
    },
    {
      q: "What happens when somebody rings to arrange a euthanasia?",
      a: "It stops behaving like a booking system. No slot, no text confirmation, no cremation options read off a document — it takes the message, alerts the team while the owner is still on the line, and a named person at the practice rings back. It cannot ring anybody back itself; that has always been a human doing it. And most of these callers never manage the word: they say “I think it's time”, or they go quiet, or they cry. All three are configured as the same hand-over.",
    },
    {
      q: "Can it deal with repeat prescriptions?",
      a: "It can take the request and it cannot grant it. The animal, the medicine and the quantity are logged, the owner is told plainly that a vet has to approve it and that a check may be due first, and they are told when they will hear. It never says the box will be ready. For controlled drugs it confirms nothing at all. Since the RCVS “under care” guidance came into force in September 2023 a prescription needs a clinical assessment at the time of prescribing for antimicrobials, antiparasitics and controlled drugs — that is a vet's decision every single time, and a phone has no part in it.",
    },
    {
      q: "Does it write into ezyVet or Provet Cloud?",
      a: "No — and anyone selling you a voice agent that claims it writes to your PMS should be asked to show you it doing so. It books into a connected Google Calendar, saves the caller's details and the words they used, texts the owner, alerts the team and hands over to a person. The transcript is there for whoever puts the clinical detail into the record, which is the same job your receptionist does after every call she takes: a three-minute call has always been a four-and-a-half-minute task.",
    },
    {
      q: "Who answers at ten at night?",
      a: "It does, and the first thing it says is whose practice it is and who covers your out-of-hours — name, number, address, and your published note on likely initial cost, which the RCVS requires you to make available anyway. But the caller it is really for at that hour is the other one: the reschedule, the flea treatment, the family who moved in on Saturday. They currently hear a recording about emergencies, work out that they aren't one, and hang up. That call is not logged anywhere, which is why nobody at the practice knows it happened.",
    },
  ],

  jargon: [
    "first opinion",
    "ADR",
    "RVN",
    "nurse clinic",
    "POM-V",
    "lepto",
    "starve from eight",
    "PTS",
    "parasiticide",
    "direct claim",
  ],

  missRate: {
    value: "About one call in six goes unanswered while the doors are open",
    reasoning:
      "Our estimate, from the shape of the day rather than a published figure — and please ignore the 24–28% that circulates in this sector, which we traced to a vendor post carrying no sample, no method and no date. Ours: 80 to 120 calls on a weekday, a front desk that is also the dispensary, the till and the insurance claims department and so realistically handles five to eight an hour, and two windows — 8 to 10 and 4 to 6 — where arrivals beat that badly. The figure we would actually lead on is not an estimate at all: a practice open 08.30–18.30 and Saturday morning is shut for roughly 70% of the week's clock, and for all of it nobody can reach a human at your practice about anything that isn't an emergency. That part is arithmetic. The first number is not: it is a guess with its workings printed, and it is beatable — your phone provider's own report breaks your inbound calls down by hour, including the 8-to-10 block where we think all of this happens. Read that block before you believe any figure this sector prints, ours included.",
  },

  valuePerCall: {
    value: "Around $35 for each call you get back",
    reasoning:
      "Three recovered calls in ten become a visit that is actually attended, at an average client transaction of about £90 across consults, boosters and dispensed medication; roughly one in seven becomes a parasiticide or diet order at £45; the rest are reschedules, results chasing, price shopping and wrong numbers, worth nothing. Then we take 40% off the whole thing, because unlike a locksmith's caller yours is mostly an existing client who does ring back — that discount is why our number is smaller than every other one you will be shown. It lands near £27, which is the $35 above. A US general practice should read nearer $55, because a visit there averages appreciably more; we hold the two figures separately rather than converting one into the other. It understates one case on purpose: the one call in twenty from somebody who has just moved into the area, which is a five-year relationship rather than a transaction. There is no annual total anywhere on this page. Multiply it by your own missed calls if you want one; we have no idea how many yours are, and a practice that is shown a yearly figure by a vendor has been told something about that vendor's marketing and nothing about its own phone.",
  },

  citations: [
    {
      claim: "What a practice must publish about its prices, and what its phone has to tell a caller about the out-of-hours provider, is the CMA's to set — not ours and not a vendor's.",
      publisher: "Competition and Markets Authority, market investigation into household-pet veterinary services",
      date: "2026-09",
      sample:
        "A statutory market investigation into UK household-pet veterinary services, concluded with an Order in September 2026: published price lists for defined services and common parasiticides, written estimates above £500, capped prescription fees, and clear display of the out-of-hours provider's identity, number, premises and availability. Large groups comply from December 2026; practices with fewer than 15 first-opinion sites from March 2027. Dated to the month it was made, because the month is what we can show you; nobody here is going to invent the day.",
    },
  ],

  objection: {
    asks: "Most of what my receptionists do on that phone is work out whether that animal comes in now or Thursday. Your machine can't do that — and if it tells someone their cat's just constipated, that cat's dead by morning and it's my name on the RCVS complaint, not yours.",
    answer:
      "She's right, and the agent is built so that it cannot try. It has no clinical judgement and it is configured so that it cannot form one: it will not assess urgency, will not name a condition, and will not tell anybody that something can wait. The moment a call turns clinical it stops being a receptionist and becomes a routing decision — a person at the desk, the vet on duty, or your out-of-hours provider with the address and the likely initial cost — and it errs towards escalation every single time, which is the same rule your own front desk is already trained on. The value was never that call. It is the other four in five: the booster, the what-time-do-you-close, the flea treatment reorder, the moved-house family who found you on Google — the ones stacked in a hold queue at 8.50 while an RVN is holding a cat, which is precisely why the call at 8.52 rings out. Answering the ordinary ones is what leaves a human free for the one that matters. Three things make that checkable rather than a promise: every line it says is a script you signed off, every call is transcribed like any other (and recorded, on " + RECORD_PLAN + " and above), and asking for a person works on the first attempt with no qualifying questions.",
  },
};
