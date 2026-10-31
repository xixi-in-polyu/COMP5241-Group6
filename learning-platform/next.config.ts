import type { NextConfig } from "next";
import path from "path";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.124.8"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: path.resolve(__dirname),
    
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
