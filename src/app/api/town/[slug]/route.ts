import { NextResponse } from "next/server";
import { buildProfile } from "@/lib/profile";
import { buildProgram } from "@/lib/plan";
import { auditPlan, GENERIC_AGENCY_PLAN } from "@/lib/audit";
import { townBySlug } from "@/lib/towns";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const town = townBySlug(slug);
  if (!town) return NextResponse.json({ error: "unknown town" }, { status: 404 });
  const fund = Number(new URL(req.url).searchParams.get("fund")) || town.defaultAnnualFund;
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
