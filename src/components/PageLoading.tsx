import "./PageLoading.css";
import { AppHeader } from "@/components/AppHeader";
import { PageBand } from "@/components/ui/PageBand";

// Shown the moment a link is followed, while the page's Qloo-backed data loads on the server.
export function PageLoading({ kicker, title, page }: { kicker: string; title: string; page?: "proof" | "judges" | "check" }) {
  return (
    <>
      <AppHeader page={page} />
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
