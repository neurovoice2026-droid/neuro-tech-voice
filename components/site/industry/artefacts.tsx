import type { Rig } from "@/lib/pages/industries/schema";

/* ------------------------------------------------------------------ *
 * The mark on the paperwork.
 *
 * Sixteen trades, sixteen drawings. The temptation across a set this
 * size is one rounded rectangle with a different word in it, and that is
 * exactly the failure the pages exist to avoid: if the veterinary page
 * is the restaurant page with the nouns swapped, nobody needed sixteen
 * pages.
 *
 * So each artefact carries a small hairline figure of the object a call
 * in that trade actually produces — a docket with its covers, a bay with
 * a car over the pit, a triage line with one spike in it. Drawn in the
 * same 1.6px hairline as every other figure on these pages, muted, at
 * the size of a stamp: a mark on a form, not an illustration of one.
 * ------------------------------------------------------------------ */

const S = { stroke: "currentColor", strokeWidth: 1.6, fill: "none" } as const;
const DOT = { fill: "currentColor" } as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 76 44" className="block h-11 w-[76px] text-pp-muted" aria-hidden>
      {children}
    </svg>
  );
}

export function ArtefactMark({ form }: { form: Rig["form"] }) {
  switch (form) {
    case "job-card":
      // A docket torn off a pad.
      return (
        <Frame>
          <path {...S} d="M8 12 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 V38 H8 Z" />
          <path {...S} d="M16 22 H52 M16 30 H40" strokeWidth={1.2} />
        </Frame>
      );
    case "viewing":
      // A door, and the arc it swings through.
      return (
        <Frame>
          <path {...S} d="M22 38 V8 H46 V38" />
          <path {...S} d="M46 38 A24 24 0 0 0 22 14" strokeDasharray="0.01 4.4" strokeLinecap="round" />
          <circle cx="41" cy="24" r="1.8" {...DOT} />
        </Frame>
      );
    case "slip":
      // A restaurant docket, perforated, with its covers counted.
      return (
        <Frame>
          <path {...S} d="M18 8 H58 V36 H18 Z" />
          <path {...S} d="M18 14 H58" strokeDasharray="0.01 3.6" strokeLinecap="round" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} cx={25 + i * 6} cy={26} r="1.9" {...DOT} />
          ))}
        </Frame>
      );
    case "matter":
      // A folder with a tab. Nothing inside it is decided yet.
      return (
        <Frame>
          <path {...S} d="M12 36 V12 H30 l4 5 H64 V36 Z" />
          <path {...S} d="M12 22 H64" strokeWidth={1.2} strokeDasharray="0.01 4" strokeLinecap="round" />
        </Frame>
      );
    case "bay":
      // A car over a pit: the ramp, not the vehicle.
      return (
        <Frame>
          <path {...S} d="M14 26 h10 l5 -8 h18 l5 8 h10" />
          <circle cx="27" cy="30" r="3.4" {...S} />
          <circle cx="53" cy="30" r="3.4" {...S} />
          <path {...S} d="M8 38 H68" strokeWidth={1.2} />
        </Frame>
      );
    case "consignment":
      // Two pins and the window between them.
      return (
        <Frame>
          <circle cx="16" cy="18" r="3.6" {...S} />
          <circle cx="60" cy="18" r="3.6" {...DOT} />
          <path {...S} d="M20 18 H56" strokeDasharray="0.01 4.4" strokeLinecap="round" />
          <path {...S} d="M16 30 V36 H60 V30" strokeWidth={1.2} />
        </Frame>
      );
    case "chair":
      // A salon chair, side on.
      return (
        <Frame>
          <path {...S} d="M26 8 V26 H50" />
          <path {...S} d="M26 26 H22 a4 4 0 0 0 -4 4 v2" />
          <path {...S} d="M38 26 V34 M30 38 H46" />
          <circle cx="54" cy="18" r="2" {...DOT} />
        </Frame>
      );
    case "triage":
      // A flat line with one spike. The whole job is knowing which call is the spike.
      return (
        <Frame>
          <path {...S} d="M8 26 H26 l4 -14 l5 24 l4 -10 H68" strokeLinejoin="round" />
          <circle cx="30" cy="12" r="2.2" {...DOT} />
        </Frame>
      );
    case "policy":
      // A shield, and a rule across it: what is covered is not ours to say.
      return (
        <Frame>
          <path {...S} d="M38 8 l16 5 v10 c0 8 -7 13 -16 16 c-9 -3 -16 -8 -16 -16 V13 Z" />
          <path {...S} d="M24 24 H52" strokeDasharray="0.01 4" strokeLinecap="round" />
        </Frame>
      );
    case "unit":
      // A block, one window lit.
      return (
        <Frame>
          <path {...S} d="M20 38 V10 H56 V38 Z" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <rect
                key={`${r}-${c}`}
                x={26 + c * 9}
                y={15 + r * 7}
                width="5"
                height="4"
                {...(r === 1 && c === 2 ? DOT : { ...S, strokeWidth: 1 })}
              />
            )),
          )}
        </Frame>
      );
    case "room":
      // A bed, made up for one night.
      return (
        <Frame>
          <path {...S} d="M14 34 V20 h14 a6 6 0 0 1 6 6 v2 h28 v6" />
          <path {...S} d="M14 34 H62" />
          <path {...S} d="M20 20 V16 h10 v4" strokeWidth={1.2} />
        </Frame>
      );
    case "consult":
      // A table and two chairs. Nothing signed.
      return (
        <Frame>
          <path {...S} d="M16 24 H60" />
          <path {...S} d="M22 24 V34 M54 24 V34" strokeWidth={1.2} />
          <circle cx="26" cy="15" r="3.6" {...S} />
          <circle cx="50" cy="15" r="3.6" {...S} />
        </Frame>
      );
    case "order":
      // A parcel with its label corner turned up.
      return (
        <Frame>
          <path {...S} d="M16 14 H60 V36 H16 Z" />
          <path {...S} d="M16 22 H60" strokeWidth={1.2} />
          <path {...S} d="M48 14 V36" strokeWidth={1.2} strokeDasharray="0.01 3.6" strokeLinecap="round" />
          <circle cx="54" cy="29" r="2" {...DOT} />
        </Frame>
      );
    case "enrolment":
      // A register: names down the left, a tick column on the right.
      return (
        <Frame>
          <path {...S} d="M14 8 V38 H62 V8 Z" />
          <path {...S} d="M48 8 V38" strokeWidth={1.2} />
          {[0, 1, 2].map((i) => (
            <path key={i} {...S} strokeWidth={1.2} d={`M20 ${16 + i * 8} H42`} />
          ))}
          <path {...S} d="M52 22 l3 3 l5 -6" />
        </Frame>
      );
    case "class":
      // Places in a class. Two left.
      return (
        <Frame>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const x = 14 + (i % 4) * 16;
            const y = 16 + Math.floor(i / 4) * 14;
            return i < 6 ? (
              <circle key={i} cx={x} cy={y} r="3.4" {...DOT} />
            ) : (
              <circle key={i} cx={x} cy={y} r="3.4" {...S} />
            );
          })}
        </Frame>
      );
    case "appointment":
      // A clock, with the slot taken out of it.
      return (
        <Frame>
          <circle cx="38" cy="23" r="15" {...S} />
          <path {...S} d="M38 23 V12 M38 23 l8 5" />
          <path {...S} d="M38 23 L53 23 A15 15 0 0 0 46 10 Z" strokeWidth={1.2} />
        </Frame>
      );
  }
}
