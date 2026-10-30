// Display labels shared by the landing, town and memo surfaces. Presentation only; no engine logic.

// A place's local-favour signal as the plan writes it: "Local favourite · #6 of 50 places locals
// favour". The older form "#6 by local affinity" (no count) still parses. [1] rank, [2] of how many.
export const LOCAL_AFFINITY = /^(?:Qloo place|Local favourite) · #(\d+)(?: by local affinity| of (\d+) places locals favour)$/;

// A rank in plain words for a cold reader: "#6 of 50 places locals favour", or "Locals' #6 place"
// when the count is unknown.
export const favourRank = (rank: number | string, of?: number | string) => (of ? `#${rank} of ${of} places locals favour` : `Locals' #${rank} place`);

// The signal in short form: "#6 of 50 places locals favour", "Locals' #2 artist". Qloo's "brand"
// type covers teams, universities and museums alike, so it never shows: a brand reads "Locals' #2
// favourite". Other signals lose the "Qloo " prefix.
export function shortSignal(signal?: string): string {
  if (!signal) return "Qloo signal";
  const place = signal.match(LOCAL_AFFINITY);
  if (place) return favourRank(place[1], place[2]);
  const taste = signal.match(/^Qloo (?:· locals' #(\d+) (.+)|(brand|artist|TV show|podcast) · #(\d+) locally)$/);
  if (taste) {
    const [rank, type] = taste[1] ? [taste[1], taste[2]] : [taste[4], taste[3]];
    return `Locals' #${rank} ${type === "brand" ? "favourite" : type}`;
  }
  return signal.replace(/^Qloo place\b/, "Local place").replace(/^Qloo /, "");
}

// Whether a provenance signal came from Qloo (and so takes the Qloo chip). Every Qloo-sourced signal
// the planner writes names Qloo or a local-affinity rank; an open call names no partner at all.
const QLOO_SIGNAL = /^(?:Qloo |Local favourite · |Local place \(Qloo\))|\(Qloo, aggregate\)$/;
// No signal at all is shown as the generic "Qloo signal" (shortSignal), so it is Qloo too.
export const isQlooSignal = (signal?: string) => !signal || QLOO_SIGNAL.test(signal);

// A matched theme from the audit ("Polka (Frankie Yankovic, Polka Band)") as "Polka · Frankie Yankovic".
export function shortTermHit(hit?: string): string | undefined {
  return hit?.replace(/ \(([^,)]+)(?:, [^)]*)?\)$/, " · $1");
}

// Short names for display: "Racine County Economic Development Corporation" reads "Racine County EDC".
export const shortOrg = (name: string) => name.replace(/ Economic Development Corporation$/, " EDC").split(" | ")[0];

// What an item is, without where: "Supplier day hosted at Racine Civic Centre" reads "Supplier day".
export const kindOf = (title: string) => title.split(/ hosted at |: | at |, /)[0];

// "Abilene", "Abilene and Clay", "Abilene, Clay and Kemmerer".
export function listNames(names: string[]) {
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
