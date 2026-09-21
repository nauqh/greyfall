import type { NextConfig } from "next";

const config: NextConfig = {
  // The engine is a workspace package that exports raw TypeScript source.
  transpilePackages: ["@greyfall/engine"],
};

export default config;
