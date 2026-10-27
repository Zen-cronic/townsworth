import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { runTown } from "@/lib/run";

export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fund = Number(new URL(req.url).searchParams.get("fund")) || undefined;
  const run = await runTown(slug, fund, "llm");
  if (!run) return NextResponse.json({ error: "Unknown town" }, { status: 404 });
  try {
    return NextResponse.json(await runAgent(run));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Agent failed";
    return NextResponse.json({ error: `The drafting agent is unavailable right now (${message.slice(0, 120)}). The program and exports still work.` }, { status: 502 });
  }
}
