import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the repository's existing contributor instructions unchanged by next dev.
  agentRules: false,
  pageExtensions: ["js", "jsx", "ts", "tsx", "mdx"],
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
