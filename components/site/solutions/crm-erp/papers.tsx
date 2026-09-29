import type { ReactNode } from "react";
import type { PaperFace as Face } from "@/lib/pages/crm-erp";

/* ------------------------------------------------------------------ *
 * #process — the strip at the top of each Today paper: a small drawing
 * of where the step lives today, so the scatter reads as eight different
 * tools before a word of it is read. An inbox of messages, a document
 * copied from a template, a note stuck to a screen, a spreadsheet, a
 * grid of shelves, a shared calendar, an invoice with its total, a chart
 * put together by hand.
 *
 * Drawn in two tones, the landing's lilac for what the thing is and a
 * grey for its lines of content (`.erp-face-a`, `.erp-face-b`,
 * erp-drawing.css §2), on a strip 140 × 14 units, set from the paper's
 * left edge at the strip's height (14px). No words, no digits, no
 * brand: a value is a grey bar, as in the record window's screens.
 * aria-hidden, as the whole drawing is: the paper's title, where it
 * lives and its pain carry it in words beside it.
 *
 * PURE: no hooks, types only from the data module.
 * ------------------------------------------------------------------ */

/** A grey bar of content: a line of text, a cell's value. */
const Bar = ({ x, y, w, h = 2.5 }: { x: number; y: number; w: number; h?: number }) => (
  <rect x={x} y={y} width={w} height={h} rx={h / 2} className="erp-face-b" />
);

const FACES: Record<Face, ReactNode> = {
  // Three messages in a list: an envelope, a sender's line and a subject's, each.
  inbox: (
    <>
      {[0, 48, 96].map((x) => (
        <g key={x}>
          <rect x={x + 0.75} y={1.75} width={16} height={10.5} rx={1.5} className="erp-face-line" />
          <path d={`M${x + 1.5} 2.5 L${x + 8.75} 8 L${x + 16} 2.5`} className="erp-face-line" />
          <Bar x={x + 21} y={3} w={20} />
          <Bar x={x + 21} y={8.5} w={13} />
        </g>
      ))}
    </>
  ),
  // A page with its corner folded, its lines copied from the one before.
  document: (
    <>
      <path d="M0.75 0.75 H9 L12.25 4 V13.25 H0.75 Z" className="erp-face-line" />
      <path d="M9 0.75 V4 H12.25" className="erp-face-line" />
      <Bar x={18} y={1.5} w={46} />
      <Bar x={18} y={5.75} w={82} />
      <Bar x={18} y={10} w={64} />
      <rect x={108} y={1} width={32} height={12} rx={2} className="erp-face-a" />
    </>
  ),
  // A note stuck on, and a line scribbled on it.
  note: (
    <>
      <rect x={1} y={0.5} width={13} height={13} rx={1.5} className="erp-face-a" transform="rotate(-4 7.5 7)" />
      <path d="M20 9 q4 -6 8 0 t8 0 t8 0 t8 0" className="erp-face-line" />
      <Bar x={64} y={5.75} w={30} />
    </>
  ),
  // A spreadsheet: a header row and two rows of cells.
  sheet: (
    <>
      {[0, 20, 40, 60, 80, 100, 120].map((x, i) => (
        <g key={x}>
          <rect x={x} y={0} width={18} height={4} rx={1} className="erp-face-a" />
          <Bar x={x + 1} y={6.25} w={i % 3 === 0 ? 14 : 10} h={2.5} />
          <Bar x={x + 1} y={10.75} w={i % 2 === 0 ? 11 : 15} h={2.5} />
        </g>
      ))}
    </>
  ),
  // Shelves in a grid, some full and some not.
  grid: (
    <>
      {Array.from({ length: 20 }, (_, i) => {
        const x = (i % 10) * 14;
        const y = Math.floor(i / 10) * 7.5;
        return <rect key={i} x={x} y={y} width={12} height={6} rx={1} className={[1, 2, 5, 8, 11, 14, 15, 18].includes(i) ? "erp-face-a" : "erp-face-c"} />;
      })}
    </>
  ),
  // A week in a shared calendar: seven days, two of them pencilled in.
  calendar: (
    <>
      {[0, 20, 40, 60, 80, 100, 120].map((x, i) => (
        <g key={x}>
          <rect x={x + 0.5} y={0.5} width={17} height={13} rx={2} className="erp-face-line" />
          <rect x={x + 0.5} y={0.5} width={17} height={3.5} rx={1.5} className="erp-face-c" />
          {i === 2 || i === 5 ? <rect x={x + 3} y={6.5} width={12} height={4.5} rx={1} className="erp-face-a" /> : null}
        </g>
      ))}
    </>
  ),
  // An invoice: its lines, its torn edge, and the total set apart.
  invoice: (
    <>
      <path d="M0.75 0.75 H14.25 V12 L12 13.25 L9.75 12 L7.5 13.25 L5.25 12 L3 13.25 L0.75 12 Z" className="erp-face-line" />
      <Bar x={20} y={1.5} w={50} />
      <Bar x={20} y={5.75} w={50} />
      <Bar x={20} y={10} w={50} />
      <Bar x={78} y={1.5} w={14} />
      <Bar x={78} y={5.75} w={14} />
      <Bar x={78} y={10} w={14} />
      <rect x={104} y={4.5} width={36} height={8.5} rx={2} className="erp-face-a" />
    </>
  ),
  // A chart put together by hand: bars on a baseline.
  chart: (
    <>
      {[9, 6, 11, 4, 8, 12, 7, 10, 5, 13].map((h, i) => (
        <rect key={i} x={2 + i * 14} y={13 - h} width={9} height={h} rx={1} className={i % 3 === 2 ? "erp-face-a" : "erp-face-c"} />
      ))}
      <path d="M0 13.5 H140" className="erp-face-line" />
    </>
  ),
};

/** A Today paper's strip: a drawing of where the step lives today. */
export function PaperFace({ face }: { face: Face }) {
  return (
    <svg aria-hidden viewBox="0 0 140 14" preserveAspectRatio="xMinYMid meet" className="erp-face block h-3.5 w-full overflow-visible">
      {FACES[face]}
    </svg>
  );
}
