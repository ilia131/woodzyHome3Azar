import { pageMetadata } from "@/lib/seo";
import { CategoryDirectory } from "@/components/interactive";
import { Advantages, Crumbs, LinkButton, Picture } from "@/components/storefront";
import { categories } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export const generateMetadata = pageMetadata("categories");

export default async function CategoriesPage() {
  return <div className="container categories-page">
    <Crumbs trail={[["دسته‌بندی‌ها"]]}/>
    <div className="directory-title"><h1>دسته‌بندی محصولات</h1><p>از مبلمان نشیمن تا جزئیات دکور، بر اساس نیازتان انتخاب کنید.</p></div>
    <CategoryDirectory items={await categories()}/>
    <div className="directory-advantages"><Advantages/></div>
    <section className="split custom-order"><div><h2>سفارش سفارشی</h2><p>برای بررسی امکان ساخت متناسب با فضای خانه‌تان با ما در ارتباط باشید.</p><LinkButton href="/about#contact">درخواست مشاوره</LinkButton></div><Picture src="/images/table.jpg" alt="میز ساخته شده از چوب"/></section>
  </div>;
}
