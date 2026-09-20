import type { Trade } from "./schema";

/* ------------------------------------------------------------------ *
 * Gyms & studios — independents, 24/7-access sites, reformer and yoga
 * studios, and the solo PT whose phone is in a bag at the end of the rack.
 *
 * What makes this phone unlike the others: it rings inside a building
 * that is open, occupied, and empty of staff. A 24/7-access site trades
 * 168 hours a week and has someone on the desk for roughly 45 of them.
 * At nine on a Sunday the lights are on, the music is playing, eleven
 * members are training, the door works — and the only humans in the room
 * are customers on treadmills who have no idea the phone is ringing and
 * could not answer it if they did.
 *
 * THE SPINE OF THE PAGE, and the reason it was rewritten: every call
 * here has an expiry time on it. The 6.15 starts at 6.15. The late-cancel
 * cut-off shuts six hours out and the fee lands automatically after it.
 * A notice period runs from the date the request was made, not the date
 * somebody got round to playing the voicemail. Elsewhere a missed call
 * becomes a later call. Here it becomes a lost spot, an automatic charge
 * to an already-annoyed member, or a notice period that started a week
 * late. Ring back at 6.40 and you are not late, you are irrelevant.
 *
 * So the whole page is built on one asymmetry. The assistant cannot
 * decide a charge — it holds no fee rules, moves no money and cannot make
 * a call have happened earlier than it did. What it can do is the half
 * that actually protects the club: put a time on the request, read it
 * back, text it, and hand a human the record. That is the wall, the
 * artefact and the receipt, and it is the one thing on this site that is
 * printed with a clock on it.
 *
 * Two deliberate restraints. `ember` stays false even though prong 1 is
 * urgent: the clock on this trade is administrative, not dangerous, and a
 * page that paints a missed spin class the colour of a gas leak has
 * started doing the thing it accuses the category of. And the sample call
 * runs four tools, not six — a page arguing that the product is smaller
 * than the brochure cannot then stage a tool parade.
 *
 * Vocabulary, checked against the trade. A class has a spot, not an
 * appointment; it is on the timetable, not the calendar. People join,
 * they do not sign up, and they are members or clients, never customers.
 * A fob, never a card. An induction in the UK, an orientation in the US —
 * not a "session", because a session is one-to-one. Yoga has a teacher,
 * CrossFit has a coach, group exercise has an instructor, and a PT has
 * clients; get that wrong on a studio's own page and the owner closes the
 * tab. A CrossFit gym is a box and an affiliate — an unaffiliated one is
 * functional fitness, and calling it CrossFit is infringement, not a
 * style error. Bikram is a specific 26-posture sequence, not a synonym
 * for hot yoga. And never call a yoga or Pilates studio a gym.
 *
 * Two people are named on this page and both are introduced before they
 * are used: Bev, who runs the desk and decides the fees, and Tomasz, who
 * keeps his own PT diary. Nobody else gets a name.
 * ------------------------------------------------------------------ */

