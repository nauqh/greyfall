import type { NextConfig } from "next";

const config: NextConfig = {
  // The engine is a workspace package that exports raw TypeScript source.
  transpilePackages: ["@greyfall/engine"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

export default config;
