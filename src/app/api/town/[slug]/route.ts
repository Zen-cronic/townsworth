import { NextResponse } from "next/server";
import { buildProfile } from "@/lib/profile";
import { buildProgram } from "@/lib/plan";
import { auditPlan, GENERIC_AGENCY_PLAN } from "@/lib/audit";
import { townBySlug } from "@/lib/towns";
import { fundParam } from "../../fund";

// Debug view of the raw profile for local development. Production deployments return 404.

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (process.env.VERCEL_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { slug } = await params;
  const town = townBySlug(slug);
  if (!town) return NextResponse.json({ error: "unknown town" }, { status: 404 });
  const fund = fundParam(new URL(req.url)) ?? town.defaultAnnualFund;
  const profile = await buildProfile(town);
  const program = buildProgram(profile, fund);
  const audit = auditPlan(GENERIC_AGENCY_PLAN.map((text) => ({ text })), profile, program.items);
  return NextResponse.json({
    town,
    thin: profile.thin,
    distinctShare: profile.distinctShare,
    counts: { places: profile.places.length, localPlaces: profile.localPlaces.length },
    excluded: profile.excluded,
    taste: Object.fromEntries(Object.entries(profile.taste).map(([k, v]) => [k, v.slice(0, 8).map((s) => ({ name: s.entity.name, rank: s.rank, distinct: s.distinct }))])),
    program,
    audit,
    calls: profile.calls,
  });
}