export const fitness: Trade = {
  slug: "fitness",
  label: "Gyms & studios",

  kicker: "Nine on a Sunday: eleven members training, nobody behind the desk.",
  standfirst:
    "It picks up on the first ring, gets her into the six fifteen, and puts the minute she rang on a cancellation instead of the morning somebody plays the voicemail — and it hears that “how much is it a month?” is usually a woman asking whether she'll be the worst one in the room.",

  prongs: [
    {
      id: "tonight",
      label: "A spot tonight",
      does: "gets her into the six fifteen",
      caller: "Do I need to book, or can I just turn up to the six fifteen?",
      asks: "Offers the start times your timetable still shows free and books the one she says yes to, then texts it to her. What it will not do is tell her how many places are left: nothing it can call counts the room.",
      urgent: true,
    },
    {
      id: "clock",
      label: "Out of tonight",
      does: "puts tonight's time on the cancellation",
      caller: "I can't make the six tonight. Am I going to get charged for it?",
      asks: "Finds the booking under the number she's ringing from and cancels it at 17:52, not at ten past ten tomorrow when somebody finally listens to the voicemail. Whether 17:52 beat your cut-off is your rule and your answer — its job is to get it cancelled tonight rather than at ten past ten tomorrow, and to write tonight's time down where you can see it.",
    },
    {
      id: "joining",
      label: "Thinking about joining",
      does: "hears the question under the price one",
      caller: "How much is it a month? I've never done anything like this in my life, if I'm honest.",
      asks: "Reads the price and the joining fee off your own documents, then asks her one question back and writes down what she says to it. It books her into Foundations and leaves the membership to a person, because a contract sold down a phone comes with disclosures and a fortnight's cancellation right attached to it.",
    },
  ],

  intents: [
    { chip: "is the six fifteen full", reaches: "check_availability", then: "Reads the start times your timetable still has free. It can't count the room, so it never says how many." },
    { chip: "how much is it a month", reaches: "search_knowledge", then: "Price and joining fee off your own documents, then it asks her one back. The question back is the job." },
    { chip: "will I be the worst one there", reaches: "save_lead_details", then: "Writes that sentence down as she said it. Whoever rings her back is not opening with a price." },
    { chip: "do my ten credits expire", reaches: "search_knowledge", then: "Your expiry rule as written. If your documents don't cover it, it says so and takes her number." },
    { chip: "the one with the beds and springs", reaches: "search_knowledge", then: "Reformer. It finds the class she means without making her name it, and never corrects her out loud." },
    { chip: "stick me on if it frees up", reaches: "add_to_waitlist", then: "On the waitlist, and that is all it says. No position, no “you're third” — there is no queue to read." },
    { chip: "can I move Thursday to Friday", reaches: "find_booking", then: "Finds the spot under her number first. Nothing moves on a name it heard once down a phone." },
    { chip: "am I too late to drop out", reaches: "cancel_appointment", then: "Cancels it, carrying this minute. It can't read your cut-off and it can't take a fee off either." },
    { chip: "I want to cancel my membership", reaches: "take_message", then: "Logged to the minute and read back. Notice runs from tonight, not from when somebody plays it back." },
    { chip: "you've taken the money twice", reaches: "notify_team", then: "Both dates off her statement, straight to whoever runs the DDs. It promises no refund, ever." },
    { chip: "can I freeze it, I'm having an op", reaches: "take_message", then: "Dates in, next payment date in. A freeze changes a contract, so a person signs it off." },
    { chip: "my fob won't let me in", reaches: "notify_team", then: "Ten at night, member outside, nobody in the building. It pages the on-call instead of filing it." },
    { chip: "is my husband in there or not", reaches: "take_message", then: "It never says who is in the building. Not to a wife, not to anyone. Message taken, reason given." },
    { chip: "I did my back in your class", reaches: "transfer_call", then: "An injury on your floor goes to a person mid-sentence. It apologises for nothing, admits nothing." },
    { chip: "Marek does my PT, is he in", reaches: "take_message", then: "His diary is his. The message reaches Marek with the slot she wants and the time she rang for it." },
    { chip: "what time do you shut tonight", reaches: "get_call_context", then: "Your hours and your clock, not hers. It's the same clock that timestamps everything else it does." },
  ],

  duration: 94,

  turns: [
    { at: 0, side: "agent", text: "Fieldgate Pilates — you're through to the studio's assistant. Nobody's on the desk on a Sunday, so it's me. What can I do?" },
    { at: 9, side: "caller", text: "I need to come off the six fifteen tonight. And then I want the whole membership cancelled — I've been ringing you about it for a fortnight." },
    { at: 20, side: "agent", text: "Tonight first, because that one's on a clock. Bear with me." },
    { at: 26, side: "agent", text: "Reformer, six fifteen tonight, booked under this number. I'm taking you off it now." },
    { at: 33, side: "caller", text: "And I'm not being charged for that, am I." },
    { at: 36, side: "agent", text: "I can't tell you that, and I'm not going to guess at it. I don't hold your fee rules and I couldn't lift a charge if I did. What I can tell you is that the cancellation says 17:52 tonight, and that's the time Bev has in front of her in the morning." },
    { at: 50, side: "caller", text: "Fine. The membership then. Today, not in a fortnight." },
    { at: 55, side: "agent", text: "I can't close it — a person does that, and there's notice on it either way. What I can do is log the request this second, so the notice runs from today instead of from whenever somebody plays the voicemail. What's the name?" },
    { at: 68, side: "caller", text: "Carys Mullane." },
    { at: 71, side: "agent", text: "“Carys Mullane, cancelling her membership, asked for it Sunday the twentieth at 17:53.” Is that right?" },
    { at: 78, side: "caller", text: "That's right. First time anyone's written it down." },
    { at: 82, side: "agent", text: "Saved with that time on it, and I'm sending you the same words by text so you've got your own copy. Bev rings you tomorrow — and whatever she decides about tonight, the date on your notice is today's." },
  ],

  toolRuns: [
    { at: 2, tool: "get_call_context", ms: 90 },
    { at: 21, tool: "find_booking", ms: 380 },
    { at: 28, tool: "cancel_appointment", ms: 520 },
    { at: 79, tool: "take_message", ms: 240 },
    { at: 84, tool: "send_sms", ms: 610 },
  ],

  rig: {
    title: "Timed notice",
    form: "class",
    fields: [
      { id: "tonight", label: "Tonight", value: "Reformer 18:15 — found under the number she rang from", at: 21, from: "find_booking", onPhone: true },
      { id: "dropped", label: "Off the class at", value: "Cancelled — 17:52, Sunday, the clock on this call", at: 28, from: "get_call_context", onPhone: true },
      { id: "fee", label: "Late fee", value: "Asked at 17:52. Not answered, not waived, not promised.", at: 33, from: "caller", onPhone: true },
      { id: "why", label: "Why she rang instead of clicking", value: "“I've been ringing you about it for a fortnight”", at: 50, from: "caller", onPhone: false },
      { id: "notice", label: "Notice requested", value: "Sun 20th, 17:53 — read back, agreed word for word", at: 79, from: "take_message", onPhone: true },
      { id: "open", label: "Membership", value: "Still live. A person closes it; this is the request, timed.", at: 79, from: "take_message", onPhone: false },
      { id: "texted", label: "Texted to Carys", value: "Off the 18:15 · notice logged 17:53, Sun 20th", at: 84, from: "send_sms", onPhone: false },
    ],
    receipt: "She rang once, on a Sunday, into an empty building — and the date on her notice is the day she rang, not the day somebody found the voicemail.",
  },

  wall: {
    never: "tell you you won't be charged",
    clause:
      "Never tell a caller that a late-cancel or no-show fee will not be applied, and never record a cancellation or a notice as having been made at any time other than the time of this call. You may not waive, reduce, backdate or forgive a fee or a notice date. Log the request with its time, say plainly that the decision belongs to the studio, and pass it on.",
    clauseSource:
      "the fitness system prompt, assembled on our servers for every call — not something the caller can argue the model out of, and not a setting anyone can switch off for one annoyed member",
    detents: [
      {
        caller: "Right, it's cancelled. So I'm not being charged for it, am I.",
        agent: "I can't tell you that either way. You're off the 18:15, and 18:04 tonight is the time on this call. Whether 18:04 is inside your window is Bev's to say, and she says it in the morning.",
      },
      {
        caller: "Then put it down as five o'clock. I tried you at five and nobody picked up. Same thing.",
        agent: "That one I can't do at all. The time on it is the time this call is happening — I can't make it have happened earlier, not for you and not for anyone. What I can put on it is “tried at five, no answer”, and honestly that's the part that helps you.",
      },
      {
        caller: "You're a machine. It costs you nothing. One sentence: I'm not being charged.",
      },
      {
        caller: "Then get me someone who can actually say yes.",
        agent: "Putting you through now. If nobody picks up — Sunday, so there's a fair chance — Bev gets your number, both times you rang tonight, and that last sentence exactly as you said it. She calls you before the six fifteen tomorrow.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "You rang before six, so you're inside the window — I'll take that fee o",
      instead:
        "— I can't take a fee off. Not off yours, not off anybody's, and not even when the caller is right, which you may well be. I can't move money and I can't move the clock. What I can do is the thing that actually gets fees dropped: your number, the time on tonight's call, the time you rang earlier and got nothing, and that sentence word for word, all of it in front of Bev before she opens.",
    },
    crosses:
      "One thing does get over it. It will say out loud that Bev can do what it can't, and it hands her either the call or the timed request without being asked twice. Refusing to decide a charge is not the same as refusing to move it along.",
  },

  relay: {
    because:
      "The call that cannot end with the assistant is a member stood outside an unstaffed building at ten at night with a fob that won't read. There is nobody to transfer her to — that is the whole reason she is outside — so the escalation is an alert to a mobile while she is still on the line, and then a text to her so she is not stood in the rain wondering whether anything happened.",
    who: "whoever is on call — the duty manager, or the number you saved for the unstaffed hours",
    by: ["notify_team", "take_message"],
    carries: [
      "her name and the number she is ringing from",
      "which door she is at, and whether she is inside the building or outside it",
      "what she said, word for word, and the time on the clock when she said it",
    ],
    seconds: 9,
  },

  rules: [
    {
      label: "A cancellation gets logged the second it's said, even when I'm stood right there",
      changes: "It stops offering to put her through to me first. A transferred call that rings out is an unlogged cancellation — so it takes the request, times it, reads it back, and only then offers me.",
      on: true,
    },
    {
      label: "Anything pregnancy or post-op goes to whoever's teaching before it goes in the book",
      changes: "The class isn't offered at all. It takes the detail, says plainly that it can't answer, and has whoever is teaching ring back the same day.",
      on: true,
    },
    {
      label: "After 20:00, door and fob problems come to my mobile",
      changes: "Out of hours, someone locked out in the rain rings you instead of sitting in an inbox until the desk opens at ten.",
      on: false,
    },
  ],

  ink: { ember: false, settled: true },

  faq: [
    {
      q: "Will it cancel a membership? That's the call I most want off my desk.",
      a: "It will not close it, and you would not want it to. What it does is the part that protects you: it records the request with a timestamp, reads it back, and confirms it by text, so the notice period runs from the date she rang rather than the date somebody found the voicemail. A human closes it. A cancellation deflected into an unlogged callback is how a club ends up in a dispute it deserves to lose — and the member who couldn't get through doesn't keep ringing, she cancels the direct debit instead.",
    },
    {
      q: "Can it drop a late-cancel fee when the member's obviously in the right?",
      a: "No, and that is the point rather than a limitation. It holds no fee rules, it cannot move money, and it cannot record a cancellation as having happened earlier than the call it happened on. So it never says “don't worry, you won't be charged” — the sentence that produces a chargeback when the automatic fee lands anyway, a one-star review quoting your own assistant back at you, and a member who now believes your phone lies. What it does instead is hand you the case: the time she rang, the time on the call the cancellation happened on, the time she rang earlier and got nothing, and her words untouched. Most fees that get dropped get dropped because somebody could see all four.",
    },
    {
      q: "Someone rings about a bad back, or says they're pregnant. What does it actually say?",
      a: "It says it can't answer that, and it means it. Whether a caller can take a class is a screening judgement — a PAR-Q or your own pre-participation form, made by a qualified instructor, sometimes only after a doctor's clearance. No law mandates the form, but virtually every professional liability policy written for a fitness facility requires some version of it, so an agent that says “you'll be fine” has skipped the screening the cover is conditioned on and created the exposure in the same sentence. It takes the detail, books nothing, and hands it to whoever teaches that class, by name.",
    },
    {
      q: "Can it stop over-filling a class? I've got fourteen reformers and that's it.",
      a: "Not by reading a capacity, because it has no way to read one. It books against your connected calendar, and when the timetable shows nothing free at 18:15 there is simply nothing there to book — it offers the waitlist instead and tells her only that she's on it, because there is no position on that list to read back and inventing one is how a studio ends up with fifteen people and fourteen machines. The cap itself lives where it always did: in what your calendar will give out.",
    },
    {
      q: "Can it take the payment, or set the direct debit up? That's half the admin.",
      a: "Never, on either. Card details spoken down a phone drag the recording, the transcript and everyone who can read it into PCI scope, and a direct debit mandate needs a properly authorised instruction — neither belongs in a conversation with software. It quotes your price, books the visit, logs the freeze or the cancellation with its time, and the money is set up by a person who is allowed to set money up.",
    },
    {
      q: "What about Bev's regulars, the ones who just want to hear her voice?",
      a: "They ring during staffed hours and they get Bev, exactly as they do now. It says it's the studio's assistant in the first eight words and never does a Bev impression — being caught pretending would cost far more than the calls are worth. What it takes is the traffic that currently reaches a recorded message: the ninety minutes she's scanning forty people into the 6.15, the forty-five minute tour, and Sunday.",
    },
  ],

  jargon: [
    "fob",
    "induction",
    "the timetable",
    "spot",
    "late cancel",
    "no-show",
    "the cut-off",
    "notice period",
    "DD",
    "credits",
    "reformer",
    "on-ramp",
  ],

  missRate: {
    value: "About three calls in ten go unanswered in staffed hours",
    reasoning:
      "Our estimate, and it comes out of a collision rather than a published figure: the busiest ninety minutes on this phone — half four to six — are the same ninety minutes one person spends scanning forty people in, taking payments and answering the six people physically stood in front of them. The caller is seventh in a queue she can't see. Out of hours is a separate and much uglier number: a 24/7-access site trades 168 hours a week with someone on the desk for about 45 of them, and Sunday is the most commonly unstaffed day in the trade. Ours is a number built out of a rota; yours is a number you can count. Count one Monday and one Sunday separately — the gap between those two is the argument, and the average of them hides it.",
  },

  valuePerCall: {
    value: "About £14 a recovered call in the UK, about $18 in the US",
    reasoning:
      "Two sums, held separately, and deliberately not an exchange rate: a UK membership at £40 a month and a US one at $50 are different products in different markets, and converting one into the other would be inventing precision. Both run the same way. Twelve months of member life counted and not a month more — which is short on purpose, since the Health & Fitness Association's 2025 benchmarking put annual retention at 66.4% and that implies longer. Then one phone enquiry in five turning into a join: that is our assumption, not a finding. ABC Glofox publishes 15–20% for gym leads, which is the right order of magnitude, but they sell gym software, they do not publish the sample behind it, and a figure like that is a sanity check rather than a source. Then two enquiries in every ten recovered calls, because the other eight are freezes, billing queries and class changes and we credit them nothing at all. Then three-quarters of the result, since some of those callers would have rung back anyway. A reformer studio at £130 a month is roughly three times this and a solo PT about twice. Multiply it by your own missed-call count if you want to; we are not going to do that arithmetic on a public page and call it your loss. And in this trade the expensive miss is not the enquiry anyway — it is the member who rang four times to cancel, gave up, and cancelled the direct debit instead, which costs the remaining term, the arrears chase, and a review with a date in it.",
  },

  citations: [
    {
      claim: "Two in five people ringing a gym as a prospective member never reached a human at all.",
      publisher: "Replify, secret-shop study of US fitness facilities",
      date: "2025",
      sample:
        "105 US facilities called as prospective members during standard business hours, fieldwork across Q3 and Q4 2025: 31% reached a person immediately, 61% eventually, 28% went straight to voicemail, 38% landed in an automated phone tree, 3% rang out. Follow-up was worse than pick-up — 12% of those leads were contacted within 72 hours. Business hours only, US only, and the 38% phone-tree share points at larger multi-staff clubs rather than single-site independents. No publication date is stated, so we date it to the fieldwork year and no further.",
      interest: "Replify sells AI call answering to gyms, and ran the study on itself.",
    },
    {
      claim: "Roughly a third of members leave in a year, which is why we count twelve months of membership and not twenty-four.",
      publisher: "Health & Fitness Association, industry benchmarking",
      date: "2025",
      sample:
        "Operator-reported annual retention of 66.4% across US clubs contributing to the association's benchmarking programme. The report does not publish a facility count we are willing to quote, so read it as an industry self-report rather than a census — which is also why we use it to argue that our own twelve-month assumption is too pessimistic, rather than to prove a number with it.",
      interest: "The association is the industry's own trade body: its members are the operators being measured, and it sells them the benchmarking.",
    },
  ],

  objection: {
    asks: "My members know Bev. They ring, she says “hiya, you're in for the six fifteen”, done — and that's half of why they're here rather than at the place down the road. The second a robot picks up my phone, every one of them knows I've taken a person out of the building to save money.",
    answer:
      "He is right about the thing everyone else in this category gets wrong: here the front desk is not overhead, it is a large share of the product. In plumbing or law the caller has never met whoever answers. In a studio she sees Bev three times a week and says hello. So the comparison is not Bev or the assistant — calls in staffed hours still reach Bev. It is the assistant or the recorded message, in the ninety minutes Bev is scanning forty people into the 6.15, the forty-five minutes she is touring exactly the kind of person who is calling, or the Sunday she is not in the building at all. Then ask which of those two sounds more like a person was removed to save money: “we're busy right now, leave a message after the tone”, or “there's a spot at 6.15, shall I put you in?”. And the second half of the answer is the half owners don't expect. The call Bev least wants to miss is not the enquiry. It is the member who has already decided to leave, rang four times, got the tone four times, and is now composing a review — because that one does not come back later. It comes back as a cancelled direct debit with a date on it, and the assistant's entire job on that call is to make sure the date is the day she rang.",
  },
};
