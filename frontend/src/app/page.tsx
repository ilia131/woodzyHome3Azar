import { pageMetadata, SEOJsonLd } from "@/lib/seo";
import Link from "next/link";
import { NewsletterForms } from "@/components/store-forms";
import type { Query } from "@/lib/types";
import Image from "next/image";
import { ArrowLeft, ArrowUpLeft, Armchair, Leaf, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { Advantages, CategoryGrid, Heading, LinkButton, Picture, ProductGrid } from "@/components/storefront";
import { collection, first, siteSeo, suggestedCategories } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const generateMetadata = pageMetadata("home");

export default async function Home({ searchParams }: { searchParams: Promise<Query> }) {
  const result = first((await searchParams).store);
  const [groups, popular, newest, viewed, discounts, bestSellers, mostFavorited, seo] = await Promise.all([suggestedCategories(), collection("products/popular/"), collection("products/?ordering=-newest"), collection("products/most-viewed/"), collection("products/best-discounts/"), collection("products/best-selling/"), collection("products/most-favorited/"), siteSeo("home")]);
  return <>
    <SEOJsonLd seo={seo}/>
    <section className="hero" aria-labelledby="home-title">
      <div className="container hero-inner">
        <div className="hero-copy">
          <span className="hero-tag"><Sparkles size={16}/> مبلمان، دکور و هنر چیدمان</span>
          <h1 id="home-title">خانه‌ای گرم‌تر،<br/><em>با روح چوب.</em></h1>
          <p>از مبلمان نشیمن تا کوچک‌ترین جزئیات دکور، بافت‌های طبیعی و طرح‌های ماندگار را برای خانه‌تان کشف کنید.</p>
          <div className="actions"><LinkButton href="/products">مشاهده محصولات</LinkButton><LinkButton href="/categories" secondary>دسته‌بندی‌ها</LinkButton></div>
          <div className="hero-trust"><span><Leaf/> بافت طبیعی</span><span><Armchair/> طراحی کاربردی</span><span><ShieldCheck/> پشتیبانی خرید</span></div>
        </div>
        <div className="hero-visual"><Image className="picture" src="/images/hero.jpg" alt="نشیمن روشن با مبل کرم و میز چوبی" fill preload sizes="(max-width: 760px) 100vw, 480px"/><Link href="/categories/living" className="hero-caption"><span><small>مجموعه نشیمن</small><b>چیدمان گرم و آرام</b></span><ArrowUpLeft size={24}/></Link></div>
      </div>
    </section>
    <Advantages/>
    <section className="container home-categories"><Heading kicker="دسته‌بندی‌ها" title="برای هر گوشه از خانه" text="از نشیمن تا اکسسوری، مجموعهٔ دلخواهتان را پیدا کنید."><LinkButton href="/categories" secondary>همه دسته‌بندی‌ها</LinkButton></Heading><CategoryGrid items={groups.slice(0, 6)}/></section>
    <section className="soft"><div className="container home-shelf"><Heading title="محصولات محبوب"><LinkButton href="/products?ordering=-score" secondary>مشاهده همه</LinkButton></Heading><ProductGrid items={popular}/></div></section>
    <section className="container seasonal-section"><div className="seasonal"><Picture src="/images/interior.jpg" alt="چیدمان نشیمن با بافت‌های طبیعی"/><div><h2>چیدمانی برای فصل تازه</h2><LinkButton href="/categories/living">مجموعهٔ نشیمن</LinkButton></div></div></section>
    <section className="container home-shelf"><Heading title="تازه‌های وودزی هوم"><LinkButton href="/products?ordering=-newest" secondary>دیدن تازه‌ها</LinkButton></Heading><ProductGrid items={newest}/></section>
    {[["پربازدیدترین محصولات", viewed], ["محصولات تخفیف‌دار", discounts], ["پرفروش‌ترین محصولات", bestSellers], ["بیشترین علاقه‌مندی‌ها", mostFavorited.filter(item => (item.favorite_count ?? 0) > 0)]].map(([title, items]) =>
      Array.isArray(items) && items.length > 0 ? <section key={String(title)} className="container home-shelf"><Heading title={String(title)}/><ProductGrid items={items}/></section> : null)}
    <section className="soft"><div className="container home-story split"><Picture src="/images/table.jpg" alt="میز چوبی در یک فضای نشیمن"/><div><span className="eyebrow">داستان وودزی هوم</span><h2>زیبایی در جزئیات پیدا می‌شود</h2><p>بافت، فرم و کاربرد را کنار هم می‌گذاریم تا انتخاب مبلمان برای زندگی روزمره ساده‌تر باشد.</p><LinkButton href="/about" secondary>درباره ما</LinkButton></div></div></section>
    <section id="lookbook" className="container lookbook"><Heading title="گالری چیدمان"/><div className="lookbook-grid">{["room", "chair", "table", "interior", "decor", "vase"].map(img => <Picture key={img} src={"/images/" + img + ".jpg"} alt="نمونه‌ای از مبلمان و دکور خانه"/>)}</div></section>
    <section className="soft"><div className="container home-testimonials"><Heading title="نظر مشتریان"/><div className="empty"><PackageCheck size={23}/> برای دیدن نظرهای تأییدشده، بخش دیدگاه‌های محصول را باز کنید.<Link href="/products" className="inline-link">مشاهده محصولات <ArrowLeft size={16}/></Link></div></div></section>
    <section id="newsletter" className="container home-news"><div className="newsletter"><div><h2>خبرنامه و مشاوره چیدمان</h2><p>برای راهنمایی درباره انتخاب محصول، اطلاعات تماس را ببینید.</p><NewsletterForms result={result}/></div><LinkButton href="/about#contact">ارتباط با ما</LinkButton></div></section>
  </>;
}
