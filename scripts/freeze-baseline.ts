// Freezes the plain-LLM baseline for every preset town so /proof is reproducible.
// For each LLM-named partner it also records whether OpenStreetMap knows a place by that
// name within 25 km, so a real place Qloo lacks is not counted against the LLM.
//
// Run: npx tsx --env-file=.env.local scripts/freeze-baseline.ts

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { BASELINE_PROMPT_VERSION, baselinePrompt, baselineSchema } from "../src/lib/baseline";
import { TOWNS } from "../src/lib/towns";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// OSM Nominatim, bounded to a box around the town. Usage policy: max 1 request/second, identify the app.
async function osmLookup(name: string, town: { lat: number; lon: number }) {
  const d = 0.25;
  const params = new URLSearchParams({
    q: name,
    format: "jsonv2",
    limit: "3",
    viewbox: `${town.lon - d},${town.lat + d},${town.lon + d},${town.lat - d}`,
    bounded: "1",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "townsworth/0.1 (baseline verification)" },
  });
  await sleep(1100);
  if (!res.ok) return { status: res.status, found: false as const };
  const hits = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  const near = hits.find((h) => km(town, { lat: Number(h.lat), lon: Number(h.lon) }) <= 25);
  return near
    ? { status: 200, found: true as const, osmName: near.display_name.split(",")[0], km: Math.round(km(town, { lat: Number(near.lat), lon: Number(near.lon) }) * 10) / 10 }
    : { status: 200, found: false as const };
}

async function main() {
  const towns = [];
  for (const town of TOWNS) {
    const started = Date.now();
    const { output } = await generateText({
      model: openai(MODEL),
      output: Output.object({ schema: baselineSchema }),
      prompt: baselinePrompt(town),
    });
    const items = [];
    for (const it of output.items) {
      items.push({ ...it, osm: it.partner ? await osmLookup(it.partner, town) : null });
    }
    console.log(`${town.slug}: ${items.length} items, ${items.filter((i) => i.partner).length} named, ${Date.now() - started} ms`);
    towns.push({ slug: town.slug, items });
  }
  const body = { promptVersion: BASELINE_PROMPT_VERSION, model: MODEL, createdAt: new Date().toISOString(), towns };
  const json = JSON.stringify(body, null, 2);
  const sha256 = createHash("sha256").update(json).digest("hex");
  const date = body.createdAt.slice(0, 10);
  writeFileSync(`data/baseline-${date}.json`, json);
  writeFileSync("data/baseline-latest.json", JSON.stringify({ file: `baseline-${date}.json`, sha256 }, null, 2));
  console.log(`wrote data/baseline-${date}.json sha256=${sha256}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
