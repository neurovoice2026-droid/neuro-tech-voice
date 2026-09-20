import type { NextConfig } from "next";

// Security headers applied to every response. The Content-Security-Policy is
// not here: it differs per page (a per-request nonce on dashboard pages, a
// host allowlist on prerendered ones) and is set by proxy.ts through
// lib/security/csp.ts. Setting one here as well would stack two policies.
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Same intent as the CSP's frame-ancestors 'none', for browsers that only
  // read the older header.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone for this origin only: the in-browser test call and the voice
  // demo need it; embedded third-party frames never get it.
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), browsing-topics=(), microphone=(self)",
  },
  // Isolates the window from any cross-origin page it opens or was opened by.
  // Stripe Checkout and Google sign-in are full-page redirects, not popups,
  // so nothing relies on window.opener.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,

  experimental: {
    // Turbopack's on-disk dev cache (.next/dev) kept serving a stale
    // app/globals.css on Windows — edits never reached the browser, not even
    // across a restart, until the folder was deleted. A cold compile on each
    // `next dev` is the cheaper trade. Production builds are unaffected.
    turbopackFileSystemCacheForDev: false,

    // Rewrite barrel imports to the modules actually used. lucide-react,
    // date-fns and recharts are already on Next's default list and are named
    // here only so the intent is explicit; framer-motion and the flag strings
    // are not on it.
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "framer-motion",
      "country-flag-icons/string/3x2",
    ],
  },

  // Allow optimizing images served from Supabase Storage (org logos) and Google
  // account avatars. All other remote hosts are blocked by next/image by default.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
