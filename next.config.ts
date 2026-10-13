import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Cache Components / partial prerendering is deliberately off: it hangs in the Workers runtime
// (Next warns that workerd's setTimeout can't support it). Pages render per request instead,
// which every page here does anyway since they all read D1 or the session.
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Screenshots are downscaled in the browser before upload, so this is a generous ceiling.
      bodySizeLimit: "12mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Gives `next dev` the wrangler.jsonc bindings (local D1 + R2 under .wrangler/state).
initOpenNextCloudflareForDev();
