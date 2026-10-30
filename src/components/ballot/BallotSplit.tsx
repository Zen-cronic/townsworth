// The body split: context on the left (question, privacy, method), the ranked list on the right.
export function BallotSplit({ side, children }: { side: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bl-split">
      <div className="bl-side">{side}</div>
      <div className="bl-main">{children}</div>
    </div>
  );
}
