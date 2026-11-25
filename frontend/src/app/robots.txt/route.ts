import { seoDocument } from "@/lib/catalog";

export function GET() {
  return seoDocument("robots.txt");
}
