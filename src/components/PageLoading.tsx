import "./PageLoading.css";
import { AppHeader } from "@/components/AppHeader";
import { PageBand } from "@/components/ui/PageBand";

// Shown the moment a link is followed, while the page's Qloo-backed data loads on the server. Only
// for routes with no slug: a route that can 404 must decide that before streaming, so it has none.
// The header props match the page's own, so nothing shifts when the page arrives.
export function PageLoading({
  kicker,
  title,
  page,
  towns = true,
}: {
  kicker: string;
  title: string;
  page?: "proof" | "judges" | "check";
  towns?: boolean;
}) {
  return (
    <>
      <AppHeader page={page} towns={towns} />
      <main id="main" aria-busy="true">
        <PageBand kicker={kicker} title={title}>
          <p className="ui-loading" role="status">
            <span className="ui-loading-bar" aria-hidden="true" />
            Loading local data
          </p>
        </PageBand>
      </main>
    </>
  );
}
