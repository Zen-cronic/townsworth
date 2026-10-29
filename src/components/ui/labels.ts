// Display labels shared by the landing, town and memo surfaces. Presentation only; no engine logic.

// A place's affinity signal as the plan writes it: "Local favourite · #6 by local affinity".
export const LOCAL_AFFINITY = /^(?:Qloo place|Local favourite) · #(\d+) by local affinity$/;

// The signal in short form: "#6 local affinity"; other signals lose the "Qloo " prefix.
export function shortSignal(signal?: string): string {
  if (!signal) return "Qloo signal";
  return signal.replace(LOCAL_AFFINITY, "#$1 local affinity").replace(/^Qloo place\b/, "Local place").replace(/^Qloo /, "");
}

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
