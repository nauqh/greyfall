import type { NextConfig } from "next";

const config: NextConfig = {
  // The engine is a workspace package that exports raw TypeScript source.
  transpilePackages: ["@greyfall/engine"],
  // Dev bundles each async chunk with the whole unminified Phaser inside it,
  // a 24MB download per scene and the reason the first scene takes ages to
  // show. Sharing the one copy fixes dev; prod already splits this way.
  // Phaser ships a preminified ESM build; point dev at it so the shared
  // chunk is 1.2MB instead of a 24MB source bundle (served no-store, so
  // without this every reload re-pays the full download).
  webpack: (config, { dev }) => {
    if (dev) {
      config.resolve.alias.phaser = "phaser/dist/phaser.esm.min.js";
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: { phaser: { test: /[\\/]node_modules[\\/]phaser[\\/]/, name: "phaser", priority: 10 } },
      };
    }
    return config;
  },
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
      {
        // The pack is content-stable per version, and the intro alone pulls
        // ~68 files: without this every reload re-validates all of them
        // before the scene can paint.
        source: "/tiny-swords/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default config;
