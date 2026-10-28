// RFC 5545 helpers: TEXT escaping (section 3.3.11) and 75-octet line folding (section 3.1).

export function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

const octets = (s: string) => new TextEncoder().encode(s).length;

export function foldLine(line: string): string {
  if (octets(line) <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let limit = 75;
  for (const ch of line) {
    if (octets(cur + ch) > limit) {
      parts.push(cur);
      cur = "";
      // Continuation lines start with a space, which counts toward their 75 octets.
      limit = 74;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}
