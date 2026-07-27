import path from 'node:path';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // The content lives outside this app (../docs), so the workspace root is
  // the repository root — pinned explicitly because the repository has a
  // second package-lock.json and Next.js would otherwise guess.
  turbopack: {
    root: path.resolve(import.meta.dirname, '..'),
  },
};

export default withMDX(config);
