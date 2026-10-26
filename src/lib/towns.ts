// Preset host communities. Coordinates are town centres; projects are from public reporting.
// Fund figures are illustrative defaults the user is expected to replace with their own commitments.

export interface Town {
  slug: string;
  name: string;
  region: string;
  country: "United States" | "Canada";
  lat: number;
  lon: number;
  project: string;
  facility: "data center" | "fab" | "nuclear" | "plant";
  defaultAnnualFund: number;
  fundNote: string;
  thinData?: boolean;
}

export const TOWNS: Town[] = [
  {
    slug: "mount-pleasant-wi",
    name: "Mount Pleasant",
    region: "Wisconsin",
    country: "United States",
    lat: 42.7117,
    lon: -87.8836,
    project: "Hyperscale AI data center campus (Microsoft, per public reporting)",
    facility: "data center",
    defaultAnnualFund: 2_000_000,
    fundNote: "Illustrative. Replace with your actual community fund.",
  },
  {
    slug: "clay-ny",
    name: "Clay",
    region: "New York",
    country: "United States",
    lat: 43.1857,
    lon: -76.1724,
    project: "Semiconductor megafab (Micron, per public reporting)",
    facility: "fab",
    defaultAnnualFund: 25_000_000,
    fundNote: "Micron and partners committed $500M over 20 years (≈$25M/yr), per Empire State Development.",
  },
  {
    slug: "new-albany-oh",
    name: "New Albany",
    region: "Ohio",
    country: "United States",
    lat: 40.0804,
    lon: -82.7842,
    project: "Data center cluster and chip fab (Meta, Google, AWS, Intel, per public reporting)",
    facility: "data center",
    defaultAnnualFund: 1_500_000,
    fundNote: "Illustrative. Meta reports $5.6M+ given locally to date.",
  },
  {
    slug: "abilene-tx",
    name: "Abilene",
    region: "Texas",
    country: "United States",
    lat: 32.4553,
    lon: -99.7385,
    project: "AI data center campus (Stargate, per public reporting)",
    facility: "data center",
    defaultAnnualFund: 2_000_000,
    fundNote: "Illustrative. Replace with your actual community fund.",
  },
  {
    slug: "kincardine-on",
    name: "Kincardine",
    region: "Ontario",
    country: "Canada",
    lat: 44.1767,
    lon: -81.6367,
    project: "Nuclear generating station (Bruce Power, per public reporting)",
    facility: "nuclear",
    defaultAnnualFund: 2_000_000,
    fundNote: "Bruce Power reports CAD $2M+ a year in community giving.",
  },
  {
    slug: "kemmerer-wy",
    name: "Kemmerer",
    region: "Wyoming",
    country: "United States",
    lat: 41.7761,
    lon: -110.5555,
    project: "Advanced nuclear plant (TerraPower Natrium, per public reporting)",
    facility: "nuclear",
    defaultAnnualFund: 500_000,
    fundNote: "Illustrative. A thin-data host: expect fewer grounded picks.",
    thinData: true,
  },
];

export const HERO_TOWN = TOWNS[0];

export function townBySlug(slug: string): Town | undefined {
  return TOWNS.find((t) => t.slug === slug);
}
