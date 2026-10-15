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

// The store dashboard moved from Romanian paths (/magazin/...) to English ones
// (/store/...). Bookmarks and links in e-mails already sent keep working: each
// removed path answers a permanent (308) redirect to the page that replaced it.
// Next passes the query string through. Redirects run before the proxy, so a
// signed-out visitor lands on /store and is sent to the login from there.
const LEGACY_STORE_REDIRECTS: ReadonlyArray<{ source: string; destination: string }> = [
  { source: "/magazin", destination: "/store" },
  { source: "/magazin/conexiuni", destination: "/store/connections" },
  { source: "/magazin/comenzi", destination: "/store/orders" },
  { source: "/magazin/clienti", destination: "/store/customers" },
  { source: "/magazin/produse", destination: "/store/products" },
  { source: "/magazin/automatizari", destination: "/store/automations" },
  { source: "/magazin/nu-suna", destination: "/store/do-not-call" },
  { source: "/magazin/setari", destination: "/store/settings" },
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

  async redirects() {
    return LEGACY_STORE_REDIRECTS.map((r) => ({ ...r, permanent: true }));
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // The site's voices (public/audio/v1): a new take is a new version
        // folder, never a changed file, so a file is cached for good.
        source: "/audio/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
