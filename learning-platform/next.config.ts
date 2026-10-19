import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.124.8"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["esbuild", "@babel/parser", "@babel/traverse", "pdfjs-dist"],
};

export default withWorkflow(nextConfig);
