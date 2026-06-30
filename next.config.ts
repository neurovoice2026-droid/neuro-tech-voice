import type { NextConfig } from "next";

// Conservative security headers applied to every response. No strict CSP here —
// that needs per-app tuning against inline styles/3rd-party scripts and is easy
// to get wrong; these headers are safe defaults. Note: microphone is left
// unrestricted on purpose (the in-browser voice agent needs same-origin mic).
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,

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
