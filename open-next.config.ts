import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Every database read happens at request time and nothing is revalidated, so prerendered
// shells can be served straight from Workers static assets: no cache bucket needed.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
