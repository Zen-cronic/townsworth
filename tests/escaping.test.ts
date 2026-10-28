import assert from "node:assert/strict";
import { test } from "node:test";
import { foldLine, icsText } from "../src/app/api/export/ics";
import { borda, guardFormula, tallyCsv, type BallotItem } from "../src/lib/ballot";

test("cells that a spreadsheet would run as a formula get a leading quote", () => {
  for (const s of ["=SUM(A1:A9)", "+1 262-555-0100", "-2+3", "@cmd", "\tx", "\rx"]) assert.equal(guardFormula(s), `'${s}`);
  for (const s of ["Harbor Brewing", "1 Main St", "", "a=b"]) assert.equal(guardFormula(s), s);
});

test("the ballot CSV guards titles and partners but leaves numbers alone", () => {
  const items: BallotItem[] = [
    { id: "a", bucket: "events", title: '=HYPERLINK("http://x","y")', partner: "+1 phone" },
    { id: "b", bucket: "grants", title: "Library grant" },
  ];
  const csv = tallyCsv(borda(items, [{ ids: ["a", "b"] }]), "1 ballot");
  const row = csv.split("\n").find((l) => l.includes("HYPERLINK"))!;
  assert.ok(row.startsWith(`1,"'=HYPERLINK(""http://x"",""y"")",'+1 phone,1,`), row);
});

test("ICS text escapes backslash, semicolon, comma and newline", () => {
  assert.equal(icsText("a\\b; c, d\ne"), "a\\\\b\; c\\, d\\ne");
});

test("long ICS lines fold at 75 octets with a leading space", () => {
  const line = `SUMMARY:${"Trades-training info night at the Lakeside Community Center, ".repeat(3)}`;
  const folded = foldLine(line);
  const parts = folded.split("\r\n");
  assert.ok(parts.length > 1);
  for (const [i, p] of parts.entries()) {
    assert.ok(new TextEncoder().encode(p).length <= 75, p);
    if (i) assert.ok(p.startsWith(" "));
  }
  assert.equal(parts.map((p, i) => (i ? p.slice(1) : p)).join(""), line);
});
