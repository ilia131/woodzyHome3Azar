# WoodzyHome backend-driven SEO

## Initial audit

Django already stores manual product overrides in `ProductSEO`. The product detail serializer exposes public effective SEO, canonical, social cards and Product/Offer data. API and native administrators use the existing staff permission and audit infrastructure. Product creation validates Unicode slugs and protects established slugs; the product model stores descriptions and a gallery but has no brand or condition field. The category selector already protects the full active ancestry. Category detail exposes editorial fields but no SEO contract. Existing sitemap lists products only, and Django's robots rules are limited to administration. Next renders part of the product payload, has static page metadata and category-derived titles, and lacks same-origin sitemap/robots routes. Django remains responsible for defaults, indexing decisions and structured data. Changes extend the existing model and routes, with an independent model specifically for category overrides.

## Implementation and API contract

| Endpoint | Behavior |
| --- | --- |
| `GET /api/v1/products/{slug}/` | Public product detail with effective `seo`, main image alt and gallery alt values. The existing catalog visibility rules apply. |
| `GET /api/v1/categories/{slug}/` | Public category detail with independent effective `seo`. Use `?filtered=1` to request noindex for a filtered view. |
| `GET /api/v1/seo/site/?page=home` | Storefront defaults for `home`, `products`, `categories`, `about`, and `search`. Search and filtered catalog views are noindex. |
| `/api/v1/admin/seo/` and `/api/v1/admin/category-seo/` | Existing staff model permissions govern reads and writes. Automatic records can be promoted to manual overrides, and the detail `regenerate/` action requires change permission. |
| `GET /api/v1/admin/seo-audit/` | Product totals, completion percentage, warnings and a paginated result set. Supports `status`, `search`, `page`, and `page_size`. |
| `/sitemap.xml` and `/robots.txt` | Next routes proxy Django responses on the storefront origin. Django generates entries and rules. |

The public SEO payload contains title, description, keywords, canonical, indexing and follow flags, Open Graph, Twitter and JSON-LD. Next uses the Metadata API and emits Django metadata in the initial server response. Anonymous detail lookups can revalidate after 30 seconds. Product lists and private calls keep their existing caching and authentication boundaries. Search and filtered catalog results are noindex. Cart, checkout, account and admin are outside the sitemap. The sitemap uses up to 10,000 candidates per shard, and excludes products with inactive ancestry, noindex records and pages whose canonical points to a different URL. Existing out-of-stock products still appear when indexable. The backend uses the actual category lineage for breadcrumbs and the database price and availability for Product/Offer. Brand and condition appear when explicitly recorded. Organization and WebSite use the store name and configured origin. Missing product images yield no image URL in JSON-LD or social cards. The storefront keeps its existing visible placeholder behavior.

Migration `seo.0003_productseo_created_at_productseo_focus_keyword_and_more` adds timestamps, keywords, main-image alt and generated-default tracking to ProductSEO and creates CategorySEO. Existing manual product SEO is retained. The old product SEO table had no timestamps, so its initial timestamps represent migration time. Catalog inserts initialize generated SEO where possible. A failed initializer is logged, and public reads can build the same defaults directly from catalog data. The stored snapshot is refreshed by regeneration or the backfill. Public metadata uses current catalog data, with each nonblank manual field taking priority. The audit flags duplicate effective metadata and identifies incomplete stored defaults separately. Equal editorial text can still yield duplicates, which require review.

The existing Next admin editor supports product and category overrides, social image upload, index/follow settings and regeneration. The product editor includes a search-result preview. The settings screen exposes the audit and links to each product editor.

## Deployment and backfill

1. Set `SITE_URL=https://woodzyhome.ir` for Django and its worker. Set server-only `DJANGO_API_URL` to the existing reachable API base ending in `/api/v1`. That origin must also route the Django `/sitemap.xml` and `/robots.txt` endpoints.
2. Set `SEO_MEDIA_URL` to the public HTTPS media base when Django is reached over an internal origin. Keep the frontend `DJANGO_MEDIA_URL` configured for visible catalog images. Confirm the trusted proxy preserves the public HTTPS scheme and that uploaded images return successfully.
3. Run the existing deployment migration job under the migration role, including `provision_roles`. Under Compose this is `docker compose --profile deploy run --rm init`, after database roles have been provisioned and the updated app image built.
4. Preview with `python manage.py generate_missing_seo --dry-run --batch-size 200`. Apply with `python manage.py generate_missing_seo --enqueue --batch-size 200` on a deployment with an active Celery worker, or omit `--enqueue` for a synchronous run outside HTTP. Run the default full scan when filling empty gallery alt fields. `--missing-only` limits selection to records without a saved defaults snapshot.
5. Review the audit metrics, verify representative canonical tags, HTTPS image URLs, XML shards, robots directives and JSON-LD in production, then submit the storefront sitemap through Search Console if applicable.

Production URLs are [sitemap.xml](https://woodzyhome.ir/sitemap.xml) and [robots.txt](https://woodzyhome.ir/robots.txt). This environment's outbound proxy returned HTTP 403 while opening the HTTPS tunnel to the domain. Public HTTPS, media availability and production API reachability remain unverified. No production data was processed. Production product/category completion counts must come from the deployed database.

## Verification

- Django on PostgreSQL 17.12 with Redis 6.2.14. The full suite passed 134 tests. A focused SEO run passed all 7 tests.
- Django system checks, migration consistency, schema generation with `spectacular --validate --fail-on-warn`, Docker Compose configuration validation, and `git diff --check` passed. A full Compose deployment was outside this verification. Django, PostgreSQL, Redis, Next and the Celery backfill were exercised in isolated local processes.
- A separate PostgreSQL database was migrated through the prior SEO schema, populated with an existing product and category plus a manual SEO entry, and migrated to the new schema. Dry-run identified one product and one category needing defaults. A real Celery worker processed both with batch size 1. The audit marked 1 of 1 fixture products complete, and 1 of 1 fixture categories had complete generated defaults. The previous manual title and follow flag were preserved.
- Next.js production build and TypeScript validation passed. The browser suite exercises server-rendered head tags, the admin save-to-public-title flow, Product and Breadcrumb JSON-LD, filtered noindex, robots and XML sitemap, plus existing account, checkout and RTL/responsive paths.
- Final Playwright run against the Next production build and the isolated Django backend passed 37 tests with 0 failures and 0 skips. The settings panel's tablet overflow was fixed by reusing the existing responsive admin form layout. The existing mock checkout regression used the explicit local test flag.
