import { z } from "zod";

/**
 * Race share codes, as produced by BeamJoy-Revived's in-game race editor
 * (BeamJoyClient/ui/modModules/beamjoy/windows/config/races/editor/app.js):
 *
 *   "BJRACE1:" + base64(gzip(JSON.stringify(strippedRace)))
 *
 * The stripped payload only carries the portable route definition (no id/author/leaderboard,
 * no per-gate `step`, no `distance`), so everything the site shows about a route is derived
 * from the gates and start positions below.
 */
export const RACE_SHARE_CODE_PREFIX = "BJRACE1:";

const vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });

export const raceGateSchema = z.object({
  pos: vec3,
  dir: vec3.optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  sector: z.boolean().optional(),
  parents: z.array(z.number().int()).optional(),
  isFinish: z.boolean().optional(),
});

export const raceStartPositionSchema = z.object({
  pos: vec3,
  dir: vec3.optional(),
});

// `.loose()` everywhere: a newer exporter may add fields, and those must survive untouched.
export const racePayloadSchema = z
  .object({
    name: z.string().optional(),
    mode: z.string().optional(),
    loopable: z.boolean().optional(),
    sectorCount: z.number().optional(),
    manualSectors: z.boolean().optional(),
    branchingEnabled: z.boolean().optional(),
    oneWayGates: z.boolean().optional(),
    gates: z.array(raceGateSchema.loose()).min(1).max(2000),
    startPositions: z.array(raceStartPositionSchema.loose()).max(500),
    defaults: z.record(z.string(), z.unknown()).optional(),
  })
  .loose();

export type RaceGate = z.infer<typeof raceGateSchema>;
export type RacePayload = z.infer<typeof racePayloadSchema>;
