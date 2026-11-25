import { cache } from "react";
import { cookies } from "next/headers";
import { showcaseCategories, showcaseProducts } from "./showcase";
import type { Category, Listing, Product, Query, Review, SEOMetadata } from "./types";

const apiBase = process.env.DJANGO_API_URL?.replace(/\/+$/, "");
export const demo = !apiBase && process.env.NODE_ENV !== "production" && process.env.WOODZY_SHOWCASE === "1";
export const first = (value?: string | string[]) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
export const normalize = (s: string) => s.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("fa");
export const number = new Intl.NumberFormat("fa-IR");
export const toman = (price: string) => number.format(Number(price) / (demo || (process.env.STORE_CURRENCY ?? "IRR") === "IRR" ? 10 : 1)) + " تومان";

export async function api(path: string, init?: RequestInit): Promise<Response> {
  if (!apiBase) throw new Error("Django API is not configured.");
  return fetch(apiBase + "/" + path, { ...init, cache: init?.cache ?? "no-store", signal: init?.signal ?? AbortSignal.timeout(6000) });
}

async function data<T>(path: string, cacheCatalog = false): Promise<T | null> {
  const response = await api(path, cacheCatalog ? { cache: "force-cache", next: { revalidate: 30 } } : undefined);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("خطا در دریافت اطلاعات فروشگاه (" + response.status + ")");
  return response.json() as Promise<T>;
}

