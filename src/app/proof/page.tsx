import { AppHeader } from "@/components/AppHeader";

export default function ProofPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-semibold">Proof</h1>
        <p className="mt-2 text-muted">The Qloo-vs-plain-LLM comparison is being computed. It will appear here.</p>
      </main>
    </>
  );
}
