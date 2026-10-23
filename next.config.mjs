import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the repository's existing contributor instructions unchanged by next dev.
  agentRules: false,
  pageExtensions: ["js", "jsx", "ts", "tsx", "mdx"],
  images: { localPatterns: [{ pathname: "/images/**" }, { pathname: "/_next/static/media/**" }] },
  outputFileTracingIncludes: {
    "/api/site-images/*": ["./private-assets/site/**/*"],
    "/": ["./private-assets/site/**/*"],
    "/board": ["./private-assets/site/**/*"],
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
