export interface SitePoint {
  east: number; // km east of the site
  north: number; // km north of the site
  partner: boolean;
  label?: string;
}

const R_KM = 15;
const C = 150;
const R_PX = 128;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Put each label on the side of its marker that covers the fewest other markers and labels.
function placeLabels(marks: { x: number; y: number; label?: string }[]) {
  const placed: Box[] = [{ x: C - 9, y: C - 9, w: 18, h: 18 }];
  const out: { text: string; x: number; y: number; anchor: "start" | "end" | "middle" }[] = [];
  for (const m of marks) {
    if (!m.label) continue;
    const w = m.label.length * 6.9 + 4;
    const h = 14;
    const options = [
      { x: m.x + 11, y: m.y + 4, anchor: "start" as const, box: { x: m.x + 9, y: m.y - 8, w, h } },
      { x: m.x - 11, y: m.y + 4, anchor: "end" as const, box: { x: m.x - 9 - w, y: m.y - 8, w, h } },
      { x: m.x, y: m.y - 12, anchor: "middle" as const, box: { x: m.x - w / 2, y: m.y - 23, w, h } },
      { x: m.x, y: m.y + 21, anchor: "middle" as const, box: { x: m.x - w / 2, y: m.y + 10, w, h } },
    ];
    const score = (b: Box) =>
      marks.filter((o) => o !== m && overlaps(b, { x: o.x - 7, y: o.y - 7, w: 14, h: 14 })).length +
      placed.filter((p) => overlaps(b, p)).length * 10 +
      (b.x < 2 || b.x + b.w > 298 || b.y < 14 || b.y + b.h > 298 ? 25 : 0);
    const best = options.reduce((a, b) => (score(b.box) < score(a.box) ? b : a));
    // A label that would sit on another marker or label is dropped rather than drawn ambiguously.
    if (score(best.box) > 0) continue;
    placed.push({ x: best.box.x - 6, y: best.box.y - 6, w: best.box.w + 12, h: best.box.h + 12 });
    out.push({ text: m.label, x: best.x, y: best.y, anchor: best.anchor });
  }
  return out;
}

// The town as a site plan: every Qloo place within 15 km, plotted at its real bearing and distance.
function SitePlan({ points, town }: { points: SitePoint[]; town: string }) {
  const s = R_PX / R_KM;
  const partners = points.filter((p) => p.partner).length;
  const xy = points.map((p) => ({ x: C + p.east * s, y: C - p.north * s, partner: p.partner, label: p.label }));
  const partnerMarks = xy.filter((p) => p.partner);
  const labels = placeLabels(xy);
  return (
    <svg
      className="lp-siteplan"
      viewBox="0 0 300 300"
      role="img"
      aria-label={`Site plan of ${town}: ${points.length} Qloo places within ${R_KM} km, ${partners} chosen as partners`}
    >
      {[5, 10, 15].map((km) => (
        <g key={km}>
          <circle cx={C} cy={C} r={km * s} className={km === 15 ? "sp-ring sp-ring-outer" : "sp-ring"} />
          <text x={C + 3} y={C - km * s - 3} className="sp-label">
            {km} km
          </text>
        </g>
      ))}
      <line x1={C - R_PX - 8} y1={C} x2={C + R_PX + 8} y2={C} className="sp-axis" />
      <line x1={C} y1={C - R_PX - 8} x2={C} y2={C + R_PX + 8} className="sp-axis" />
      <text x={C} y={10} textAnchor="middle" className="sp-label sp-north">
        N
      </text>
      {points
        .filter((p) => !p.partner)
        .map((p, i) => (
          <circle key={`o${i}`} cx={C + p.east * s} cy={C - p.north * s} r={2.4} className="sp-place" />
        ))}
      {partnerMarks.map((m, i) => (
        <g key={`p${i}`}>
          <circle cx={m.x} cy={m.y} r={7} className="sp-partner-ring" />
          <circle cx={m.x} cy={m.y} r={3.4} className="sp-partner" />
        </g>
      ))}
      {labels.map((l) => (
        <text key={l.text} x={l.x} y={l.y} textAnchor={l.anchor} className="sp-name">
          {l.text}
        </text>
      ))}
      <rect x={C - 6} y={C - 6} width={12} height={12} className="sp-site" transform={`rotate(45 ${C} ${C})`} />
    </svg>
  );
}

export interface DraftLine {
  text: string;
  kept: boolean;
}

const short = (t: string, n = 46) => (t.length <= n ? t : `${t.slice(0, t.lastIndexOf(" ", n))}…`);

