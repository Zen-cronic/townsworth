import Link from "next/link";
import { Chevron } from "./Chevron";

// The host-town stack: three isometric slabs, drawn by hand in SVG. Bottom to top: the facility
// and its draft plan, the host town and the places locals favour, and the costed program.
// On wide screens the slabs separate as the section scrolls past (CSS scroll-driven animation, or a
// one-shot class where that isn't supported); below 900px and under reduced motion it renders
// already separated, one slab per step.

export interface StackData {
  town: string;
  commitments: { topic: string; value: string; note: string }[];
  places: { name: string; rank?: number }[];
  items: { kind: string; partner?: string; amount: string }[];
  struck?: string;
  memoHref: string;
  ballotHref: string;
  auditHref: string;
}

// Projection: x runs to the right-front, y to the left-front, z up.
const C = 0.866;
const S = 0.5;
const VW = 760;
const VH = 422;
const OX = 380;
const OY = 110;
const L = 290;
const T = 12;
const STEP = 200; // vertical distance between slabs when separated, in view units

type Pt = [number, number];
const P = (x: number, y: number, z = 0): Pt => [OX + (x - y) * C, OY + (x + y) * S - z];
const pts = (...p: Pt[]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
// Lowest edge of a slab (its front corner and sides) at screen x, for connectors that rise to it.
const underside = (sx: number) => OY + 2 * L * S + T - Math.abs(sx - OX) * (S / C);

function Slab() {
  return (
    <g>
      <polygon className="st-l" points={pts(P(0, L), P(L, L), [P(L, L)[0], P(L, L)[1] + T], [P(0, L)[0], P(0, L)[1] + T])} />
      <polygon className="st-r" points={pts(P(L, 0), P(L, L), [P(L, L)[0], P(L, L)[1] + T], [P(L, 0)[0], P(L, 0)[1] + T])} />
      <polygon className="st-top" points={pts(P(0, 0), P(L, 0), P(L, L), P(0, L))} />
    </g>
  );
}

function Box({ x, y, w, d, h, z = 0, tone = "" }: { x: number; y: number; w: number; d: number; h: number; z?: number; tone?: string }) {
  return (
    <g className={tone}>
      <polygon className="st-l" points={pts(P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x, y + d, z))} />
      <polygon className="st-r" points={pts(P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x + w, y, z))} />
      <polygon className="st-top" points={pts(P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h))} />
    </g>
  );
}

// A gabled house, ridge running front to back.
function House({ x, y, w = 20, d = 22, h = 13, r = 9, tone = "st-quiet" }: { x: number; y: number; w?: number; d?: number; h?: number; r?: number; tone?: string }) {
  const m = x + w / 2;
  return (
    <g className={tone}>
      <polygon className="st-top" points={pts(P(x, y, h), P(m, y, h + r), P(m, y + d, h + r), P(x, y + d, h))} />
      <polygon className="st-r" points={pts(P(x + w, y, h), P(x + w, y + d, h), P(x + w, y + d, 0), P(x + w, y, 0))} />
      <polygon className="st-top" points={pts(P(m, y, h + r), P(x + w, y, h), P(x + w, y + d, h), P(m, y + d, h + r))} />
      <polygon className="st-l" points={pts(P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(m, y + d, h + r), P(x, y + d, h))} />
    </g>
  );
}

function Tree({ x, y }: { x: number; y: number }) {
  const [bx, by] = P(x, y, 0);
  return (
    <g className="st-tree">
      <line x1={bx} y1={by} x2={bx} y2={by - 12} />
      <circle cx={bx} cy={by - 17} r={6.5} />
    </g>
  );
}

// A flat line drawn on a surface, along x.
const lineX = (x1: number, x2: number, y: number, z = 0) => {
  const [a, b] = P(x1, y, z);
  const [c, d] = P(x2, y, z);
  return { x1: a, y1: b, x2: c, y2: d };
};

