// A section header: a left title (optionally two-tone) and one short muted line on the right.
export function SectionHeader({
  id,
  title,
  tone,
  lede,
  kicker,
  size = "md",
  children,
}: {
  id?: string;
  title: React.ReactNode;
  tone?: React.ReactNode;
  lede?: React.ReactNode;
  kicker?: React.ReactNode;
  size?: "md" | "sm";
  children?: React.ReactNode;
}) {
  return (
    <div className={`ui-head is-${size}`}>
      <div className="ui-head-main">
        {kicker && <p className="lp-kicker">{kicker}</p>}
        <h2 id={id} className={size === "sm" ? "ui-h3" : "lp-h2"}>
          {title}
          {tone && <span className="lp-tone"> {tone}</span>}
        </h2>
      </div>
      {(lede || children) && (
        <div className="ui-head-aside">
          {lede && <p className="lp-section-lede">{lede}</p>}
          {children}
        </div>
      )}
    </div>
  );
}
