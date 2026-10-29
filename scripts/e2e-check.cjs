#!/usr/bin/env node
// Browser smoke check for /check: sample plan -> check -> results, then a mocked 429.
//
// Playwright is not a dependency of this repo. Point NODE_PATH at an install that has it:
//   NODE_PATH=~/.npm/_npx/<hash>/node_modules node scripts/e2e-check.cjs \
//     --base http://localhost:4317 --town mount-pleasant-wi --widths 1440,390 --shots /path/to/dir
//
// Only the first width sends a real POST /api/check. Later widths replay that response from memory
// (nothing is written to disk), so one run costs at most one model call. Start the server with
// CHECK_MODEL_FIXTURE=1 to make that call deterministic and free.
// The script fails if any request URL or the page URL contains a phrase from the sample plan.

const { chromium } = require("playwright");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg("base", "http://localhost:4317");
const TOWN = arg("town", "mount-pleasant-wi");
const WIDTHS = arg("widths", "1440").split(",").map(Number);
const SHOTS = arg("shots", "");
const LABEL = arg("label", "");
// Sent as x-real-ip so separate runs get separate rate-limit windows on a local server.
const IP = arg("ip", "");
// --dry swaps the sample for a short plan (under SHORT_INPUT), so the server makes no model call.
const DRY = process.argv.includes("--dry");
const SHORT_PLAN = [
  "Sponsor a STEM summer camp",
  "Host a fall festival downtown",
  "Fund a holiday lights display",
  "Run newspaper ads for jobs",
  "Plant trees on the main road",
  "Sponsor a 5K fun run in town",
  "Give to the regional pantry",
  "Jazz night in the park",
  "Breakfast with the chamber",
  "Robotics team sponsorship",
].join("\n");

// Distinctive phrases from SAMPLE_PLAN (src/lib/userPlanParse.ts).
const PHRASES = ["welding", "electrical certificate", "advisory panel", "street trees", "service club", "construction-phase catering", "food bank"];

const RATE_LIMITED = { error: "Too many plan checks from your network. Try again in about 9 min; the program and exports still work." };

function fail(msg) {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
}

(async () => {
  const browser = await chromium.launch();
  const urls = [];
  let captured = null;
  const report = { town: TOWN, widths: [] };

  for (const [n, width] of WIDTHS.entries()) {
    const ctx = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 900 },
      reducedMotion: "reduce",
      extraHTTPHeaders: IP ? { "x-real-ip": IP } : {},
    });
    const page = await ctx.newPage();
    page.on("request", (r) => urls.push(r.url()));
    const shot = async (state) => {
      if (!SHOTS) return;
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.screenshot({ path: `${SHOTS}/${LABEL ? `${LABEL}-` : ""}${state}-${width}.png`, fullPage: state === "done" });
    };

    const replay = n > 0 && captured;
    if (DRY && !replay) {
      await page.route("**/api/check", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}");
        await route.fulfill({ response: await route.fetch({ postData: JSON.stringify({ ...body, text: SHORT_PLAN }) }) });
      });
    }
    if (replay) {
      await page.route("**/api/check", async (route) => {
        await new Promise((r) => setTimeout(r, 4000));
        await route.fulfill({ status: 200, contentType: "application/json", body: captured });
      });
    }

    await page.goto(`${BASE}/check?town=${encodeURIComponent(TOWN)}`, { waitUntil: "networkidle", timeout: 120_000 });
    await shot("idle");

    await page.getByRole("button", { name: "Try a sample plan" }).click();
    const submit = page.getByRole("button", { name: "Check this draft" });
    const responseP = replay ? null : page.waitForResponse((r) => r.url().endsWith("/api/check"), { timeout: 90_000 });
    const started = Date.now();
    await submit.click();
    await page.getByRole("status").filter({ hasText: "Usually 15–30 seconds" }).waitFor({ timeout: 5_000 });
    await page.waitForTimeout(2_500);
    // A fast (dry) response may already be done; scroll to the progress line only if it's there.
    await page.getByRole("status").evaluateAll((els) => els[0]?.scrollIntoView({ block: "end" }));
    await page.evaluate(() => window.scrollBy(0, 48));
    await shot("checking");

    if (responseP) {
      const res = await responseP;
      if (res.status() !== 200) fail(`POST /api/check returned ${res.status()}`);
      captured = await res.text();
    }
    const heading = page.getByRole("heading", { name: /^Your draft, checked against / });
    await heading.waitFor({ timeout: 90_000 });
    const ms = Date.now() - started;
    const rows = await page.getByTestId("check-row").count();
    if (rows < (DRY ? 5 : 10)) fail(`expected at least 10 rows, got ${rows}`);
    const parsed = captured ? JSON.parse(captured) : null;
    report.widths.push({
      width,
      replay: !!replay,
      clientMs: ms,
      serverMs: parsed?.ms,
      parse: parsed && { method: parsed.parse.method, model: parsed.parse.model, items: parsed.parse.items, ms: parsed.parse.ms, notice: !!parsed.parse.notice },
      osm: parsed?.osm,
      rows,
      verdicts: await page.getByTestId("check-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-verdict"))),
      heading: await heading.textContent(),
    });
    await page.waitForTimeout(600);
    // Full-page capture from the top, so the sticky header isn't drawn mid-page.
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot("done");

    // Browser-built downloads: read in memory; Playwright deletes its temp copies on close.
    const files = {};
    for (const label of ["Audit (CSV)", "Program (CSV)", "Calendar (.ics)", "HubSpot (CSV)", "Salesforce (CSV)"]) {
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 10_000 }), page.getByRole("button", { name: label }).click()]);
      const chunks = [];
      for await (const c of await dl.createReadStream()) chunks.push(c);
      const body = Buffer.concat(chunks).toString("utf8");
      files[label] = { name: dl.suggestedFilename(), bytes: body.length, firstLine: body.split(/\r?\n/)[0].slice(0, 60) };
    }
    if (!files["Audit (CSV)"].firstLine.startsWith('"line","draft_item","verdict"')) fail("audit CSV header");
    if (!files["Calendar (.ics)"].firstLine.startsWith("BEGIN:VCALENDAR")) fail("ics header");
    report.widths.at(-1).files = files;
    if (SHOTS && n === 0) {
      await page.emulateMedia({ media: "print" });
      await page.screenshot({ path: `${SHOTS}/${LABEL ? `${LABEL}-` : ""}print-${width}.png`, fullPage: true });
      await page.emulateMedia({ media: "screen" });
    }

    // Rate-limited state, served by a mocked 429.
    await page.unroute("**/api/check");
    await page.route("**/api/check", (route) => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify(RATE_LIMITED) }));
    await page.evaluate(() => window.scrollTo(0, 0));
    await submit.click();
    const alert = page.getByRole("alert").filter({ hasText: "Limit reached." });
    await alert.waitFor({ timeout: 10_000 });
    if (!(await alert.textContent()).includes("Too many plan checks")) fail("429 message not shown");
    await alert.evaluate((el) => el.scrollIntoView({ block: "end" }));
    await page.evaluate(() => window.scrollBy(0, 48));
    await shot("rate-limited");

    for (const u of [...urls, page.url()]) {
      let decoded = u;
      try {
        decoded = decodeURIComponent(u.replace(/\+/g, " "));
      } catch {}
      const hit = PHRASES.find((p) => decoded.toLowerCase().includes(p));
      if (hit) fail(`plan text "${hit}" appeared in a URL`);
    }
    await ctx.close();
  }

  report.requests = urls.length;
  report.urlsWithPlanText = urls.filter((u) => PHRASES.some((p) => u.toLowerCase().includes(p))).length;
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
