import { NextResponse } from "next/server";
import { clientIp, takeSlot } from "@/lib/rateLimit";
import { runUserPlan } from "@/lib/userPlan";
import { MAX_CHARS, validateCheckInput } from "@/lib/userPlanParse";

// Checks a pasted plan. The text arrives only in the JSON body and is never logged or stored;
// every response is no-store.

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Body bytes allowed: MAX_CHARS of multi-byte text plus the JSON wrapper.
const MAX_BODY_BYTES = MAX_CHARS * 4 + 2048;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: `The plan is too long: paste at most ${MAX_CHARS.toLocaleString("en-US")} characters.` }, 413);

  let raw: unknown;
  try {
    const body = await req.text();
    if (body.length > MAX_BODY_BYTES) return json({ error: `The plan is too long: paste at most ${MAX_CHARS.toLocaleString("en-US")} characters.` }, 413);
    raw = JSON.parse(body);
  } catch {
    return json({ error: "Send a JSON body with a town and the plan text." }, 400);
  }

  const input = validateCheckInput(raw);
  if (!input.ok) return json({ error: input.error }, input.status);

  const slot = takeSlot("check", clientIp(req.headers));
  if (!slot.ok) return json({ error: slot.error.replace("AI drafts", "plan checks") }, 429);

  try {
    return json(await runUserPlan(input.town, input.fund, input.text));
  } catch (e) {
    // Never log `e` itself: provider errors carry the request body.
    console.error("check failed:", e instanceof Error ? e.name : "unknown");
    return json({ error: "The check didn't finish. Try again in a minute; nothing you pasted was kept." }, 502);
  }
}
