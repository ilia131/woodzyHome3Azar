import type { NextConfig } from "next";

const config: NextConfig = {
  htmlLimitedBots: /.*/, // Keep Django-derived metadata in the initial HTML for every crawler.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};
export default config;
