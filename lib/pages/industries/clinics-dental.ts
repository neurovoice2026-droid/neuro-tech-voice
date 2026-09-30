import type { Trade } from "./schema";

/* ------------------------------------------------------------------ *
 * Clinics & dental — a practice front desk, NHS, private or mixed.
 *
 * What makes this phone unlike the other fifteen: the caller's first and
 * most instinctive question is the one question nobody who answers this
 * phone is allowed to answer. "Is it an abscess?" "Should I be worried?"
 * "Can I take something for it?" — the receptionist of twenty years says
 * the same thing an AI has to say: I can't tell you that. Everywhere
 * else the phone can engage with the opening line. Here the skill is
 * turning a symptom into a slot without ever naming the symptom.
 *
 * Two things stack on top of it. The day opens with a cliff, not a ramp:
 * the busiest hour is the hour you unlock, allocate the pain slots and
 * check in the 08:30s, with the same two people. And the call that pays
 * for the whole system is the same call that could end a career — the
 * one at 22:40, when the practice is shut and today it gets a beep.
 *
 * Vocabulary is checked against the practice, not a thesaurus. A cap is
 * a crown and you do not correct her. A "deep clean" is either a £65
 * scale and polish or several hundred pounds of root surface
 * debridement, and quoting the first to a patient who needs the second
 * starts a fee argument at the chair. A UK practice has four surgeries,
 * not four operatories; a scale and polish, not a prophy. A dental nurse
 * is not a hygienist and neither is a therapist. FTA is failed to
 * attend. "Emergency" here means a same-day pain appointment — except
 * when it means 999, and the word is identical. And in the UK you do not
 * call the dentist Doctor unless the practice does.
 *
 * On the wall, which was argued about: the refusal is the avulsed tooth,
 * because that is the sharpest case and a page that picked a softer one
 * would be dodging. But a refusal that costs the ligament its thirty
 * minutes is indefensible and every dentist who reads it will say so, so
 * the refusal here is not an ending. It is a handover that runs while
 * the sentence is still being refused: the on-call phone is already
 * ringing, the dentist says in thirty seconds what the agent would have
 * said in five, and the wall costs seconds rather than minutes. The
 * thing bought with those seconds is that the same machine cannot, on a
 * different call, decide a swelling looks like it can wait — there is no
 * build that relays the milk and refuses the reassurance, because it is
 * one rule.
 * ------------------------------------------------------------------ */

