/**
 * Base-game levels, mirroring BeamJoyServer/services/maps.lua's own `base = true` list. `slug` is
 * the public URL key (/maps/<slug>); `level` is the game's folder name.
 */
export const VANILLA_MAPS = [
  { slug: "west-coast-usa", level: "west_coast_usa", name: "West Coast, USA" },
  { slug: "east-coast-usa", level: "east_coast_usa", name: "East Coast, USA" },
  { slug: "italy", level: "italy", name: "Italy" },
  { slug: "utah", level: "utah", name: "Utah, USA" },
  { slug: "jungle-rock-island", level: "jungle_rock_island", name: "Jungle Rock Island" },
  { slug: "johnson-valley", level: "johnson_valley", name: "Johnson Valley" },
  { slug: "industrial", level: "industrial", name: "Industrial Site" },
  { slug: "hirochi-raceway", level: "hirochi_raceway", name: "Hirochi Raceway" },
  { slug: "automation-test-track", level: "automation_test_track", name: "Automation Test Track" },
  { slug: "small-island", level: "small_island", name: "Small Island, USA" },
  { slug: "derby", level: "derby", name: "Derby Arenas" },
  { slug: "driver-training", level: "driver_training", name: "Driver Training" },
  { slug: "gridmap-v2", level: "gridmap_v2", name: "Grid Map V2" },
  { slug: "smallgrid", level: "smallgrid", name: "Small Grid" },
] as const;

export const SURFACES = [
  { value: "asphalt", label: "Asphalt" },
  { value: "gravel", label: "Gravel" },
  { value: "dirt", label: "Dirt" },
  { value: "mixed", label: "Mixed" },
  { value: "offroad", label: "Off-road" },
  { value: "snow", label: "Snow / ice" },
] as const;

export type Surface = (typeof SURFACES)[number]["value"];
export const SURFACE_LABEL: Record<string, string> = Object.fromEntries(
  SURFACES.map((s) => [s.value, s.label]),
);

export const SORTS = [
  { value: "new", label: "Newest" },
  { value: "top", label: "Top rated" },
  { value: "popular", label: "Most downloaded" },
  { value: "viewed", label: "Most viewed" },
  { value: "longest", label: "Longest" },
  { value: "shortest", label: "Shortest" },
  { value: "corners", label: "Most corners" },
] as const;
export type Sort = (typeof SORTS)[number]["value"];

export const PAGE_SIZE = 24;

export const LIMITS = {
  title: 80,
  description: 4000,
  tags: 8,
  tagLength: 24,
  images: 8,
  imageBytes: 5 * 1024 * 1024,
  mapName: 80,
  url: 500,
} as const;

export const SUGGESTED_TAGS = [
  "circuit",
  "rally",
  "hillclimb",
  "drag",
  "drift",
  "gymkhana",
  "touge",
  "endurance",
  "night",
  "beginner",
  "technical",
  "high-speed",
];
