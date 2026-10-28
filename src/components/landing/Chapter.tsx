// A numbered chapter with a folder tab on its top edge. On wide screens each chapter sticks by its
// bottom edge and the next one slides over it, like a sheet filed on top of the last.
export function Chapter({
  n,
  name,
  id,
  labelledBy,
  tone = "",
  children,
}: {
  n: string;
  name: string;
  id: string;
  labelledBy: string;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} data-chapter className={`lp-ch ${tone}`} aria-labelledby={labelledBy}>
      <p className="lp-ch-tab" aria-hidden="true">
        <span>{n}</span>
        {name}
      </p>
      <div className="lp-wrap lp-ch-body">{children}</div>
    </section>
  );
}
