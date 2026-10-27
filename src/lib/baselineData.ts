import frozen from "../../data/baseline-2026-10-27.json";
import latest from "../../data/baseline-latest.json";

// The frozen plain-LLM baseline (OpenAI, no Qloo). Committed with its SHA-256 so the proof can't be re-rolled.

export interface BaselineItem {
  item: string;
  partner: string | null;
  osm: { status: number; found: boolean; osmName?: string; km?: number } | null;
}

export const BASELINE = frozen as {
  promptVersion: string;
  model: string;
  createdAt: string;
  towns: { slug: string; items: BaselineItem[] }[];
};

export const BASELINE_SHA256 = latest.sha256;

export function baselineFor(slug: string): BaselineItem[] {
  return BASELINE.towns.find((t) => t.slug === slug)?.items ?? [];
}

const INSTITUTION = /\b(college|school|district|university|library|chamber|city|village|town|county|board|department|united way|corporation|authority|council|government|municipality|township|agency|works|commission|bruce power)\b/i;

export const isInstitution = (name: string) => INSTITUTION.test(name);
