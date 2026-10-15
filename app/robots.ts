import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * robots.txt: the marketing pages are open, the app is not.
 *
 * Everything behind a sign-in (the dashboard, the store, onboarding), the
 * API, the auth callback and the password-reset screens is closed to
 * crawlers: none of it is a page a stranger can read, and following those
 * links only ever lands on the login. Prefixes, so each covers its
 * sub-pages; none of them is the start of a marketing path (/integrations
 * is the dashboard's, /product/integrations is unaffected).
 *
 * tests/seo-routes.test.ts fails when a dashboard route is added without a
 * line here, and when a line here would hide a page the sitemap lists.
 */
const PRIVATE_PATHS = [
  "/api/",
  "/auth/",
  "/onboarding",
  "/dashboard",
  "/agent",
  "/calls",
  "/phone",
  "/integrations",
  "/billing",
  "/store",
  "/settings",
  "/workflows",
  "/forgot-password",
  "/reset-password",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
