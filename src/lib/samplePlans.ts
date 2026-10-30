import { SAMPLE_PLAN } from "./userPlanParse";

// Named sample drafts for "check your own plan", for a visitor who has no plan to paste. Only the
// id ever goes into a URL (/check?sample=<id>); the text is filled in on the page.

export interface SamplePlan {
  id: string;
  label: string;
  // A sample that names real local organisations belongs to one preset town and is only ever checked
  // against it. A sample without a town fits any town.
  town?: string;
  text: string;
}

// The Mount Pleasant draft mixes line types so one check shows every verdict. Every organisation it
// names already appears in the frozen baseline plan for this town (data/baseline-2026-10-27.json):
// Gateway Technical College and the Racine Art Museum were found on OpenStreetMap there, the Racine
// County Economic Development Corporation is an institution that wasn't, and Joy House is a named
// partner that wasn't found either. The last four lines would fit any town.
export const MOUNT_PLEASANT_SAMPLE_PLAN = `Mount Pleasant Community Benefit Commitments (draft)

1. Fund a welding and electrical certificate cohort with Gateway Technical College, reserved for students who live in Racine County.
2. Run a small-business procurement workshop series with the Racine County Economic Development Corporation to help local firms bid for operations work.
3. Buy local: source 15% of construction-phase catering from Mount Pleasant and Racine County vendors.
4. Community grants of $5,000 each, decided twice a year by a resident advisory panel through an open application cycle.
5. Sponsor free family admission days at the Racine Art Museum.
6. Fund a weekly community meal with Joy House.
7. Sponsor a STEM summer camp for middle-school students.
8. Host an annual community picnic.
9. Run newspaper ads announcing construction job openings.
10. Plant 200 street trees along the main commercial corridor.`;

export const SAMPLE_PLANS: readonly SamplePlan[] = [
  { id: "mount-pleasant", label: "Mount Pleasant, WI data center draft", town: "mount-pleasant-wi", text: MOUNT_PLEASANT_SAMPLE_PLAN },
  { id: "generic", label: "A generic draft for any town", text: SAMPLE_PLAN },
];

const GENERIC = SAMPLE_PLANS.find((s) => !s.town)!;

export const HERO_SAMPLE_ID = "mount-pleasant";

// Unknown, empty or repeated ids resolve to nothing, so a bad link just shows the empty form.
export function samplePlanById(id: unknown): SamplePlan | undefined {
  return typeof id === "string" ? SAMPLE_PLANS.find((s) => s.id === id) : undefined;
}

// The sample written for this town, or the generic one.
export function samplePlanForTown(slug: string): SamplePlan {
  return SAMPLE_PLANS.find((s) => s.town === slug) ?? GENERIC;
}

// The town a /check?sample= link checks against: a town-specific sample always uses its own town, so
// its named organisations are never checked somewhere else; a generic sample keeps the requested town.
export function sampleTown(sample: SamplePlan | undefined, requested: string | undefined): string | undefined {
  return sample?.town ?? requested;
}

// The /check link for a sample: the id only, never the plan text. The sample decides the town.
export function sampleCheckHref(id: string): string {
  return `/check?${new URLSearchParams({ sample: id }).toString()}`;
}
