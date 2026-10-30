// A dark page-header band: kicker, title and an optional control on the right.
export function PageBand({
  kicker,
  title,
  titleId,
  aside,
  visual,
  children,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  titleId?: string;
  aside?: React.ReactNode;
  // A drawing for the right of the band (hidden on phones).
  visual?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="ui-band lp-grain" aria-labelledby={titleId}>
      <div className="lp-wrap ui-band-inner">
        <div className="ui-band-main">
          {kicker && <p className="lp-kicker">{kicker}</p>}
          <h1 id={titleId} className="ui-band-h">
            {title}
          </h1>
          {children}
        </div>
        {aside && <div className="ui-band-aside">{aside}</div>}
        {visual && <div className="ui-band-visual">{visual}</div>}
      </div>
    </section>
  );
}
