import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack to this app so it doesn't try to infer a workspace root
  // and lose `next` resolution when building from the pnpm monorepo.
  turbopack: {
    root: path.join(__dirname),
  },
  // Also tell Next.js about the workspace so file tracing is correct.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
