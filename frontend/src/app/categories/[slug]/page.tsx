import { asMetadata, filteredCatalog, SEOJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/catalog-view";
import { category } from "@/lib/catalog";
import type { Query } from "@/lib/types";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Query> };
export async function generateMetadata({ params, searchParams }: Props) {
  const group = await category((await params).slug, filteredCatalog(await searchParams));
  return asMetadata(group?.seo);
}
export default async function CategoryPage({ params, searchParams }: Props) {
  const group = await category((await params).slug);
  if (!group) notFound();
  return <><SEOJsonLd seo={group.seo}/><CatalogView path={"/categories/" + encodeURIComponent(group.slug)} query={await searchParams} selected={group}/></>;
}
