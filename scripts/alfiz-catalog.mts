/** Writes alfiz-catalog.json (what alfiz-verify reads) from src/lib/alfiz/catalog.ts. */
import { writeFileSync } from "node:fs";
import { catalog } from "../src/lib/alfiz/catalog.ts";

writeFileSync("alfiz-catalog.json", JSON.stringify(catalog.toDocument(), null, 2) + "\n");
