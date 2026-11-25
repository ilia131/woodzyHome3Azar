import { pageMetadata } from "@/lib/seo";
import { CatalogView } from "@/components/catalog-view";
import type { Query } from "@/lib/types";
export const generateMetadata = pageMetadata("search");

export default async function SearchPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <CatalogView path="/search" query={await searchParams} search/>;
}
