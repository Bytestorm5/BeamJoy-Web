/** Base-game levels, mirroring BeamJoyServer/services/maps.lua's own `base = true` list. */
export const VANILLA_MAPS = [
  { level: "west_coast_usa", name: "West Coast, USA" },
  { level: "east_coast_usa", name: "East Coast, USA" },
  { level: "italy", name: "Italy" },
  { level: "utah", name: "Utah, USA" },
  { level: "jungle_rock_island", name: "Jungle Rock Island" },
  { level: "johnson_valley", name: "Johnson Valley" },
  { level: "industrial", name: "Industrial Site" },
  { level: "hirochi_raceway", name: "Hirochi Raceway" },
  { level: "automation_test_track", name: "Automation Test Track" },
  { level: "small_island", name: "Small Island, USA" },
  { level: "derby", name: "Derby Arenas" },
  { level: "driver_training", name: "Driver Training" },
  { level: "gridmap_v2", name: "Grid Map V2" },
  { level: "smallgrid", name: "Small Grid" },
] as const;

export const VANILLA_MAP_BY_LEVEL: Record<string, string> = Object.fromEntries(
  VANILLA_MAPS.map((m) => [m.level, m.name]),
);

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
  { value: "popular", label: "Most copied" },
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
