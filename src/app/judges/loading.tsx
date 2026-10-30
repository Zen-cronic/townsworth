import { PageLoading } from "@/components/PageLoading";

export default function Loading() {
  return (
    <PageLoading
      kicker="Product tour"
      // The page's own title, with the same non-breaking hyphen.
      title={<span className="ui-band-long">Watch a community‑benefits plan get checked against its host town.</span>}
      page="judges"
      towns={false}
    />
  );
}
