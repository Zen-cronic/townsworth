// A phrase split into word spans, each numbered as --w, so a scroll-driven fill can ink it word by
// word. The text and its spaces are unchanged; without the animation it reads as plain text.
export function Words({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i} className="lp-w" style={{ "--w": i } as React.CSSProperties}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}
