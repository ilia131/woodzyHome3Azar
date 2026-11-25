import { asMetadata, SEOJsonLd } from "@/lib/seo";
import { addToCart } from "@/app/actions";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/interactive";
import { Crumbs, FavoriteButton, Heading, ProductGrid } from "@/components/storefront";
import { category, collection, favoriteIds, first, number, product, reviews, toman } from "@/lib/catalog";
import type { Query } from "@/lib/types";
import Link from "next/link";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Query> };
const tabs = [["details", "مشخصات"], ["reviews", "دیدگاه‌ها"], ["care", "نگهداری"], ["guarantee", "ضمانت"]];
export async function generateMetadata({ params }: Props) {
  const item = await product((await params).slug);
  return asMetadata(item?.seo);
}
export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const item = await product(slug);
  if (!item) notFound();
  const query = await searchParams;
  const tab = first(query.tab);
  const cartStatus = first(query.cart);
  const active = tabs.some(t => t[0] === tab) ? tab : "details";
  const [group, related, similar, comments, favorites] = await Promise.all([
    category(item.category), collection("products/" + encodeURIComponent(slug) + "/related/", slug),
    collection("products/" + encodeURIComponent(slug) + "/similar/", slug),
    active === "reviews" ? reviews(item.id) : Promise.resolve([]),
    favoriteIds([item.id]),
  ]);
  const gallery = item.main_image && !item.gallery.some(i => i.image === item.main_image)
    ? [{ id: 0, image: item.main_image, position: 0, alt_text: item.main_image_alt_text || item.title }, ...item.gallery] : item.gallery;
  return <div className="container product-page">
    <Crumbs trail={[["محصولات", "/products"], ...(group ? [[group.name, "/categories/" + encodeURIComponent(group.slug)] as [string, string]] : []), [item.title]]}/>
    <section className="product-detail">
      <Gallery key={item.slug} images={gallery} title={item.title}/>
      <div className="product-info"><span className="eyebrow">{group?.name}</span><h1>{item.title}</h1><p>{item.short_description}</p>
        <div className="detail-rating">{item.review_count && item.average_rating != null ? `${number.format(item.average_rating)} از ۵ · ${number.format(item.review_count)} دیدگاه` : "بدون امتیاز ثبت‌شده"}</div>
        <div className="price-line"><strong>{toman(item.effective_price)}</strong>{item.discount_price && <s>{toman(item.price)}</s>}</div>
        <p className={item.in_stock ? "in-stock" : "availability"}>{item.in_stock ? "موجود" : "ناموجود"}</p>
        <div className="detail-actions">
          <form action={addToCart}><input type="hidden" name="slug" value={item.slug}/><label>تعداد <input name="quantity" type="number" min="1" max="99" defaultValue="1" required/></label><button className="button" disabled={!item.in_stock}>افزودن به سبد خرید</button></form>
          {cartStatus && <p role="status">{cartStatus === "saved" ? "محصول در سبد خرید ثبت شد." : cartStatus === "demo" ? "سبد خرید پس از اتصال به فروشگاه فعال می‌شود." : "ثبت در سبد خرید ممکن نبود. موجودی و تعداد را بررسی کنید."}</p>}
        </div>
        <div className="product-favorite"><FavoriteButton id={item.id} remove={favorites.has(item.id)}/><span>{favorites.has(item.id) ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}</span></div>
        <dl><dt>شناسه محصول</dt><dd dir="ltr">{item.sku}</dd></dl>
      </div>
    </section>
    <section className="detail-tabs" id="product-details"><nav aria-label="اطلاعات محصول">{tabs.map(([id, label]) => <Link key={id} href={"?tab=" + id + "#product-details"} aria-current={active === id ? "page" : undefined}>{label}</Link>)}</nav>
      {active === "details" && <p>{item.description || item.short_description}</p>}
      {active === "reviews" && (comments.length ? <ul>{comments.map(review => <li key={review.id}><strong>{review.title}</strong><p>{review.comment}</p><p>{number.format(review.rating)} از ۵</p>{review.replies.map(reply => <blockquote key={reply.id}><strong>پاسخ فروشگاه</strong><p>{reply.comment}</p></blockquote>)}</li>)}</ul> : <p>هنوز دیدگاه تأییدشده‌ای ثبت نشده است.</p>)}
      {active === "reviews" && <Link className="inline-link" href={"/account/activity?product=" + item.id}>ثبت دیدگاه</Link>}
      {["care", "guarantee"].includes(active) && <p>برای دریافت جزئیات این بخش، <Link className="inline-link" href="/about#contact">با فروشگاه تماس بگیرید.</Link></p>}
    </section>
    <section className="related"><Heading title="محصولات مکمل و مرتبط"/><ProductGrid items={related}/></section>
    {similar.length > 0 && <section className="related"><Heading title="محصولات مشابه"/><ProductGrid items={similar}/></section>}
    <SEOJsonLd seo={item.seo}/>
  </div>;
}
