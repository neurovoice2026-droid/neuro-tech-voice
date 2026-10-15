import type { MetadataRoute } from "next";
import { FOOTER, PRODUCT_GROUPS, SITE_URL, SOLUTION_ITEMS } from "@/lib/site";
import { INDUSTRY_SLUGS } from "@/lib/pages/industries";

/**
 * sitemap.xml: every public marketing page, and nothing else.
 *
 * Read from the constants the header and the footer are built from, so a
 * page added to a menu is listed here by itself. The trades come from
 * INDUSTRY_SLUGS rather than the menu, because that is the list of pages
 * actually prerendered. Hash links are sections of the homepage rather
 * than pages, and a tel: link is not a page at all.
 *
 * No lastModified: nothing records when a page's copy last changed, and a
 * build date stamped on every URL would be wrong for most of them.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    ...PRODUCT_GROUPS.flatMap((group) => group.items.map((item) => item.href)),
    ...SOLUTION_ITEMS.map((item) => item.href),
    "/industries",
    ...INDUSTRY_SLUGS.map((slug) => `/industries/${slug}`),
    ...FOOTER.legal.map((link) => link.href),
  ];

  return [...new Set(paths)]
    .filter((path) => path.startsWith("/") && !path.includes("#"))
    // The homepage as the canonical link prints it: the bare origin.
    .map((path) => ({ url: path === "/" ? SITE_URL : `${SITE_URL}${path}` }));
}
