// Shown while a town streams in. A live plain-LLM draft is the slow case, so it says so.
export function TownLoading({ live }: { live?: boolean }) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-5 sm:px-6 sm:pt-8" aria-busy="true">
      <div className="h-4 w-48 skeleton" />
      <div className="mt-3 h-9 w-72 max-w-full skeleton" />
      <div role="status" className="mt-6 max-w-2xl rounded-md border border-rule bg-paper px-4 py-3.5 text-sm leading-relaxed">
        {live ? (
          <>
            <p className="font-medium">A plain LLM is drafting this town&apos;s plan now…</p>
            <p className="mt-1 text-muted">
              This takes about 20 seconds: OpenAI writes the plan with no Qloo access, then each partner it names is checked on OpenStreetMap,
              one a second. Then the draft is audited against the town&apos;s Qloo signals.
            </p>
          </>
        ) : (
          <p className="font-medium">Reading this town&apos;s Qloo signals and auditing the draft…</p>
        )}
      </div>
      <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-rule bg-hairline md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-paper px-6 py-5">
            <div className="h-3 w-32 skeleton" />
            <div className="mt-4 h-7 w-24 skeleton" />
            <div className="mt-3 h-3 w-full skeleton" />
          </div>
        ))}
      </div>
      <div className="doc-sheet mt-8 h-72 rounded-lg" />
    </main>
  );
}
