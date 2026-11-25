import { pageMetadata } from "@/lib/seo";
import { CatalogView } from "@/components/catalog-view";
import type { Query } from "@/lib/types";
export const generateMetadata = pageMetadata("products");

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <CatalogView path="/products" query={await searchParams}/>;
}
