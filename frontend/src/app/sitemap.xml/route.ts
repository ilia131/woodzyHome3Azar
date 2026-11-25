import { seoDocument } from "@/lib/catalog";

export function GET(request: Request) {
  return seoDocument("sitemap.xml", new URL(request.url).search);
}
