// Display helpers for dashboard surfaces. Presentation only; no engine logic.

export function formatPhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.length === 10 ? digits : null;
  return national ? `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}` : raw;
}

export const km = (n?: number) => (n == null ? undefined : `${n < 10 ? n.toFixed(1) : Math.round(n)} km`);

// "\"Racine County EDC\" was not found ..." -> Racine County EDC
export function quotedName(reason?: string): string | undefined {
  return reason?.match(/^"([^"]+)"/)?.[1];
}

export function cadenceLower(cadence: string) {
  return cadence.charAt(0).toLowerCase() + cadence.slice(1);
}
