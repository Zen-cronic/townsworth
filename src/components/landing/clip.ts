// Shorten an excerpt so it ends on a clause or a whole content word, never mid-word or on a dangling "for".
const DANGLING = /\s+(a|an|and|at|by|for|from|in|including|into|of|on|or|the|to|with|who|that|their|its)$/i;

export function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  // Prefer a clause break in the back half of the excerpt.
  const clause = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf("; "), cut.lastIndexOf(" – "), cut.lastIndexOf(" — "));
  let out = clause > max * 0.5 ? cut.slice(0, clause) : cut.slice(0, cut.lastIndexOf(" "));
  while (DANGLING.test(out)) out = out.replace(DANGLING, "");
  return `${out.replace(/[,;:\s]+$/, "")}…`;
}