// The whole draft at a glance: every item, kept or struck.
function DraftSheet({ lines }: { lines: DraftLine[] }) {
  return (
    <div className="lp-doc" aria-hidden="true">
      <p className="lp-doc-title">Draft community plan</p>
      <ol>
        {lines.map((l, i) => (
          <li key={i} className={l.kept ? "is-kept" : "is-struck"}>
            <span className="lp-doc-mark">{l.kept ? "✓" : ""}</span>
            <span className="lp-doc-text">{short(l.text)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DocGlyph({ kind }: { kind: "memo" | "sheet" | "calendar" | "drafts" }) {
  if (kind === "sheet") {
    return (
      <svg viewBox="0 0 60 44" className="lp-doc-glyph" aria-hidden="true" focusable="false">
        {[0, 1, 2, 3, 4].map((r) => (
          <line key={r} x1="0" x2="60" y1={4 + r * 9} y2={4 + r * 9} />
        ))}
        <line x1="22" x2="22" y1="0" y2="40" />
        <line x1="42" x2="42" y1="0" y2="40" />
      </svg>
    );
  }
  if (kind === "calendar") {
    return (
      <svg viewBox="0 0 60 44" className="lp-doc-glyph" aria-hidden="true" focusable="false">
        {Array.from({ length: 18 }, (_, i) => (
          <rect key={i} x={(i % 6) * 10} y={Math.floor(i / 6) * 12 + 4} width="7" height="8" className={i === 4 || i === 9 || i === 15 ? "is-on" : ""} />
        ))}
      </svg>
    );
  }
  const widths = kind === "memo" ? [60, 52, 58, 40, 56, 34] : [44, 60, 54, 60, 30];
  return (
    <svg viewBox="0 0 60 44" className="lp-doc-glyph" aria-hidden="true" focusable="false">
      {widths.map((w, i) => (
        <line key={i} x1="0" x2={w} y1={4 + i * 7.5} y2={4 + i * 7.5} className={kind === "memo" && i === 0 ? "is-head" : ""} />
      ))}
    </svg>
  );
}

const OUTPUTS = [
  { kind: "memo", name: "Commitments memo", note: "Commitments first" },
  { kind: "sheet", name: "Partner sheet", note: "CSV" },
  { kind: "calendar", name: "24-month calendar", note: "ICS" },
  { kind: "drafts", name: "Outreach drafts", note: "For review" },
] as const;

export function HowItWorks({ points, town, draft }: { points: SitePoint[]; town: string; draft: DraftLine[] }) {
  return (
    <section className="lp-section" aria-labelledby="how-h">
      <div className="lp-wrap">
        <div className="lp-section-head">
          <div>
            <p className="lp-kicker">How it works</p>
            <h2 id="how-h" className="lp-h2">
              One draft in. A program the town would recognize out.
            </h2>
          </div>
        </div>

        <ol className="lp-steps">
          <li className="lp-step">
            <div className="lp-step-art">
              <DraftSheet lines={draft} />
            </div>
            <p className="lp-step-n">01 · In</p>
            <h3 className="lp-h3">Your draft plan</h3>
            <p className="lp-step-copy">
              The plan an agency or a plain LLM wrote. Each item is checked: real local partners are kept, generic
              ones are struck.
            </p>
          </li>
          <li className="lp-step">
            <div className="lp-step-art">
              <SitePlan points={points} town={town} />
              <p className="lp-step-legend">
                <span>
                  <i className="lg-site" aria-hidden="true" /> Site
                </span>
                <span>
                  <i className="lg-partner" aria-hidden="true" /> Proposed partner
                </span>
                <span>
                  <i className="lg-place" aria-hidden="true" /> Other Qloo place
                </span>
              </p>
            </div>
            <p className="lp-step-n">02 · Signals</p>
            <h3 className="lp-h3">Qloo local signals</h3>
            <p className="lp-step-copy">
              Places within 15 km of the site, plus the brands and artists the town over-indexes on against the
              national top 20. Every pick keeps the signal behind it.
            </p>
          </li>
          <li className="lp-step">
            <div className="lp-step-art lp-outputs">
              <ul>
                {OUTPUTS.map((o, i) => (
                  <li key={o.name} style={{ "--i": i } as React.CSSProperties}>
                    <DocGlyph kind={o.kind} />
                    <span className="lp-out-name">{o.name}</span>
                    <span className="lp-out-note">{o.note}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="lp-step-n">03 · Out</p>
            <h3 className="lp-h3">A costed program, ready to discuss</h3>
            <p className="lp-step-copy">
              Amounts come from your own fund, never from Qloo. Residents rank the shortlist before anything is
              booked.
            </p>
          </li>
        </ol>
      </div>
    </section>
  );
}
