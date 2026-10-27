// Unit check for the outreach rules: a draft that doesn't name the sponsor fails, the template
// always passes, and event logistics aren't mistaken for land-use language.
// Run: npx tsx --conditions=react-server scripts/check-sponsor-rule.ts
import assert from "node:assert/strict";
import { checkDraft, forbiddenTopic, rulesPass, templateDraft } from "../src/lib/agent";
import { townBySlug, withCompany } from "../src/lib/towns";

const mp = townBySlug("mount-pleasant-wi")!;
const item = { title: "Trades night at the brewery", partner: { name: "Racine Brewing" } };
let n = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

ok("a draft signed by the town's community team, not the sponsor, fails", () => {
  const r = checkDraft(
    { subject: "Trades night", body: "Hello Racine Brewing team,\n\nWe'd love to host a trades night with you.\n\nBest,\nMount Pleasant Community Team" },
    mp,
  );
  assert.equal(r.sponsorInBody, false);
  assert.equal(r.sponsorInSignature, false);
  assert.equal(rulesPass(r), false);
});

ok("a draft naming the sponsor only in the signature fails", () => {
  const r = checkDraft({ subject: "Hi", body: "Hello team,\n\nA trades night?\n\nBest,\nSent on behalf of Microsoft's Mount Pleasant data center team" }, mp);
  assert.equal(r.sponsorInSignature, true);
  assert.equal(rulesPass(r), false);
});

ok("a draft naming the sponsor in the body and signature passes", () => {
  const r = checkDraft(
    { subject: "Hi", body: "Hello team,\n\nI'm writing from Microsoft's community program.\n\nBest,\nSent on behalf of Microsoft's Mount Pleasant data center team" },
    mp,
  );
  assert.equal(rulesPass(r), true);
});

ok("the template names the sponsor and passes, for every preset and a typed town", () => {
  for (const slug of ["mount-pleasant-wi", "clay-ny", "new-albany-oh", "abilene-tx", "kincardine-on", "kemmerer-wy", "Taylor-TX~30.5729_-97.4141~fab", withCompany("Taylor-TX~30.5729_-97.4141~fab", "Samsung")]) {
    const town = townBySlug(slug)!;
    const t = templateDraft(town, item);
    assert.ok(rulesPass(checkDraft(t, town)), `${slug}: ${t.body}`);
  }
});

ok("a multi-sponsor town needs every sponsor named", () => {
  const na = townBySlug("new-albany-oh")!;
  const r = checkDraft({ subject: "Hi", body: "Hello,\n\nFrom Meta and Google.\n\nBest,\nMeta and Google" }, na);
  assert.equal(rulesPass(r), false);
});

ok("a typed town without a company is signed [Your company]", () => {
  const t = townBySlug("Taylor-TX~30.5729_-97.4141~fab")!;
  assert.equal(t.sponsor, "[Your company]");
  assert.match(templateDraft(t, item).body, /\[Your company\]'s Taylor chip fab team/);
});

ok("land-use language is blocked; event logistics are not", () => {
  assert.equal(forbiddenTopic("We'll handle the special event permit and parking."), undefined);
  assert.equal(forbiddenTopic("Looking forward to hearing from you."), undefined);
  assert.ok(forbiddenTopic("Ahead of the zoning hearing next month"));
  assert.ok(forbiddenTopic("once the building permit is issued"));
  assert.ok(forbiddenTopic("Please support the project at the council meeting"));
  assert.ok(forbiddenTopic("We'll cover $5,000 in costs"));
});

console.log(`${n} checks passed`);
