import type { Trade } from "./schema";

/* ------------------------------------------------------------------ *
 * Logistics & dispatch — same-day couriers, small hauliers, man and van.
 *
 * What makes this trade unlike the other fifteen: everywhere else the
 * phone points one way, outside in. Here the same handset is the sales
 * line and the control channel for a fleet that cannot see itself, and
 * something like half the traffic on it is not a customer at all — it is
 * your own driver at a gatehouse that won't issue a pass, a subbie
 * running empty off Glasgow, a goods-in office refusing a delivery. The
 * two streams peak in the same ninety seconds: at 16:15 the customer is
 * panicking because their cut-off is at five, and the driver is ringing
 * because the place he is stood at shuts at five and there is no
 * forklift. Whichever one gets picked up, the other one is a loss — and
 * one of them might be £20,000 of stock on a tail lift with ninety
 * minutes of legal driving time left on the card. The page has to show a
 * phone that can tell those two callers apart in three seconds.
 *
 * Vocabulary is checked against a traffic office, not a thesaurus. A
 * collection, never a pickup. A consignment, never a package. The
 * consignor sends and the consignee receives, and the person ringing is
 * frequently neither. "The network" is a pallet network — Palletline,
 * Fortec, Pall-Ex — trunking to a hub overnight, and it is not the same
 * thing as the courier; a network failure is one of the commonest
 * reasons this phone rings at all. "Same day" means a dedicated vehicle
 * carrying that job and nothing else; "overnight" means next working day
 * by a stated time and does not mean tonight. Nothing is "out for
 * delivery" — a van doing one job has a driver, and a traffic office
 * says where he is. The agent does not: there is no feed behind it to
 * read a position off, and the page says so rather than implying one.
 * A house move is not a delivery and a courier job is not a removal:
 * different licensing, different insurance, different customer. And
 * "insured" is not a synonym for "liability limited under the conditions
 * of carriage" — they are close to opposites, and every operator knows
 * it.
 *
 * The sentence this page is built around refusing is smaller than any of
 * that, and it is the one a caller works hardest to get: yes, a van will
 * be with you by five. Nothing in the product can see the board, the
 * plate, or the hours left on a driver's card, so nothing in the product
 * may say it. A rate can be indicative. A vehicle at a time cannot be
 * anything but a promise, and promises here are made by the man holding
 * the board.
 * ------------------------------------------------------------------ */