async function personalData<T>(path: string): Promise<T | null> {
  const access = (await cookies()).get("woodzy-access")?.value;
  if (!access) return data<T>(path);
  const response = await api(path, { headers: { Authorization: "Bearer " + access } });
  if (response.status === 401) return data<T>(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("خطا در دریافت اطلاعات فروشگاه (" + response.status + ")");
  return response.json();
}

export async function favoriteIds(ids: number[]) {
  const jar = await cookies();
  if (demo) return new Set((jar.get("woodzy-demo-favorites")?.value ?? "").split(",").filter(Boolean).map(Number));
  const access = jar.get("woodzy-access")?.value;
  if (!access || !ids.length) return new Set<number>();
  const response = await api("favorites/status/?" + new URLSearchParams({ ids: ids.join(",") }), {
    headers: { Authorization: "Bearer " + access },
  });
  if (response.status === 401) return new Set<number>();
  if (!response.ok) throw new Error("دریافت وضعیت علاقه‌مندی‌ها امکان‌پذیر نبود.");
  const result: { ids: number[] } = await response.json();
  return new Set(result.ids);
}

export async function recentSearches() {
  if (demo) return [];
  const access = (await cookies()).get("woodzy-access")?.value;
  if (!access) return [];
  const response = await api("search/recent/?page_size=8", { headers: { Authorization: "Bearer " + access } });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error("دریافت جست‌وجوهای اخیر امکان‌پذیر نبود.");
  const result: Listing<{ term: string }> = await response.json();
  return result.results;
}

export async function popularSearches() {
  if (demo) return [];
  return (await data<Listing<{ term: string; count: number }>>("search/popular/?page_size=8", true))?.results ?? [];
}

function media(url: string | null) {
  if (!url || !apiBase) return url;
  const resolved = new URL(url, apiBase);
  if (!["http:", "https:"].includes(resolved.protocol)) return null;
  const browserMedia = process.env.DJANGO_MEDIA_URL?.replace(/\/+$/, "");
  if (browserMedia && resolved.origin === new URL(apiBase).origin && resolved.pathname.startsWith("/media/")) {
    return browserMedia + resolved.pathname.slice("/media".length) + resolved.search;
  }
  return resolved.href;
}
const productMedia = (p: Product): Product => ({
  ...p, main_image: media(p.main_image),
  gallery: p.gallery.flatMap(image => {
    const url = media(image.image);
    return url ? [{ ...image, image: url }] : [];
  }),
});

export const categories = cache(async (): Promise<Category[]> => {
  if (demo) return showcaseCategories;
  const list: Category[] = [];
  let page = 1;
  while (true) {
    const batch = await data<Listing<Category>>("categories/?page=" + page, true);
    if (!batch) return list;
    list.push(...batch.results.map(c => ({ ...c, image: media(c.image) })));
    if (!batch.next) return list;
    page += 1;
  }
});
export const category = cache(async (slug: string, filtered = false): Promise<Category | undefined> => {
  const target = slug === "living" ? process.env.LIVING_CATEGORY_SLUG || slug : slug;
  if (demo) return showcaseCategories.find(c => c.slug === target);
  const found = await data<Category>("categories/" + encodeURIComponent(target) + "/" + (filtered ? "?filtered=1" : ""), true);
  if (found) return { ...found, image: media(found.image) };
  if (slug === "living") {
    const alias = (await categories()).find(c => c.name === "نشیمن" && c.slug !== target);
    if (alias) return category(alias.slug, filtered);
  }

});
export async function categoryChildren(slug: string) {
  const group = await category(slug);
  if (!group) return [];
  if (demo) return showcaseCategories.filter(c => c.parent === group.id);
  return (await data<Listing<Category>>("categories/" + encodeURIComponent(group.slug) + "/children/?page_size=100", true))?.results ?? [];
}
export async function suggestedCategories() {
  if (demo) return showcaseCategories.slice(0, 6);
  return (await personalData<Listing<Category>>("categories/suggested/?page_size=6"))?.results.map(c => ({ ...c, image: media(c.image) })) ?? [];
}
export const product = cache(async (slug: string) => {
  if (demo) return showcaseProducts.find(p => p.slug === slug) ?? null;
  const found = await personalData<Product>("products/" + encodeURIComponent(slug) + "/");
  return found ? productMedia(found) : null;
});

const allowed = ["category", "q", "ordering", "in_stock", "min_price", "max_price", "page"] as const;
export function queryParams(query: Query) {
  const params = new URLSearchParams();
  for (const key of allowed) {
    const value = first(query[key]).trim();
    if (value) params.set(key, value);
  }
  return params;
}
function paginate(items: Product[], page: number): Listing<Product> {
  const size = 6;
  return { count: items.length, results: items.slice((page - 1) * size, page * size),
    previous: page > 1 ? String(page - 1) : null, next: page * size < items.length ? String(page + 1) : null };
}
export async function products(query: Query = {}, search = false): Promise<Listing<Product>> {
  const params = queryParams(query);
  const phrase = normalize(params.get("q") ?? "");
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const empty = paginate([], 1);
  if (search && (phrase.length < 2 || phrase.length > 120 || !/[\p{L}\p{N}]/u.test(phrase))) return empty;
  if (!demo) {
    const list = await (search ? personalData<Listing<Product>>("search/products/?" + params) : data<Listing<Product>>("products/?" + params, true));
    return list ? { ...list, results: list.results.map(productMedia) } : empty;
  }
  const slug = params.get("category");
  const parent = showcaseCategories.find(c => c.slug === slug)?.id;
  const allowedCategories = showcaseCategories.filter(c => c.slug === slug || c.parent === parent).map(c => c.slug);
  const result = showcaseProducts.filter(p =>
    (!slug || allowedCategories.includes(p.category)) &&
    (!search || normalize([p.title, p.short_description, showcaseCategories.find(c => c.slug === p.category)?.name].join(" ")).includes(phrase)) &&
    (params.get("in_stock") !== "true" || p.in_stock) &&
    (!params.has("min_price") || Number(p.effective_price) >= Number(params.get("min_price"))) &&
    (!params.has("max_price") || Number(p.effective_price) <= Number(params.get("max_price")))
  );
  const order = params.get("ordering");
  if (order === "price" || order === "-price") result.sort((a, b) => (Number(a.effective_price) - Number(b.effective_price)) * (order === "price" ? 1 : -1));
  if (order === "-newest") result.reverse();
  return paginate(result, page);
}

export async function collection(path: string, excludes?: string) {
  if (demo) {
    const items = showcaseProducts.filter(p => p.slug !== excludes);
    return (path.includes("newest") ? items.reverse() : items).slice(0, 4);
  }
  const listing = path === "products/recommended/" ? await personalData<Listing<Product>>(path)
    : await data<Listing<Product>>(path, !path.endsWith("/related/"));
  return listing?.results.map(productMedia).slice(0, 4) ?? [];
}

export async function recommendationsFromFavorites() {
  if (demo) return collection("products/recommended/");
  const access = (await cookies()).get("woodzy-access")?.value;
  if (!access) return [];
  const response = await api("recommendations/from-favorites/", { headers: { Authorization: "Bearer " + access } });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error("دریافت پیشنهادهای علاقه‌مندی امکان‌پذیر نبود.");
  const result: Listing<Product> = await response.json();
  return result.results.map(productMedia).slice(0, 4);
}

export async function favoriteProducts(page = 1): Promise<{ items: Listing<Product>; authenticated: boolean }> {
  const jar = await cookies();
  const key = demo ? "woodzy-demo-favorites" : "woodzy-access";
  const value = jar.get(key)?.value;
  if (demo) {
    const ids = value?.split(",") ?? [];
    return { items: paginate(showcaseProducts.filter(p => ids.includes(String(p.id))), page), authenticated: true };
  }
  if (!value) return { items: paginate([], 1), authenticated: false };
  const response = await api("favorites/?page=" + page, { headers: { Authorization: "Bearer " + value } });
  if ([401, 403].includes(response.status)) return { items: paginate([], 1), authenticated: false };
  if (!response.ok) throw new Error("دریافت علاقه‌مندی‌ها امکان‌پذیر نبود.");
  const list: Listing<Product> = await response.json();
  return { items: { ...list, results: list.results.map(productMedia) }, authenticated: true };
}

export async function reviews(id: number) {
  if (demo) return [];
  return (await data<Listing<Review>>("products/" + id + "/reviews/"))?.results ?? [];
}


export const siteSeo = cache(async (page: string, filtered = false) => {
  if (demo || !apiBase) return null;
  return data<SEOMetadata>("seo/site/?" + new URLSearchParams({ page, filtered: filtered ? "1" : "0" }), true);
});

export async function seoDocument(path: "robots.txt" | "sitemap.xml", search = "") {
  if (!apiBase) return new Response("SEO document unavailable", { status: 503 });
  try {
    const url = new URL(apiBase);
    url.pathname = "/" + path;
    url.search = search;
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "text/plain" },
    });
  } catch {
    return new Response("SEO document unavailable", { status: 503 });
  }
}
