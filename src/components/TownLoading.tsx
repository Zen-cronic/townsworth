// Shown while a town streams in. A live AI-powered draft is the slow case, so it says so.
export function TownLoading({ live }: { live?: boolean }) {
  return (
    <main id="main" aria-busy="true">
      <section className="ui-band">
        <div className="lp-wrap ui-band-main">
          <div className="h-3 w-48 rounded bg-band-text/10" />
          <div className="mt-2 h-10 w-80 max-w-full rounded bg-band-text/10" />
          <p role="status" className="ui-band-note mt-3">
            {live ? "AI is writing this town’s draft now (about 20 seconds), then it is checked line by line." : "Reading this town’s Qloo taste data and checking the draft…"}
          </p>
        </div>
      </section>
      <div className="ui-page">
        <div className="ui-stats">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ui-stat">
              <div className="h-9 w-24 skeleton" />
              <div className="mt-2 h-3 w-40 skeleton" />
            </div>
          ))}
        </div>
        <div className="ui-card ui-section h-72" />
      </div>
    </main>
  );
}