export const logistics: Trade = {
  slug: "logistics",
  label: "Logistics & dispatch",

  kicker: "Half past four on a Friday, and the other line is one of your drivers.",
  standfirst:
    "It picks up on the second ring, works out whether it's a customer or one of your own vans before it says anything else, and leaves a fully specified consignment in front of traffic. It promises no vehicle and no time, because the board does that and the board is yours.",

  prongs: [
    {
      id: "today",
      label: "Has to move today",
      does: "gets traffic the brief, not a promise",
      caller: "Machine's down at Wednesbury. Part's sat in Redditch. Can you have it here by five?",
      asks: "Takes both postcodes, the pieces, the weight and what's taking it off at each end, then pages traffic with the deadline on it. It does not say yes to five o'clock. The man holding the board says that, once he has seen which vehicle is free and what hours the driver has left on his card.",
      urgent: true,
    },
    {
      id: "moved",
      label: "Ready time's slipped",
      does: "moves the collection and tells the office",
      caller: "That collection tomorrow — it won't be palletised till four now. Can he come later?",
      asks: "Finds tomorrow's collection on the number she rang from and moves it, then tells the office it has changed. It will not ring the driver, and it will not promise on his behalf that he'll wait.",
    },
    {
      id: "move",
      label: "Pricing a house move",
      does: "gets the inventory down at nine on Sunday",
      caller: "It's a two-bed flat and there's a big corner sofa. I don't know what size van I need.",
      asks: "Asks the twelve things that decide the vehicle — which floor, is there a lift, can a Luton get down the road, is the washer plumbed in, is there a loft — and books the survey. Sunday evening is the heaviest hour of the week for these calls and the one nobody is ever in for.",
    },
  ],

  intents: [
    { chip: "it's Baz, I'm on the drop", reaches: "transfer_call", then: "Matches the number to your saved contacts and puts him through. A driver never queues behind a price shopper." },
    { chip: "network's missed our collection", reaches: "get_call_context", then: "Reads the clock and your hours before it answers. Tonight and overnight are two different jobs." },
    { chip: "machine's down, part's in Redditch", reaches: "save_lead_details", then: "Both postcodes, the weight, the deadline. It writes the brief; it never says yes to five o'clock." },
    { chip: "I'm not the one who booked it", reaches: "find_booking", then: "Nothing under her number — she didn't book it. No location, no driver, no POD. A message, and a callback." },
    { chip: "anything coming back off Glasgow", reaches: "save_lead_details", then: "Logs the subbie with his vehicle, plate and route. Backloads are traffic's call, never the phone's." },
    { chip: "your lad's dumped it in the rain", reaches: "transfer_call", then: "Damage. It doesn't apologise for you, doesn't log a claim and doesn't guess. Person, immediately." },
    { chip: "two-bed flat, big corner sofa", reaches: "check_availability", then: "Inventory first — floor, lift, parking, loft — then the survey times that are really free. It prices nothing." },
    { chip: "your man insured for 40 grand?", reaches: "transfer_call", then: "Cover and liability are two numbers and neither is its to quote. Straight through to the owner." },
    { chip: "do you do Rotterdam", reaches: "take_message", then: "Route and dates down, then a person. It won't touch customs, EORI, a CMR or who's paying the duty." },
    { chip: "ballpark, pallet Leeds to Bristol", reaches: "search_knowledge", then: "Reads the band off your own rate card, says out loud that it's indicative, and takes the details anyway." },
    { chip: "it's my mum's stuff in storage", reaches: "save_lead_details", then: "She can't name the service. It takes volume, floors and dates and lets a human decide which side it is." },
    { chip: "gone ten, 26 pallets, by six", reaches: "notify_team", then: "The night calls are the ones nobody else answered either. Full brief taken, and you're paged where you are." },
    { chip: "couple of drums of chemicals", reaches: "take_message", then: "Hazardous is never ruled on by a phone. UN number, packing group and ADR are somebody's licence." },
    { chip: "can he come at four not two", reaches: "find_booking", then: "Finds tomorrow's collection before it touches it. A ready time slipping is the commonest change you get." },
    { chip: "I want the bloke in charge", reaches: "transfer_call", then: "Anyone still angry after one attempt to help gets a person. It doesn't try a second time." },
    { chip: "I've got three more firms to ring", reaches: "send_sms", then: "Once she says yes to a text, it sends the brief back to her. People stop dialling when something lands." },
  ],

  duration: 104,

  turns: [
    { at: 0, side: "agent", text: "Salter Transport, traffic office — you're through to the answering assistant. Is this a driver, or a collection?" },
    { at: 7, side: "caller", text: "Collection. It's Lorna at Kestrel Print — the network's missed us again. Can you run it direct tonight instead?" },
    { at: 14, side: "agent", text: "I'll take the brief now. Collecting from where, going where, and what time do they shut at the far end?" },
    { at: 22, side: "caller", text: "Redditch, B98 7AA, into Wednesbury, WS10 7SD. Their goods-in shuts at six." },
    { at: 31, side: "agent", text: "How many pallets, what's on them, and what do they weigh?" },
    { at: 38, side: "caller", text: "Four standard. Print stock, about four hundred kilos apiece, wrapped and labelled." },
    { at: 48, side: "agent", text: "Is there a forklift at both ends? If Wednesbury can't take it off, that's a different vehicle." },
    { at: 56, side: "caller", text: "We've got one here. Theirs I couldn't tell you. And what's it going to cost me?" },
    { at: 66, side: "agent", text: "Four pallets, Redditch to Wednesbury, dedicated — that lands in the three to four hundred band, indicative and under our conditions of carriage. I can't confirm the figure and I can't promise you the vehicle. Gurdip runs traffic here: he has the board, he knows which van is free and what hours the driver has left, and he's the one who says yes to six o'clock." },
    { at: 80, side: "caller", text: "Six is when they shut, not when they want it. Can you send me what you've got down? I need something to put in front of my production manager." },
    { at: 86, side: "agent", text: "Yes — the brief back to this number, exactly as you've given it to me. It'll say not yet accepted on it, because it isn't yet." },
    { at: 93, side: "agent", text: "That's with you, and Gurdip has the whole thing in front of him with your six o'clock on it. He'll come back to you either way." },
  ],

  toolRuns: [
    { at: 9, tool: "get_call_context", ms: 90 },
    { at: 44, tool: "save_lead_details", ms: 230 },
    { at: 61, tool: "search_knowledge", ms: 380 },
    { at: 87, tool: "send_sms", ms: 540 },
    { at: 90, tool: "notify_team", ms: 170 },
  ],

  rig: {
    title: "Consignment",
    form: "consignment",
    fields: [
      { id: "consignor", label: "Consignor", value: "Kestrel Print, B98 7AA — Lorna", at: 23, from: "caller", onPhone: true },
      { id: "consignee", label: "Consignee", value: "Wednesbury WS10 7SD · goods-in shuts 18:00", at: 25, from: "caller", onPhone: true },
      { id: "load", label: "The load", value: "4 standard pallets · print stock · 400kg each", at: 39, from: "caller", onPhone: true },
      { id: "handling", label: "Off at the far end", value: "Forklift at collection · unknown at Wednesbury", at: 57, from: "caller", onPhone: false },
      { id: "rate", label: "Indicative only", value: "£300–£400, under conditions of carriage", at: 66, from: "search_knowledge", onPhone: false },
      { id: "texted", label: "Sent to Lorna", value: "The brief back · marked not yet accepted", at: 88, from: "send_sms", onPhone: false },
      { id: "traffic", label: "With traffic", value: "Gurdip paged · deadline 18:00 tonight", at: 91, from: "notify_team", onPhone: true },
    ],
    receipt: "Nobody promised her a van. The brief is complete, Lorna has it in writing, and Gurdip's phone went before the call ended.",
  },

  wall: {
    never: "promise you a vehicle, or a time it will be there",
    clause:
      "Never confirm, offer, estimate or imply a collection time, a delivery time, or that a vehicle is available. You cannot see the board, where any driver is, or how much driving time is left on a card. Take the brief, tell the caller plainly that it is not yet accepted, and page traffic. Only a person allocates a job.",
    clauseSource:
      "the system prompt, assembled on our servers and re-sent on every call — not a setting on the phone, and not something a caller can argue it out of",
    detents: [
      {
        caller: "Straight answer. Can you have a van on my yard by half four, yes or no?",
        agent: "I can't put a vehicle against a time — I've no sight of the board and I don't know where your nearest driver is. What I can do is have the whole brief in front of Gurdip before you've put the phone down.",
      },
      {
        caller: "The last firm I rang gave me half an hour on the spot. You're telling me you can't tell me anything?",
        agent: "They had somebody looking at a screen. I'm the phone. Gurdip has the board, the plates and the hours left on every card, and half four is his to say.",
      },
      {
        caller: "I'm not asking you to sign anything. Just tell me it's doable.",
      },
      {
        caller: "So I sit here, do I? My line's down and it's costing me nine hundred an hour.",
        agent: "Keep the other quote warm and I'll page him now, marked line down, deadline six. If he can't do it you'll know quickly, and knowing quickly is worth more to you than me agreeing with you.",
      },
    ],
    retraction: {
      atDetent: 2,
      begins: "Course it is, no problem at all — I'll have a Luton on your yard by half fo",
      instead:
        "— I can't have anything on your yard by any time, and I nearly said I could because you asked me four times. I can't see the board, I can't see where a driver is, and I can't see what's left of his hours. Gurdip can see all three. Your brief is in front of him now, and when he says half four it will be true.",
    },
    crosses:
      "One person on this number can promise a vehicle by half four, and it is never the agent. What crosses the wall is the brief, reaching him while the caller is still on the line — and the caller behind it, if he would rather argue about half four with the man who is allowed to say it.",
  },

  relay: {
    because:
      "Half the traffic on this number is not a customer. Your own driver — stood at a gatehouse that won't issue him a pass, or on a drop where there is no forklift and they are refusing to take it off — goes through to a human before the agent asks him a single question. So does anyone ringing about damage, an accident or a claim. Neither of them waits behind a price shopper, which is the whole reason this line loses work. The transfer is the first move every time; if it doesn't connect, the same facts are saved as a message the team is told about there and then. There is no third step, because a driver at a gate does not need a text — he needs somebody picking up.",
    who: "traffic — whoever has the board, or the owner's mobile after 17:30",
    by: ["transfer_call", "take_message"],
    carries: [
      "the number he is ringing from, and whether it matches a contact you saved",
      "which of your jobs he says he is on, and the name of the place he is stood outside",
      "the one thing he needs somebody to do, quoted rather than summarised",
    ],
    seconds: 8,
  },

  rules: [
    {
      label: "My drivers never wait behind a customer",
      changes: "It matches the number against the contacts you have saved before it says anything else, and a driver hears a person, not a hold tone.",
      on: true,
    },
    {
      label: "Every figure carries the conditions of carriage",
      changes: "The band and the conditions arrive in the same sentence, and again in the text, so a rate discussed on the phone is never a rate discussed on its own.",
      on: true,
    },
    {
      label: "After 17:30 wake me for a stopped line",
      changes: "A stopped line or a missed cut-off reaches your mobile at half past ten. A man-and-van enquiry waits on the board until morning, where it is still sitting when you get in.",
      on: false,
    },
  ],

  ink: { ember: true, settled: false },

  faq: [
    {
      q: "Can it price a job? Because no two of mine are the same.",
      a: "It can read a band off your own rate card and say out loud that it is indicative and subject to your conditions of carriage — or it can quote nothing at all, if you would rather do every figure yourself. What it never does is put a firm price on a house move, an international movement, anything hazardous, anything high-value, or any job where the access at either end is unknown. On a US interstate household move it cannot give a figure at all, and that is not our caution: the FMCSA's household goods rules require an estimate based on a physical survey of the goods, and say in terms that a rate quote is not an estimate.",
    },
    {
      q: "Half my calls are my own drivers. What happens to them?",
      a: "They are the first thing it checks. The number comes in, it is matched against the contacts you saved, and a driver is put through before he is asked a single question — no menu, no hold, no qualifying. That is the call that currently loses you a booking, because the customer trying to book four hundred pounds of work is queueing behind the man at the gate at Jaguar who cannot get in. The honest limit is that it matches numbers, not voices: a driver ringing off a gatehouse landline is a stranger to it, and gets the same opening question as everybody else. He says he's one of yours, and he goes through on that.",
    },
    {
      q: "Someone rings asking where their consignment is. What does it tell them?",
      a: "Less than they want, and this is the part owners argue with, so here it is flat: there is no tracking feed behind this. It cannot see a vehicle on a map, there is no courier integration, and we are not going to pretend there is a link it can read out. What it can do is look for a job booked under the number she is ringing from — and the person sat waiting in is usually the consignee, who booked nothing and whose number is on no job, so that comes back empty. She is not entitled by default to the address, the driver, the contents or who signed the POD either; that is a disclosure under UK GDPR, not a courtesy. So she gets what can honestly be given: her name and number taken, what she is describing written down, and traffic told while she is still on the line.",
    },
    {
      q: "He's offering another hundred to squeeze it in. Does it take the money?",
      a: "No, and it could not act on it if it did. It doesn't negotiate a rate, agree credit terms, waive waiting time or accept a payment arrangement. And the thing that decides that job was never the hundred pounds: it is what is left on a driver's card. Drivers' hours limits and break rules are set in law, they differ by vehicle weight and by whether the vehicle runs on a tacho, and we are not going to print the numbers on a marketing page — you know yours and a page that got them slightly wrong would be worse than useless. What matters here is simply this: a collection that only works if a driver runs over is not available at any price, and the only person who can see how close he is to the limit is you.",
    },
  ],

  jargon: [
    "collection",
    "consignment",
    "consignee",
    "dedicated",
    "tail lift",
    "pallet network",
    "backload",
    "subbie",
    "POD",
    "conditions of carriage",
  ],

  missRate: {
    value: "About one call in five, and nearer one in three between three and five",
    reasoning:
      "Our estimate, and it has to be, because nobody measures this trade: the RHA, Logistics UK, BAR and the Institute of Couriers publish no answer rate for hauliers, couriers or removers, so a vendor who quotes you one for this industry has invented it. Ours is arithmetic off the shape of the day — one line, one pair of hands, and everybody else's cut-off landing between four and six, which is the same ninety minutes the dispatcher spends re-planning the two jobs that already went wrong. After half five it is a mobile on a worktop, and the rate goes up again. Don't take ours: pull last Friday afternoon off the handset and count it yourself.",
  },

  valuePerCall: {
    value: "About £20 a call — nearer £180 for one answered at night",
    reasoning:
      "Our arithmetic, and every step of it is yours to argue with. Roughly four calls in ten carry no revenue at all: your own drivers, subbies, suppliers and people chasing a consignment you have already been paid for. Another one in seven is an existing customer moving a job he has already given you — worth a lot, counted here as nothing. That leaves about 45% that are a genuine new enquiry. A job averages about £150 and we put conversion at 30%, deliberately under the close rates the moving-software vendors publish about their own customers, which we have not printed because we could not put a date or a sample against them. £150 × 45% × 30% is £20. The out-of-hours call belongs on its own line: the caller with a stopped line at half past ten has already tried everyone and has stopped asking about price, so a £300 job converting better than one in two is the £180. The figures stay in pounds because the £150 underneath them is a pound figure, and a dollar version of it would be an exchange rate pretending to be research. Nothing annualised. Your call mix is your own, and a total we invented from it would be the first thing a transport manager could disprove.",
  },

  citations: [
    {
      claim: "A rate discussed on the phone without the conditions attached is an exposure, not a sale.",
      publisher: "Road Haulage Association, RHA Conditions of Carriage 2020",
      date: "2020",
      sample:
        "Not research and no sample: this is the published carriage conditions themselves, the edition in force from 1 September 2020. They cap liability at £1,300 per tonne of the gross weight lost or damaged and exclude consequential loss — but only where the conditions are incorporated at the point the rate is discussed.",
      interest: "The RHA is the hauliers' trade association; it writes these conditions for its members and sells them the membership.",
    },
    {
      claim: "The owner-driver answering hands-free at 56mph cannot write down a postcode — and may not legally touch the phone to try.",
      publisher: "UK Government, The Road Vehicles (Construction and Use) (Amendment) (No. 2) Regulations 2022",
      date: "2022-03",
      sample:
        "Again not a survey — the amending regulations, in force from March 2022. They extended the handheld mobile offence to all use while driving, stationary in traffic included, carrying six penalty points and a £200 fixed penalty.",
    },
  ],

  objection: {
    asks: "Half the calls I get aren't even customers. And no two jobs are the same — somebody tells your robot it's 'just a few boxes', I turn up with a Transit, and it's my name on the side of the van.",
    answer:
      "The pricing part is true and the agent should not argue with it. It is also not what he is losing. What he is losing is 16:40 on a Friday, when he is on the other line to a driver and three people ring inside ten minutes because their own cut-off has just bitten. It does not decide the vehicle — it writes down the four things that decide it: pieces, weight, dimensions, and what is taking it off at each end. When the far end is unknown it writes unknown, which is already more than a hands-free call at 56mph on the M6 ever gave him. Then he has a complete enquiry sitting there at 17:05 instead of a missed call, and the man who says yes to the job is still him.",
  },
};
