import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Adresses courtes pour les pages statiques copiées depuis site/ (public/).
  async rewrites() {
    return ["dashboard", "login", "legal"].map((p) => ({ source: `/${p}`, destination: `/${p}.html` }));
  },
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
