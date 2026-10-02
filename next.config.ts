import type { NextConfig } from "next";

// The app runs entirely on the Node.js runtime (no `export const runtime = "edge"`
// anywhere), so Prisma's edge-runtime bundles — which inline every supported
// database's query engine/compiler as base64 for environments without filesystem
// access — are dead weight that @vercel/nft can't prove unreachable on its own.
const unusedPrismaEdgeBundles = [
  "./node_modules/@prisma/client/runtime/*wasm-base64*",
  "./node_modules/@prisma/client/runtime/*edge*",
  "./node_modules/@prisma/client/runtime/react-native.*",
  "./node_modules/.prisma/client/wasm-edge-light-loader.mjs",
  "./node_modules/.prisma/client/wasm-worker-loader.mjs",
  "./node_modules/.prisma/client/edge.js",
  // schema.prisma's engineType = "client" means every query goes through the WASM query
  // compiler — the native-binary-engine runtime code is loaded by none of our code paths.
  // Verified: PrismaClient still constructs and `npm run build` still succeeds with these
  // files physically removed from node_modules.
  "./node_modules/@prisma/client/runtime/binary.js",
  "./node_modules/@prisma/client/runtime/binary.mjs",
];

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/**": unusedPrismaEdgeBundles,
  },
};

export default nextConfig;
