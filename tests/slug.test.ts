import assert from "node:assert/strict";
import { test } from "node:test";
import { customSlug, parseCustomSlug, townBySlug, withCompany } from "../src/lib/towns";

test("a custom slug round-trips through parse and encode", () => {
  const slug = customSlug("St. Thomas", "on", 42.7788, -81.1753, "plant", "Acme & Co");
  assert.equal(slug, "St.-Thomas-ON~42.7788_-81.1753~plant~Acme-and-Co");
  const town = parseCustomSlug(slug)!;
  assert.ok(town);
  assert.equal(town.slug, slug);
  assert.equal(town.name, "St. Thomas");
  assert.equal(town.region, "Ontario");
  assert.equal(town.country, "Canada");
  assert.equal(town.facility, "plant");
  assert.equal(town.sponsor, "Acme and Co");
  assert.equal(town.sponsorSource, "entered");
  assert.equal(town.custom, true);
  assert.equal(customSlug(town.name, "ON", town.lat, town.lon, "plant", town.sponsor), slug);
});

test("withCompany adds, replaces and removes the company segment", () => {
  const base = "Taylor-TX~30.5729_-97.4141~fab";
  const withCo = withCompany(base, "Samsung");
  assert.equal(withCo, `${base}~Samsung`);
  assert.equal(withCompany(withCo, "Other Co"), `${base}~Other-Co`);
  assert.equal(withCompany(withCo, ""), base);
  assert.equal(withCompany("mount-pleasant-wi", "Samsung"), "mount-pleasant-wi");
});

test("coordinates outside the region's country are rejected", () => {
  assert.equal(parseCustomSlug("Paris-TX~48.8566_2.3522~fab"), undefined);
  // An Ontario code with Texas coordinates.
  assert.equal(parseCustomSlug("Taylor-ON~30.5729_-97.4141~fab"), undefined);
});

test("an unknown region code is rejected", () => {
  assert.equal(parseCustomSlug("Springfield-ZZ~39.7817_-89.6501~plant"), undefined);
  assert.equal(townBySlug("Springfield-ZZ~39.7817_-89.6501~plant"), undefined);
});

test("a slug over 170 characters is rejected", () => {
  const slug = `Taylor-TX~30.5729_-97.4141~fab~${"Acme-".repeat(30)}Co`;
  assert.ok(slug.length > 170);
  assert.equal(parseCustomSlug(slug), undefined);
});

test("a company with markup is rejected in a slug and cleaned when encoding", () => {
  assert.equal(parseCustomSlug("Taylor-TX~30.5729_-97.4141~fab~<script>alert(1)</script>"), undefined);
  assert.equal(townBySlug("Taylor-TX~30.5729_-97.4141~fab~%3Cscript%3E"), undefined);
  const slug = customSlug("Taylor", "TX", 30.5729, -97.4141, "fab", "<script>alert(1)</script>");
  assert.doesNotMatch(slug, /[<>()]/);
  const town = parseCustomSlug(slug)!;
  assert.ok(town);
  assert.doesNotMatch(town.sponsor, /[<>]/);
});

test("an unknown facility is rejected", () => {
  assert.equal(parseCustomSlug("Taylor-TX~30.5729_-97.4141~casino"), undefined);
});
