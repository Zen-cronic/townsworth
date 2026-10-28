import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { AGENT_MODEL, runAgent } from "@/lib/agent";
import { clientIp, takeSlot } from "@/lib/rateLimit";
import { runTown } from "@/lib/run";
import { companyFormHref, sponsorSignature, townBySlug } from "@/lib/towns";
import { fundParam } from "../../fund";

export const maxDuration = 60;

type AgentResult = Omit<Awaited<ReturnType<typeof runAgent>>, "cacheable">;

// Thrown inside the cache so a result that must not be stored is still returned to this request.
class Uncacheable extends Error {
  constructor(readonly result: AgentResult) {
    super("uncacheable agent result");
  }
}

const cachedAgent = unstable_cache(
  async (slug: string, fund: number | null): Promise<AgentResult> => {
    const run = await runTown(slug, fund ?? undefined, "llm");
    if (!run) throw new Error("Unknown town");
    const { cacheable, ...result } = await runAgent(run);
    if (!cacheable) throw new Uncacheable(result);
    return result;
  },
  ["agent-drafts-v1"],
  { revalidate: 86400 },
);

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const town = townBySlug(slug);
  if (!town) return NextResponse.json({ error: "Unknown town" }, { status: 404 });

  const slot = takeSlot("agent", clientIp(req.headers));
  if (!slot.ok) return NextResponse.json({ error: slot.error }, { status: 429 });

  const fund = fundParam(new URL(req.url));
  const run = await runTown(slug, fund, "llm");
  if (!run) return NextResponse.json({ error: "Unknown town" }, { status: 404 });

  // No model call when there is nothing to draft for, or the Qloo profile is incomplete.
  const noPartners = !run.program.items.some((i) => i.partner?.name);
  const qlooFailed = run.profile.failedCalls.length > 0;
  if (noPartners || qlooFailed) {
    const why = qlooFailed
      ? "Some Qloo calls for this town failed, so the agent didn't run. Reload the page to retry; the program shown may be incomplete."
      : "The program has no local partners for this town, so there is no one to draft outreach to.";
    return NextResponse.json({
      model: AGENT_MODEL,
      sponsor: town.sponsor,
      sponsorSource: town.sponsorSource,
      signature: sponsorSignature(town),
      companyHref: town.sponsorSource === "placeholder" ? companyFormHref(town) : undefined,
      summary: why,
      drafts: [],
      rejected: [],
      trace: [],
      steps: 0,
      error: why,
    });
  }

  try {
    return NextResponse.json(await cachedAgent(slug, fund ?? null));
  } catch (e) {
    if (e instanceof Uncacheable) return NextResponse.json(e.result);
    const message = e instanceof Error ? e.message : "Agent failed";
    return NextResponse.json({ error: `The drafting agent is unavailable right now (${message.slice(0, 120)}). The program and exports still work.` }, { status: 502 });
  }
}
