import type { Metadata } from "next";
import type { Query, SEOMetadata } from "./types";
import { first, siteSeo } from "./catalog";

export function asMetadata(seo?: SEOMetadata | null): Metadata {
  if (!seo) return { robots: { index: false, follow: false } };
  const social = seo.open_graph;
  return {
    title: { absolute: seo.meta_title }, description: seo.meta_description,
    keywords: seo.meta_keywords || undefined, alternates: { canonical: seo.canonical_url },
    robots: { index: seo.robots_index, follow: seo.robots_follow },
    openGraph: { title: social.title, description: social.description, url: social.url, images: social.image ? [social.image] : undefined },
    twitter: { card: seo.twitter.card, title: seo.twitter.title, description: seo.twitter.description,
      images: seo.twitter.image ? [seo.twitter.image] : undefined },
  };
}

export function filteredCatalog(query: Query) {
  return ["q", "category", "min_price", "max_price", "in_stock", "ordering", "page"].some(key => first(query[key]).trim());
}

export function pageMetadata(page: string) {
  return async ({ searchParams }: { searchParams: Promise<Query> }) =>
    asMetadata(await siteSeo(page, filteredCatalog(await searchParams)));
}

export function SEOJsonLd({ seo }: { seo?: SEOMetadata | null }) {
  const entries = [seo?.structured_data, seo?.breadcrumb_data].filter(value => value && Object.keys(value).length);
  return <>{entries.map((value, index) => <script key={index} type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replace(/</g, "\\u003c") }}/>)}</>;
}