// Dashed rising connector, from a point on this slab up to the underside of the slab above.
function Rise({ at, arrow = true }: { at: Pt; arrow?: boolean }) {
  const top = underside(at[0]) - STEP + 6;
  return (
    <g className="st-rise">
      <line x1={at[0]} y1={at[1]} x2={at[0]} y2={top} />
      {arrow && <path d={`M${at[0] - 3},${top + 6} L${at[0]},${top} L${at[0] + 3},${top + 6}`} />}
    </g>
  );
}

// Corner posts between this slab and the one above.
function Posts() {
  const left = P(0, L);
  const right = P(L, 0);
  return (
    <g className="st-rise st-post">
      <line x1={left[0]} y1={left[1]} x2={left[0]} y2={left[1] + T - STEP} />
      <line x1={right[0]} y1={right[1]} x2={right[0]} y2={right[1] + T - STEP} />
    </g>
  );
}

const pct = ([x, y]: Pt) => ({ "--x": `${((x / VW) * 100).toFixed(2)}%`, "--y": `${((y / VH) * 100).toFixed(2)}%` }) as React.CSSProperties;

function Callouts({ items, label }: { items: { at: Pt; side: "l" | "r"; tone: "ink" | "ok"; k: string; v: string }[]; label: string }) {
  return (
    <ul className="st-callouts" aria-label={label}>
      {items.map((c) => (
        <li key={c.k + c.v} className={`st-co is-${c.side} is-${c.tone}`} style={pct(c.at)}>
          <span className="st-co-text">
            <b>{c.k}</b> {c.v}
          </span>
          <i className="st-co-lead" aria-hidden="true" />
          <i className="st-co-mark" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
}

function FacilityLayer({ data }: { data: StackData }) {
  const sheet = { x: 58, y: 168, w: 112, d: 96 };
  const lines = [0, 1, 2, 3, 4, 5].map((k) => sheet.y + 14 + k * 13);
  const struck = 2;
  const tank = P(238, 196, 0);
  const at = {
    Jobs: P(115, 130, 30),
    Power: P(272, 66, 8),
    Water: [tank[0] + 22, tank[1] - 20] as Pt,
    Tax: P(16, 250, 0),
  } as Record<string, Pt>;
  const sides: Record<string, "l" | "r"> = { Jobs: "l", Tax: "l", Power: "r", Water: "r" };
  return (
    <>
      <svg className="st-art" viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true" focusable="false">
        <Posts />
        <Rise at={P(115, 95, 44)} />
        <Rise at={P(sheet.x + sheet.w / 2, sheet.y + 20, 1)} />
        <Slab />
        <polygon className="st-parcel" points={pts(P(14, 14), P(276, 14), P(276, 276), P(14, 276))} />
        {/* Substation */}
        <polygon className="st-fence" points={pts(P(208, 34), P(276, 34), P(276, 100), P(208, 100))} />
        <Box x={218} y={46} w={14} h={18} d={14} />
        <Box x={244} y={46} w={14} h={18} d={14} />
        <Box x={218} y={74} w={14} h={18} d={14} />
        <Box x={244} y={74} w={14} h={18} d={14} />
        {/* Data hall and rooftop plant */}
        <Box x={40} y={44} w={150} d={90} h={44} />
        {[0, 1, 2, 3].flatMap((i) => [
          <Box key={`a${i}`} x={54 + i * 33} y={56} w={18} d={18} h={7} z={44} />,
          <Box key={`b${i}`} x={54 + i * 33} y={98} w={18} d={18} h={7} z={44} />,
        ])}
        {/* Water tank */}
        <g className="st-tank">
          <path d={`M${tank[0] - 24.5},${tank[1] - 34} L${tank[0] - 24.5},${tank[1]} A24.5 14.1 0 0 0 ${tank[0] + 24.5},${tank[1]} L${tank[0] + 24.5},${tank[1] - 34}`} className="st-r" />
          <ellipse cx={tank[0]} cy={tank[1] - 34} rx={24.5} ry={14.1} className="st-top" />
        </g>
        {/* The draft plan, lying on site */}
        <polygon className="st-sheet" points={pts(P(sheet.x, sheet.y, 1), P(sheet.x + sheet.w, sheet.y, 1), P(sheet.x + sheet.w, sheet.y + sheet.d, 1), P(sheet.x, sheet.y + sheet.d, 1))} />
        {lines.map((y, k) => (
          <line key={k} className={k === struck ? "st-text is-struck" : "st-text"} {...lineX(sheet.x + 12, sheet.x + sheet.w - 14 - ((k * 17) % 30), y, 1)} />
        ))}
        <line className="st-pen" {...lineX(sheet.x + 8, sheet.x + sheet.w - 10, lines[struck], 1)} />
      </svg>
      <Callouts
        label="Material commitments"
        items={data.commitments.map((c) => ({ at: at[c.topic] ?? P(140, 140), side: sides[c.topic] ?? "l", tone: "ink" as const, k: c.topic, v: c.value }))}
      />
    </>
  );
}

const PLACE_SPOTS: [number, number][] = [
  [214, 58],
  [222, 196],
  [96, 214],
  [46, 92],
];

function TownLayer({ data }: { data: StackData }) {
  const houses: [number, number][] = [
    [150, 228],
    [182, 238],
    [254, 120],
    [30, 160],
    [120, 184],
    [178, 186],
    [248, 238],
    [60, 246],
    [100, 30],
    [30, 30],
  ];
  const trees: [number, number][] = [
    [196, 100],
    [130, 250],
    [270, 170],
    [20, 210],
    [70, 140],
    [160, 70],
    [240, 270],
  ];
  const places = data.places.slice(0, PLACE_SPOTS.length);
  const sides: ("l" | "r")[] = ["r", "r", "l", "l"];
  return (
    <>
      <svg className="st-art" viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true" focusable="false">
        <Posts />
        {places.map((_, i) => (
          <Rise key={i} at={P(PLACE_SPOTS[i][0] + 15, PLACE_SPOTS[i][1] + 12, 26)} />
        ))}
        <Slab />
        {/* Streets */}
        <line className="st-road" {...lineX(10, 280, 148)} />
        <line className="st-road" {...lineX(10, 280, 160)} />
        <line className="st-road" x1={P(140, 10)[0]} y1={P(140, 10)[1]} x2={P(140, 280)[0]} y2={P(140, 280)[1]} />
        <line className="st-road" x1={P(152, 10)[0]} y1={P(152, 10)[1]} x2={P(152, 280)[0]} y2={P(152, 280)[1]} />
        {[...houses.map(([x, y]) => ({ k: `h${x}-${y}`, x, y, kind: "house" as const })), ...trees.map(([x, y]) => ({ k: `t${x}-${y}`, x, y, kind: "tree" as const })), ...places.map((_, i) => ({ k: `p${i}`, x: PLACE_SPOTS[i][0], y: PLACE_SPOTS[i][1], kind: "place" as const }))]
          .sort((a, b) => a.x + a.y - (b.x + b.y))
          .map((o) =>
            o.kind === "house" ? (
              <House key={o.k} x={o.x} y={o.y} />
            ) : o.kind === "tree" ? (
              <Tree key={o.k} x={o.x} y={o.y} />
            ) : (
              <g key={o.k}>
                <Box x={o.x} y={o.y} w={30} d={26} h={20} tone="st-place" />
                <Box x={o.x} y={o.y + 26} w={30} d={5} h={4} z={13} tone="st-awning" />
              </g>
            ),
          )}
      </svg>
      <Callouts
        label={`Places ${data.town} favours`}
        items={places.map((p, i) => ({
          at: P(PLACE_SPOTS[i][0] + 15, PLACE_SPOTS[i][1] + 13, 20),
          side: sides[i],
          tone: "ok" as const,
          k: p.rank ? `#${p.rank}` : "Local",
          v: p.name,
        }))}
      />
    </>
  );
}

const TILE_SPOTS: [number, number][] = [
  [150, 40],
  [196, 150],
  [42, 150],
];

function ProgramLayer({ data }: { data: StackData }) {
  const items = data.items.slice(0, TILE_SPOTS.length);
  const sides: ("l" | "r")[] = ["r", "r", "l"];
  return (
    <>
      <svg className="st-art" viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true" focusable="false">
        <Slab />
        {/* Planning board: one tile per costed item */}
        {items.map((_, i) => {
          const [x, y] = TILE_SPOTS[i];
          return (
            <g key={i}>
              <Box x={x} y={y} w={84} d={72} h={6} tone="st-tile" />
              <line className="st-tile-edge" x1={P(x, y + 72, 6)[0]} y1={P(x, y + 72, 6)[1]} x2={P(x, y, 6)[0]} y2={P(x, y, 6)[1]} />
              {[0, 1, 2].map((k) => (
                <line key={k} className="st-text" {...lineX(x + 12, x + 70 - k * 14, y + 16 + k * 12, 6)} />
              ))}
            </g>
          );
        })}
        {/* The memo, as a short stack of sheets */}
        {[0, 1, 2].map((k) => (
          <Box key={`m${k}`} x={56 + k * 2} y={40 - k * 2} w={62} d={76} h={2.5} z={k * 3} tone="st-memo" />
        ))}
        {[0, 1, 2, 3].map((k) => (
          <line key={`ml${k}`} className="st-text" {...lineX(68, 108 - (k % 2) * 12, 50 + k * 11, 9)} />
        ))}
        {/* Ballot box with its slot */}
        <Box x={120} y={232} w={40} d={34} h={30} />
        <line className="st-slot" {...lineX(130, 150, 249, 30)} />
      </svg>
      <Callouts
        label="Program items"
        items={items.map((it, i) => ({
          at: P(TILE_SPOTS[i][0] + 42, TILE_SPOTS[i][1] + 36, 6),
          side: sides[i],
          tone: "ok" as const,
          k: it.amount,
          v: it.partner ? `${it.kind} · ${it.partner}` : it.kind,
        }))}
      />
    </>
  );
}

export function HostStack({ data, nextId }: { data: StackData; nextId: string }) {
  const steps = [
    {
      n: "01 · In",
      title: "Bring the draft",
      body: "The plan you already have, from a consultant or from AI. The facility’s jobs, power, water and tax commitments sit underneath it, untouched.",
      layer: <FacilityLayer data={data} />,
    },
    {
      n: "02 · Signals",
      title: "See where the town actually goes",
      body: `Qloo ranks the places within 15 km of ${data.town} by how strongly locals favour them. Lines that could fit any town are struck; the institutions the draft names stay.`,
      layer: <TownLayer data={data} />,
    },
    {
      n: "03 · Out",
      title: "Get a costed program for the committee",
      body: "Every item has a host venue or supplier, a session count and a cost from your fund. Residents rank the shortlist before anything is booked.",
      layer: <ProgramLayer data={data} />,
      links: (
        <span className="st-links">
          <Link href={data.memoHref} className="lp-textlink">
            The memo <Chevron />
          </Link>
          <Link href={data.ballotHref} className="lp-textlink">
            The ballot <Chevron />
          </Link>
        </span>
      ),
    },
  ];
  return (
    <div className="st-scroll" data-reveal>
      <div className="st-stage">
        <a href={`#${nextId}`} className="st-skip">
          Skip the animation
        </a>
        <p className="st-cue" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
            <path d="M8 13V3M4 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Read from the ground up
        </p>
        <ol className="st-steps">
          {steps.map((s, i) => (
            <li key={s.n} className={`st-step is-${i}`}>
              <div className="st-copy">
                <p className="lp-step-n">{s.n}</p>
                <h3 className="lp-h3">{s.title}</h3>
                <p className="st-body">{s.body}</p>
                {s.links}
              </div>
              <div className={`st-layer is-${i}`}>{s.layer}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
