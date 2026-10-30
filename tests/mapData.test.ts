import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuditRow } from "../src/lib/audit";
import type { ProgramItem } from "../src/lib/plan";
import { arcCoords, buildMapData, defaultChoices, legWidth, planState, type MapInput } from "../src/lib/mapData";

const site = { lat: 42.7, lon: -87.9, label: "Data center site" };

function item(id: string, bucket: ProgramItem["bucket"], amount: number, partner?: Partial<NonNullable<ProgramItem["partner"]>>): ProgramItem {
  return {
    id,
    bucket,
    title: `Item ${id}`,
    detail: "",
    amount,
    sessions: 1,
    unitCost: amount,
    unit: "session",
    costBasis: "",
    months: [2],
    cadence: "Once (month 2)",
    provenance: [],
    partner: partner ? { name: "Somewhere", ...partner } : undefined,
  };
}

function row(over: Partial<AuditRow>): AuditRow {
  return { text: "A line", bucket: "training", verdict: "generic", reasons: [], termHits: [], ...over };
}

const hall = { name: "Civic Hall | Racine", location: { lat: 42.72, lon: -87.85 }, affinityRank: 4, distanceKm: 5.1 };
const library = { name: "Public Library", location: { lat: 42.68, lon: -87.95 }, distanceKm: 3.2 };

function input(audit: AuditRow[], qlooAdds: ProgramItem[] = []): MapInput {
  return {
    site,
    radiusKm: 15,
    placeCount: 50,
    twoYearFund: 2_000_000,
    audit,
    anchors: audit.map((_, i) => `line-${i + 1}`),
    qlooAdds,
    localPlaces: [
      { id: "q-park", name: "Riverside Park", location: { lat: 42.71, lon: -87.91 } },
      { id: "q-hall", name: "Civic Hall | Racine", location: hall.location },
      { id: "q-none", name: "No Coords Cafe" },
    ],
    rankOf: (id) => (id === "q-hall" ? 4 : undefined),
  };
}

const audit: AuditRow[] = [
  // Kept, matched in Qloo: a green venue with an uncosted flow.
  row({ text: "Picnic at Riverside Park", bucket: "events", verdict: "grounded", matched: { name: "Riverside Park", source: "qloo", distanceKm: 1.2 } }),
  // Struck with a swap at a ranked place.
  row({ text: "STEM camp", bucket: "training", verdict: "generic", replacement: item("training-0", "training", 36_000, hall) }),
  // Struck with a swap at an unranked place.
  row({ text: "Chamber breakfast", bucket: "procurement", verdict: "generic", replacement: item("procurement-0", "procurement", 24_000, library) }),
  // Struck, no swap.
  row({ text: "Plant trees", bucket: "events", verdict: "generic" }),
  // Kept, matched only in OpenStreetMap: no map position.
  row({ text: "Fair at the fairgrounds", bucket: "events", verdict: "grounded", matched: { name: "County Fairgrounds", source: "osm", distanceKm: 4 } }),
];

test("map data places kept, ranked and unranked venues and never invents a point", () => {
  const d = buildMapData(input(audit));
  const kinds = Object.fromEntries(d.venues.map((v) => [v.name, v.kind]));
  assert.deepEqual(kinds, { "Riverside Park": "kept", "Civic Hall": "ranked", "Public Library": "unranked" });
  assert.equal(d.venues.find((v) => v.name === "Civic Hall")?.rank, 4);
  // The OpenStreetMap-only match is listed, not drawn.
  assert.deepEqual(
    d.unplaced.map((u) => [u.name, u.source, u.line]),
    [["County Fairgrounds", "OpenStreetMap", 5]],
  );
  // Only places with coordinates make the faint background layer.
  assert.equal(d.places.length, 2);
  assert.equal(d.lines.length, 5);
  assert.equal(d.lines[0].status, "kept");
  assert.equal(d.lines[1].swap?.venue, "civic hall");
  assert.equal(d.lines[3].swap, undefined);
});

test("a partner without coordinates is listed as having no map position", () => {
  const d = buildMapData(input([row({ text: "Swap", replacement: item("training-1", "training", 9000, { name: "No Coords Cafe", distanceKm: 2 }) })]));
  assert.equal(d.venues.length, 0);
  assert.equal(d.lines[0].swap, undefined);
  assert.deepEqual(d.unplaced.map((u) => u.name), ["No Coords Cafe"]);
});

test("flipping a struck line to its swap draws its flow and updates the totals", () => {
  const d = buildMapData(input(audit));
  // The panel opens as drafted.
  assert.ok(Object.values(defaultChoices(d)).every((c) => c === "drafted"));
  const swapped = planState(d, defaultChoices(d, "swap"));
  assert.equal(swapped.localLines, 4);
  assert.equal(swapped.totalLines, 5);
  assert.equal(swapped.total, 60_000);
  assert.deepEqual(swapped.active.map((l) => l.id).sort(), ["kept-1", "procurement-0", "training-0"]);

  const drafted = planState(d, defaultChoices(d));
  assert.equal(drafted.localLines, 2);
  assert.equal(drafted.total, 0);
  assert.deepEqual(drafted.active.map((l) => l.id), ["kept-1"]);
  assert.deepEqual([...drafted.venues], ["riverside park"]);

  // One line flipped back: its flow leaves, the other stays.
  const one = planState(d, { ...defaultChoices(d, "swap"), 2: "drafted" });
  assert.equal(one.localLines, 3);
  assert.equal(one.total, 24_000);
  assert.ok(!one.venues.has("civic hall"));
});

test("the area filter hides flows but never changes the totals", () => {
  const d = buildMapData(input(audit, [item("grants-0", "grants", 50_000, { name: "Museum", location: { lat: 42.6, lon: -87.8 }, affinityRank: 9 })]));
  const all = planState(d, defaultChoices(d, "swap"));
  const noTraining = planState(d, defaultChoices(d, "swap"), new Set(["training"]));
  assert.equal(all.total, 110_000);
  assert.equal(noTraining.total, all.total);
  assert.equal(noTraining.localLines, all.localLines);
  assert.ok(all.visible.some((l) => l.bucket === "training"));
  assert.ok(!noTraining.visible.some((l) => l.bucket === "training"));
  assert.ok(!noTraining.venues.has("civic hall"));
  // Items the draft never named are always drawn.
  assert.ok(noTraining.visible.some((l) => l.id === "grants-0"));
});

test("arcs start at the site, end at the venue and bow to one side", () => {
  const b = { lat: 42.8, lon: -87.7 };
  const pts = arcCoords(site, b, 0.2, 16);
  assert.equal(pts.length, 17);
  assert.deepEqual(pts[0], [site.lon, site.lat]);
  assert.ok(Math.abs(pts[16][0] - b.lon) < 1e-9 && Math.abs(pts[16][1] - b.lat) < 1e-9);
  const mid = pts[8];
  const straight = [(site.lon + b.lon) / 2, (site.lat + b.lat) / 2];
  assert.ok(Math.hypot(mid[0] - straight[0], mid[1] - straight[1]) > 0.005);
  assert.equal(legWidth(0, 100), 1.5);
  assert.equal(legWidth(100, 100), 7);
  assert.ok(legWidth(25, 100) < legWidth(100, 100));
});
