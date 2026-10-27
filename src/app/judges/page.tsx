import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

export default function JudgesPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-semibold">Start here (90 seconds)</h1>
        <ol className="mt-4 list-decimal space-y-2 pl-5">
          <li><Link className="underline" href="/">Open Mount Pleasant, WI</Link>: the agency&apos;s draft plan, red-penned against Qloo signals.</li>
          <li>Click &ldquo;why?&rdquo; on any replacement to see the Qloo signal behind it.</li>
          <li>Open the commitments memo and download the partner sheet or calendar.</li>
          <li>Switch to another town in the header: the picks change because the town&apos;s signals change.</li>
        </ol>
      </main>
    </>
  );
}