export const clinicsDental: Trade = {
  slug: "clinics-dental",
  label: "Clinics & dental",

  kicker: "The busiest hour on your phone is the hour you unlock the door.",
  standfirst:
    "It answers on the first ring, writes down what the caller said without putting a clinical word on it, and puts the appointment in your book — and the moment anyone says pain, swelling, bleeding or an injury, it stops booking and gets a person on the phone.",

  prongs: [
    {
      id: "pain",
      label: "Ringing in pain",
      does: "puts today's pain in front of a person",
      caller: "I've been up all night with it and the whole side of my face has come up.",
      asks: "It does not grade it. Her name, the number she is on, what she said typed exactly as she said it, marked urgent — and a human on it while she is still talking: the desk if you're open, the on-call phone if you're not. The word abscess never leaves its mouth.",
      urgent: true,
    },
    {
      id: "moving",
      label: "Changing a booking",
      does: "fills the chair somebody just gave up",
      caller: "I need to cancel half ten tomorrow — my mum's been taken into hospital.",
      asks: "Finds the appointment on the number she's ringing from, cancels it, and does not argue the late-cancellation fee with someone whose mother is in A&E. The chair is back on your diary inside a minute, and the short-notice list already has names on it with when each of them could come — so the desk has somebody to ring rather than a gap to look at.",
    },
    {
      id: "joining",
      label: "Wanting to join",
      does: "gives the new patient a straight answer",
      caller: "We've moved down from Leeds and I need to get the three of us registered somewhere.",
      asks: "Reads your own answer off your own documents — books open, books closed, or a waiting list — and books the new-patient assessment if there is one to book. It does not correct her to say nobody has registered with an NHS dentist since 2006, and it does not invent a yes to keep her on the phone.",
    },
  ],

  intents: [
    { chip: "whole side of my face has come up", reaches: "notify_team", then: "Doesn't grade it. Name, number, marked urgent, on your on-call phone while she's still describing it." },
    { chip: "he's knocked his tooth out", reaches: "transfer_call", then: "Starts dialling before it answers anything, and says nothing about the tooth while it rings." },
    { chip: "my cap's come off", reaches: "check_availability", then: "Doesn't correct her to “crown”. Reads two free slots off your diary and offers her both." },
    { chip: "one at the back's gone funny", reaches: "save_lead_details", then: "Types that, verbatim. Nobody on this phone names it — the dentist does, with it in front of him." },
    { chip: "who can see me soonest", reaches: "check_availability", then: "Gives her a real time off your diary. She has three other practices open in three other tabs." },
    { chip: "taking on any NHS patients?", reaches: "search_knowledge", then: "Your answer, off your own documents. If it's no, it's no — and she's offered the list if you keep one." },
    { chip: "how much is that deep clean", reaches: "search_knowledge", then: "Two treatments hide behind “deep clean”. It reads both fees, both marked before an assessment." },
    { chip: "the filling's come out already", reaches: "notify_team", then: "The dentist hears it now, not with her in the chair telling him it lasted a week." },
    { chip: "in agony since the root canal", reaches: "transfer_call", then: "A possible harm event. No apology, no explanation, no argument — a named person, the same day." },
    { chip: "charged me for one I never booked", reaches: "transfer_call", then: "Doesn't defend the charge or read your policy at her. The practice manager gets it today." },
    { chip: "cancel half ten, mum's in hospital", reaches: "find_booking", then: "Finds it on the number she's ringing from, cancels it, and doesn't argue the late fee with her." },
    { chip: "anything sooner, I'll take it", reaches: "add_to_waitlist", then: "Short-notice list, with when she could come — so tomorrow's cancellation has somewhere to go." },
    { chip: "he said he'd send a prescription", reaches: "notify_team", then: "Won't discuss a prescription at all. Not the drug, not whether it went. The dentist is told." },
    { chip: "just ringing for my results", reaches: "take_message", then: "Reads nothing out. Not even “it says it's fine”. The clinician rings her back." },
    { chip: "what time's my wife in?", reaches: "take_message", then: "It won't confirm your wife is a patient here, let alone her time. That's a disclosure." },
    { chip: "do you do the Botox?", reaches: "take_message", then: "A prescription-only medicine can't be promoted on the phone. Details taken, clinician rings." },
  ],

  duration: 72,

  turns: [
    { at: 0, side: "agent", text: "Ledbury Dental Practice — you're through to the practice's assistant, and the call's recorded. What's happened?" },
    { at: 9, side: "caller", text: "My cap's come off. I've got my daughter's wedding Saturday and there's a gap right at the front." },
    { at: 17, side: "agent", text: "Before anything else — is there any pain with it, any swelling, any bleeding?" },
    { at: 22, side: "caller", text: "No. It came away in a toffee on Sunday. It's not hurting, it just looks awful." },
    { at: 28, side: "agent", text: "Thank you. The desk went at half five, and I'm not putting a crown through to the on-call dentist at this time of night — but I can get you in the book. Can I take your name?" },
    { at: 36, side: "caller", text: "Yvonne Parr. P-A-R-R." },
    { at: 41, side: "agent", text: "Thank you, Mrs Parr. Let me see what we've got before Saturday." },
    { at: 47, side: "agent", text: "Thursday the twentieth, twenty past nine, twenty minutes with Mr Varga. That's the first thing we have before the weekend." },
    { at: 53, side: "caller", text: "Thursday's fine. Will he be able to just stick it back on?" },
    { at: 58, side: "agent", text: "That's his call once he's looked at it, not mine. You're booked for Thursday — I'll text you the time and the notice we need to change it, and I'll give you the out-of-hours number before you go, in case it starts hurting." },
  ],

  toolRuns: [
    { at: 4, tool: "get_call_context", ms: 90 },
    { at: 42, tool: "check_availability", ms: 380 },
    { at: 56, tool: "book_appointment", ms: 740 },
    { at: 59, tool: "search_knowledge", ms: 620 },
    { at: 61, tool: "send_sms", ms: 580 },
    { at: 64, tool: "take_message", ms: 180 },
  ],

  rig: {
    title: "Appointment",
    form: "appointment",
    fields: [
      { id: "rang", label: "Rang at", value: "20:11 Tuesday · desk shut at 17:30", at: 4, from: "get_call_context", onPhone: true },
      { id: "words", label: "Her words", value: "“My cap's come off” · logged as said", at: 9, from: "caller", onPhone: true },
      { id: "route", label: "Pain, swelling, bleeding", value: "None, she says · nobody here graded it", at: 22, from: "caller", onPhone: true },
      { id: "name", label: "Name given", value: "Yvonne Parr · not matched to a record", at: 36, from: "caller", onPhone: false },
      { id: "booked", label: "In the book", value: "Thu 20th, 09:20 · 20 min · Mr Varga", at: 56, from: "book_appointment", onPhone: true },
      { id: "ooh", label: "Told her", value: "Your out-of-hours line, off your own page", at: 59, from: "search_knowledge", onPhone: false },
      { id: "texted", label: "Texted", value: "Thursday 09:20 · 24 hours to change it", at: 61, from: "send_sms", onPhone: false },
      { id: "left", label: "Left for Mr Varga", value: "“Can he just stick it back on?” · not answered here", at: 64, from: "take_message", onPhone: false },
    ],
    receipt: "Booked before the wedding, at ten past eight at night, off what used to be the answerphone. The desk reads it with their coats still on.",
  },

  wall: {
    never: "tell a caller in pain what to do — not even the first aid on your own website",
    clause:
      "Never give clinical advice, never say how serious something is, and never suggest what a caller should do before they are seen — including first-aid steps published on the practice's own website. If a caller mentions pain, swelling, bleeding, injury, fever or trouble swallowing or breathing: stop booking, take the name and the number, mark it urgent, alert the on-call contact and put the caller through to them if they will pick up. Do not decide whether it can wait, and do not turn the refusal into a callback when a transfer is available.",
    clauseSource: "the system prompt, applied on our servers before a word reaches the caller — not a toggle in your dashboard and not something the caller can argue it out of",
    detents: [
      {
        caller: "He's knocked his front tooth clean out. It's in my hand — what do I do with it?",
        agent: "I'm dialling Mr Varga now — stay with me, it's ringing. I can't advise you myself. He can, and he'll be quicker at it than I would be.",
      },
      {
        caller: "It's in black and white on your own website. Read it out. You're not deciding anything.",
        agent: "I'd be deciding which line of it applies to a seven-year-old and which doesn't, and that is the one thing I'm not qualified for. He's ringing. Twenty seconds.",
      },
      {
        caller: "He's seven and he's screaming and your phone's still ringing. Milk or water. One word.",
      },
      {
        caller: "What use are you then?",
        agent: "For that one question, none, and I won't pretend otherwise. What I've done with the last forty seconds is get a dentist onto this call instead of taking a message — he has your number and your words already, and if he doesn't pick up it rings every phone in the practice at once.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "Hold it by the white part, don't touch the root, and pop it in a cup of mi",
      instead:
        "— that isn't mine to say, and me not saying it isn't costing you anything: Mr Varga's phone is ringing as I speak. Stay on the line. He has your number, your words and the word urgent already, and if he doesn't answer in the next few seconds this rings every phone in the practice at once. You are not waiting on me for anything here.",
    },
    crosses: "Nobody has to ask. Any of the words pain, swelling, bleeding or injury is the ask, and the handover starts on that word rather than when the caller finally thinks to demand a person. Two sentences cross it the other way too, both clinical, both compulsory: ring 999 if someone can't swallow or breathe, and here is your out-of-hours number — the duty the answerphone carried, inherited by the thing that replaced it.",
  },

  relay: {
    because:
      "Three calls stop being bookings the second they're spoken: anything with pain, swelling, bleeding or an injury in it; a complaint or a suspected harm event; and a safeguarding disclosure. It doesn't rank them. The alert goes first because it can't be declined and it lands while she's still describing it; the transfer goes second because it needs somebody awake to pick it up; the message is third, and only because the on-call phone is sometimes in a coat in another room.",
    who: "the desk in hours, the on-call phone out of them — whoever you named",
    by: ["transfer_call", "notify_team"],
    carries: [
      "what she said, in her own words, with no clinical word put on it",
      "the number she rang from, read back and confirmed with her",
      "the time she rang and whether the practice was open when she did",
    ],
    seconds: 12,
  },

  rules: [
    {
      label: "Pain, swelling or bleeding pages the on-call phone, whatever the hour",
      changes: "Those calls stop being bookings mid-sentence. It takes the name and number, marks it urgent, your phone goes while she is still describing it — and then it tries to put her straight through to whoever is holding that phone.",
      on: true,
    },
    {
      label: "Leave the two same-day slots alone — the desk gives those out",
      changes: "It books everything else against the diary and never touches those two, so half past eight still has somewhere to put the person who's been awake since three.",
      on: true,
    },
    {
      label: "Anyone I can't fit in goes on the short-notice list",
      changes: "Nobody who rings and can't be seen just disappears. They go on the list with when they could come, so tomorrow's cancellation has a name against it.",
      on: false,
    },
  ],

  ink: { ember: true, settled: true },

  faq: [
    {
      q: "Can it tell someone whether they need to be seen today?",
      a: "No, and there is no version of it that can. It does not assess symptoms and it never tells anyone their problem can wait — under-triage is the failure that ends careers, and it is not a judgement we will let software make. What it does is mechanical: any mention of pain, swelling, bleeding, injury, fever or trouble swallowing goes to a human, whether it sounds serious or not. It doesn't have to recognise a spreading facial swelling. It has to refuse to be the one who decides.",
    },
    {
      q: "A tooth is knocked out. Refusing to read our own first aid makes that outcome worse, not better.",
      a: "It would, if the refusal were the end of the call. It isn't. That is the one call where the agent stops mid-sentence and starts dialling instead — the on-call phone is ringing before the caller has finished the question, and the dentist says in thirty seconds what the agent would have said in five. The ligament has thirty to sixty minutes; the handover costs a fraction of one of them. What those seconds buy is that the same machine cannot, on a different call, decide a swelling looks like it can wait until Thursday. There is no build that relays the milk and refuses the reassurance. It is one rule, and the half worth keeping is the second half.",
    },
    {
      q: "Someone rings at twenty to eleven at night with a swollen face. What actually happens?",
      a: "It answers, says in the first sentence that it's the practice's assistant and that the call is recorded, and asks nothing clinical. It takes her name and the number she's on, types what she said without translating it, marks it urgent and alerts whoever you put on the on-call contact — while she is still talking, and then tries to put her through to them. Then it reads your out-of-hours arrangement off your own documents and gives it to her, because that duty came with the answerphone it replaced and every out-of-hours caller is owed it. It does not book her, it does not name the symptom, and it does not tell her it can wait until Thursday.",
    },
    {
      q: "Will it read someone their results, or tell my husband when I'm in?",
      a: "No to both, and the second one surprises owners more than the first. The fact that a named person is a patient here is itself confidential, so a spouse, a parent of an over-16 or an employer gets nothing — it will not confirm the appointment exists, never mind the time. Results are a clinician's job in every practice we've seen, so it takes the message and says who will ring and roughly when. Not the number, not the summary, not “it says everything's fine”.",
    },
    {
      q: "What will it say about our fees?",
      a: "Only what is on your own price list, and always labelled as being before an assessment. It will not say which NHS band applies, because that is a clinical judgement made after an examination and getting it wrong is a charge dispute at the desk. It will not say what an insurer covers. And it will not price a “deep clean”, because a scale and polish and root surface debridement are both hiding behind that phrase and they are not the same money — it reads both and books the assessment.",
    },
    {
      q: "Every call is health data. Is this even legal?",
      a: "It can be, and it is on you and us together rather than on a badge. It tells the caller it's recording in the first sentence, before anyone starts describing symptoms, which is what two-party consent states require and what the ICO expects in the UK. You'll need a written processor agreement with us — a BAA in the US — signed before it takes a single call, not after the pilot, along with a retention period you chose and a privacy notice a patient can actually find. Any vendor who answers this question with the word “compliant” and nothing else is selling you a sticker.",
    },
  ],

  jargon: [
    "cap",
    "surgery",
    "scale and polish",
    "RSD",
    "Band 2",
    "recall interval",
    "FTA",
    "dry socket",
    "pericoronitis",
    "the gas",
  ],

  missRate: {
    value: "About one in four calls goes unanswered while the desk is open",
    reasoning:
      "Worth saying why it is ours rather than a citation. The number that circulates in this trade is 38% unanswered, and it comes from one call-analytics vendor's own case study — 4,280 calls across 26 practices inside a single US group, in a single month, at practices that had bought call analytics precisely because they already suspected a problem. We are not printing somebody's sales asset as an industry rate. Ours comes from the shape of the day instead: the busiest hour is the hour you unlock, allocate the same-day slots and check in the 08:30s with the same two people; the lunchtime desk closure lands inside the window working patients are free to ring; one person off sick takes it past 40% for a day with no warning. Separately, and much larger: a practice open 08:30–17:30 with a half-day is shut for roughly three-quarters of the week's clock, and those calls appear in no report at all, because the phone system logs the answerphone as having answered them. Your practice software will print you last Monday, eight till ten. That one morning settles this paragraph either way.",
  },

  valuePerCall: {
    value: "About $26 a recovered call in the States, around £14 here",
    reasoning:
      "Two figures held apart on purpose, because the gap between them is production and not an exchange rate. UK: one missed call in five is a new patient, priced at their first year rather than their lifetime — assessment, radiographs, a hygiene visit, one small restoration, call it £250 — and about a third of them book and attend, because somebody ringing three practices in a morning turns up at one. That is £87.50 a new-patient call. The other four in five are reschedules, hygiene bookings, results chasing; answering those earns nothing, it stops a slow leak, so we credit one hygiene slot in ten, £6.50. Blended, £22.70. Then 40% off the lot for the patients who would have rung back later and got through anyway: £13.60. The US line is the same arithmetic on US numbers — $600 of first-year production, 30% attending, a $90 hygiene slot — and comes out near $26. Neither figure gets multiplied by your call volume to make a headline for the year. You can probably see why we would want to. And neither of them includes the call this whole thing exists for, the one at 22:40 with the swelling; that one is not worth $26 and we are not going to price it.",
  },

  citations: [
    {
      claim: "Getting through to a health practice by phone is hard for something like two patients in five.",
      publisher: "Ipsos for NHS England, GP Patient Survey 2026",
      date: "2026",
      sample:
        "Around 700,000 patients in England; 56.9% said it was easy to contact their practice by phone, up from 52.9% in 2025 and 49.7% in 2024 — so roughly 43% still did not. It measures NHS GP practices, not dental or private clinics. We use it because it is the nearest thing to an independent, repeated, properly sampled measure that exists, not because it is a dental figure. Dated to the year because that is what we can verify; we are not going to invent the day it landed on a page that spends two paragraphs on other people's invented numbers.",
    },
    {
      claim: "When people cannot get a dental appointment, a share of them end up in A&E instead.",
      publisher: "Healthwatch England",
      date: "2025-12",
      sample:
        "NHS England data cited in the report: A&E attendances in England for dental conditions rose from 81,773 in 2019/20 to 117,977 in 2023/24, a 45% increase. Alongside it, local Healthwatch volunteers mystery-shopping urgent dental care in the North East made up to 15 calls without finding an available urgent appointment. Healthwatch is the statutory patient-voice body and sells nothing into this category.",
    },
  ],

  objection: {
    asks: "Half my callers are in pain. If that thing tells someone with a swollen face to come in Thursday and she ends up in hospital, it's my GDC number on the line, not yours.",
    answer:
      "Right on the risk, and the answer is that it decides nothing clinical — we don't sell it as triage and it cannot be configured into one. Anything with pain, swelling, bleeding or an injury in it stops being a booking mid-sentence: name, number, what she actually said, marked urgent, a human on it and a transfer attempted. It never says that something can wait. And the comparison isn't him or his receptionist, who is better at this than software will ever be. It's what happens at 22:40 on a Sunday, when that same caller gets a beep, rings the next practice, and then joins the queue that took A&E dental attendances in England from 81,773 to 117,977 in four years. What it takes off the desk is the unambiguous half of the day: the reschedules, the “are you open Saturday”, the “are you taking anyone on”. Every one of those is a patient at the counter getting the receptionist's whole attention instead of half of it.",
  },
};
