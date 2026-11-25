import { pageMetadata } from "@/lib/seo";
import { ContactForm } from "@/components/store-forms";
import { first } from "@/lib/catalog";
import type { Query } from "@/lib/types";
import { Armchair, Hammer, Leaf, MapPin, ShieldCheck } from "lucide-react";
import { Crumbs, Heading, LinkButton, Picture } from "@/components/storefront";
const values = [[Leaf, "متریال طبیعی"], [Hammer, "توجه به ساخت"], [Armchair, "راحتی و کاربرد"], [ShieldCheck, "همراهی در انتخاب"]] as const;
const questions = [
  ["چطور مشخصات یک محصول را بررسی کنم؟", "در صفحهٔ محصول، بخش مشخصات را باز کنید. گالری، قیمت و وضعیت موجودی همان‌جا دیده می‌شوند."],
  ["کالاهای موجود را چگونه پیدا کنم؟", "در صفحهٔ محصولات، گزینهٔ «فقط کالاهای موجود» را در بخش فیلترها انتخاب کنید."],
  ["چطور محصولات مورد علاقه‌ام را ذخیره کنم؟", "نماد قلب را روی کارت یا صفحهٔ محصول انتخاب کنید. فهرست ذخیره‌شده از سربرگ قابل دسترسی است."],
];
export const generateMetadata = pageMetadata("about");

export default async function AboutPage({ searchParams }: { searchParams: Promise<Query> }) {
  const result = first((await searchParams).store);
  return <div className="container about-page">
    <Crumbs trail={[["درباره ما و تماس"]]}/>
    <section className="editorial-intro"><h1>داستان وودزی هوم</h1><p>مبلمان و دکور برای خانه‌ای که با زندگی شما شکل می‌گیرد.</p></section>
    <section className="about-story split"><Picture src="/images/interior.jpg" alt="فضای داخلی با مبلمان و چوب طبیعی"/><div><h2>چوب، بافت و خانه</h2><p>وودزی هوم مجموعه‌ای از مبلمان و اشیای دکوراتیو را در کنار هم قرار می‌دهد تا بتوانید بر اساس اندازه، کاربرد و سلیقهٔ خود انتخاب کنید.</p><LinkButton href="/categories" secondary>مرور مجموعه‌ها</LinkButton></div></section>
    <section className="about-values"><Heading title="ارزش‌های وودزی هوم"/><div className="value-grid">{values.map(([Icon, label]) => <div key={label}><Icon size={28}/><h3>{label}</h3></div>)}</div></section>
    <section id="contact" className="about-contact split"><div><MapPin size={28}/><h2>تماس و نمایشگاه</h2><p>اطلاعات تماس و نشانی نمایشگاه هنوز در فروشگاه منتشر نشده است.</p><ContactForm result={result}/></div><Picture src="/images/room.jpg" alt="چیدمان یک فضای نمایش مبلمان"/></section>
    <section id="faq" className="about-faq"><Heading title="پرسش‌های متداول"/>{questions.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
  </div>;
}
