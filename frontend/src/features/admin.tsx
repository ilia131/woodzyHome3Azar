import Link from "next/link";
import { randomUUID } from "node:crypto";
import { ApiTable, DataTable, MutationForm, Panel, ServiceIssue } from "@/components/workspace";
import { LinkButton } from "@/components/storefront";
import { authorized, list, type Row } from "@/lib/private-api";
import { first } from "@/lib/catalog";
import type { Query } from "@/lib/types";
import type { Field } from "./operations";
import { orderColumns, paymentColumns, readPage } from "./customer";

export const adminNav = [["overview","نمای مدیریت"],["products","مدیریت محصولات"],["editor","ویرایشگر محصول"],["categories","مدیریت دسته‌بندی"],["inventory","مدیریت موجودی"],["orders","مدیریت سفارش‌ها"],["customers","مدیریت مشتریان"],["payments","پرداخت‌ها و درگاه‌ها"],["settings","نظرات، گزارش‌ها و تنظیمات"]] as const;
const productColumns: [string,string][] = [["title","محصول"],["sku","شناسه"],["price","قیمت"],["stock","موجودی"],["is_active","فعال"]];
const identify = (value: Row) => String(value.id);
const rowId = (query: Query) => { const id = first(query.id); return /^[1-9]\d{0,15}$/.test(id) ? id : ""; };
const lookup = (route: string, search: string) => route + (search ? "?q=" + encodeURIComponent(search) : "");
function SearchAdmin({ path, value, label }: { path: string; value: string; label: string }) {
  return <form action={path} className="search-form"><label className="field"><input name="q" aria-label={label} placeholder={label} defaultValue={value} maxLength={100}/></label><button className="button">جست‌وجو</button></form>;
}
function listed(path: string, query: Query, searchKey = "search") {
  const q = first(query.q).trim().slice(0, 100);
  return { search: q, endpoint: q ? "?" + new URLSearchParams({ [searchKey]: q }) : "", page: readPage(query), route: lookup(path, q) };
}
async function Overview() {
  return <><Panel title="بخش‌های مدیریت"><div className="metric-grid">{adminNav.slice(1).map(([slug,label]) => <Link key={slug} href={"/admin/" + slug}>{label}</Link>)}</div></Panel>
    <Panel title="آخرین رویدادهای ممیزی"><ApiTable endpoint="admin/audit-logs/" columns={[["action","عملیات"],["model_label","نوع"],["created_at","زمان"]]}/></Panel></>;
}
function Products({ query }: { query: Query }) {
  const args = listed("/admin/products", query);
  return <Panel title="کاتالوگ محصولات"><LinkButton href="/admin/editor">محصول جدید</LinkButton><SearchAdmin path="/admin/products" value={args.search} label="عنوان، شناسه یا نشانی"/>
    <ApiTable endpoint={"admin/products/" + args.endpoint} route={args.route} page={args.page} columns={productColumns} actions={p => <Link className="inline-link" href={"/admin/editor?id=" + p.id}>ویرایش</Link>}/></Panel>;
}
const productFields = (options: [string,string][], row?: Row): Field[] => [
  { name: "title", label: "عنوان", required: true }, ...(!row ? [{name: "slug", label: "نشانی محصول", required: true}] : []),
  { name: "sku", label: "شناسه کالا", required: true }, { name: "short_description", label: "توضیح کوتاه", required: true },
  { name: "description", label: "توضیحات", type: "textarea", required: true }, { name: "price", label: "قیمت", required: true }, { name: "discount_price", label: "قیمت تخفیف" },
  { name: "category", label: "دسته", type: "select", options, required: true }, { name: "main_image", label: "تصویر اصلی", type: "file" },
  { name: "is_active", label: "فعال", type: "checkbox" }, { name: "is_featured", label: "ویژه", type: "checkbox" },
  ...(!row ? [{ name: "stock", label: "موجودی اولیه", type: "number", value: 0, min: 0 }] : []),
].map(f => ({ ...f, value: row ? row[f.name] : f.name === "is_active" ? true : "value" in f ? f.value : undefined })) as Field[];
async function ProductEditor({ query }: { query: Query }) {
  const id = rowId(query);
  const [row, groups] = await Promise.all([id ? authorized("admin/products/" + id + "/") : null, list("admin/categories/")]);
  const route = "/admin/editor" + (id ? "?id=" + id : "");
  const options: [string,string][] = [["","انتخاب دسته"], ...groups.rows.map((c): [string,string] => [String(c.id),String(c.name)])];
  if (row?.category && !options.some(([value]) => value === String(row.category))) options.push([String(row.category), String(row.category)]);
  return <><Panel title={id ? "ویرایش محصول" : "ساخت محصول"}><MutationForm operation={id ? "editProduct" : "addProduct"} id={id} returnTo={route} label="ذخیره محصول" fields={productFields(options,row ?? undefined)}/></Panel>
    {id && <Panel title="گالری محصول"><ApiTable endpoint={"admin/product-images/?product=" + id} columns={[["position","ترتیب"],["alt_text","متن جایگزین"]]} actions={r => <details><summary>ویرایش تصویر</summary>
      <MutationForm operation="editImage" id={identify(r)} returnTo={route} label="ذخیره مشخصات تصویر" fields={[
        {name:"alt_text",label:"متن جایگزین",value:String(r.alt_text ?? "")},
        {name:"position",label:"ترتیب",type:"number",min:0,value:Number(r.position),required:true},
      ]}/>
      <MutationForm operation="removeImage" id={identify(r)} returnTo={route} label="حذف تصویر"/>
    </details>}/>
    <MutationForm operation="addImage" returnTo={route} label="افزودن تصویر" fields={[
      {name:"product",label:"",type:"hidden",value:id},{name:"image",label:"تصویر",type:"file",required:true},{name:"alt_text",label:"متن جایگزین"},{name:"position",label:"ترتیب",type:"number",min:0,value:0},
    ]}/></Panel>}
    {id && <Panel title="تاریخچه محصول"><ApiTable endpoint={"admin/product-history/?product=" + id} columns={[["created_at","تاریخ"],["price","قیمت"],["discount_price","قیمت تخفیف"],["stock","موجودی"]]}/></Panel>}
    {id && <ProductMetrics id={id}/>}
    {id && row && <SEOEditor entityId={id}/>}</>;
}
async function ProductMetrics({ id }: { id: string }) {
  try {
    const metrics = await authorized("admin/products/" + id + "/views/");
    return <Panel title="آمار بازدید محصول"><DataTable rows={[metrics]} columns={[
      ["total","کل"], ["authenticated","با حساب"], ["guest","مهمان"], ["unique","یکتا"], ["weekly","هفته"], ["monthly","ماه"],
    ]}/></Panel>;
  } catch (error) { return <Panel title="آمار بازدید محصول"><ServiceIssue error={error}/></Panel>; }
}
async function SEOEditor({ entityId, isCategory = false }: { entityId: string; isCategory?: boolean }) {
  const key = isCategory ? "category" : "product";
  const route = isCategory ? "/admin/categories?id=" + entityId : "/admin/editor?id=" + entityId;
  const title = isCategory ? "سئوی دسته‌بندی" : "سئوی محصول";
  try {
    const endpoint = isCategory ? "admin/category-seo/" : "admin/seo/";
    const records = await list(endpoint + "?" + new URLSearchParams({ [key]: entityId }));
    const row = records.rows.find(candidate => String(candidate[key]) === entityId);
    const generated = row?.generated as Record<string, string> | undefined;
    const fields: Field[] = [
      ...(!row ? [{ name: key, label: "", type: "hidden" as const, value: entityId }] : []),
      ...[["meta_title","عنوان متا"],["meta_description","توضیح متا"],["meta_keywords","کلیدواژه‌ها"],
        ["focus_keyword","کلیدواژهٔ اصلی"],["secondary_keywords","کلیدواژه‌های فرعی"],["canonical_url","نشانی Canonical"],
        ["og_title","عنوان اشتراک‌گذاری"],["og_description","توضیح اشتراک‌گذاری"],
        ...(!isCategory ? [["main_image_alt_text","متن جایگزین تصویر اصلی"]] : []),
      ].map(([name,label]) => ({name,label,value:String(row?.[name] ?? "")})),
      {name:"og_image",label:"تصویر اشتراک‌گذاری",type:"file"},
      {name:"robots_index",label:"نمایه‌سازی",type:"checkbox",value:row?.robots_index !== false},
      {name:"robots_follow",label:"دنبال کردن پیوندها",type:"checkbox",value:row?.robots_follow !== false},
    ];
    const operation = isCategory ? (row ? "editCategorySeo" : "addCategorySeo") : (row ? "editSeo" : "addSeo");
    return <Panel title={title}>
      <p>{row?.manually_edited ? "ویرایش دستی" : "پیش‌فرض خودکار"} · پیش‌نمایش نتیجهٔ جست‌وجو</p>
      <div className="empty"><small dir="ltr">{String(row?.canonical_url || generated?.canonical_url || "")}</small>
        <h3>{String(row?.meta_title || generated?.meta_title || "")}</h3><p>{String(row?.meta_description || generated?.meta_description || "")}</p>
      </div>
      <p>فیلد متنی خالی از پیش‌فرض بک‌اند استفاده می‌کند.</p>
      <MutationForm operation={operation} id={row ? identify(row) : ""} returnTo={route} fields={fields} label="ذخیره سئو"/>
      {row && <MutationForm operation={isCategory ? "regenerateCategorySeo" : "regenerateSeo"} id={identify(row)} returnTo={route} label="بازسازی پیش‌فرض‌ها"/>}
    </Panel>;
  } catch (error) { return <Panel title={title}><ServiceIssue error={error}/></Panel>; }
}
const categoryFields = (groups: Row[], r: Row = {}): Field[] => [
  {name:"name",label:"نام",value:String(r.name ?? ""),required:true}, {name:"slug",label:"نشانی",value:String(r.slug ?? ""),required:true},
  {name:"description",label:"توضیح",type:"textarea",value:String(r.description ?? "")},
  {name:"parent",label:"والد",type:"select",value:String(r.parent ?? ""),options:[["","بدون والد"],...groups.filter(g => g.id !== r.id).map((g): [string,string] => [String(g.id),String(g.name)])]},
  {name:"image",label:"تصویر",type:"file"}, {name:"is_active",label:"فعال",type:"checkbox",value:r.is_active !== false},
];
async function Categories({ query }: { query: Query }) {
  const args = listed("/admin/categories",query);
  const groups = await list("admin/categories/" + args.endpoint);
  return <><Panel title="دسته‌های فروشگاه"><SearchAdmin path="/admin/categories" value={args.search} label="نام دسته"/>
    <ApiTable endpoint={"admin/categories/" + args.endpoint} route={args.route} page={args.page} columns={[["name","نام"],["parent","والد"],["is_active","فعال"]]} actions={row => <details><summary>ویرایش</summary><MutationForm operation="editCategory" id={identify(row)} returnTo="/admin/categories" label="ذخیره دسته" fields={categoryFields(groups.rows,row)}/><Link href={"/admin/categories?id=" + row.id}>سئوی دسته‌بندی</Link></details>}/>
    <h3>دسته جدید</h3><MutationForm operation="addCategory" returnTo="/admin/categories" label="ثبت دسته" fields={categoryFields(groups.rows)}/>
  </Panel>{rowId(query) && <SEOEditor entityId={rowId(query)} isCategory/>}</>;
}
async function Inventory({ query }: { query: Query }) {
  const id = rowId(query);
  const selected = id ? await authorized("admin/products/" + id + "/") : null;
  return <><Panel title="اصلاح موجودی">{selected && <><p>{selected.title} · موجودی {selected.stock}</p><MutationForm operation="stock" id={id} returnTo={"/admin/inventory?id=" + id} label="ثبت تغییر موجودی" fields={[
    {name:"operation_id",label:"",type:"hidden",value:randomUUID()},{name:"delta",label:"تغییر تعداد (مثبت یا منفی)",type:"number",required:true},
  ]}/></>}
  <ApiTable endpoint="admin/products/" route="/admin/inventory" page={readPage(query)} columns={productColumns} actions={row => <Link href={"/admin/inventory?id=" + row.id}>انتخاب کالا</Link>}/></Panel>
  <Panel title="دفتر تغییرات موجودی"><ApiTable endpoint={"admin/inventory/movements/" + (id ? "?product_id_snapshot=" + id : "")} columns={[["product_id_snapshot","کالا"],["order_id","سفارش"],["kind","نوع"],["available_delta","تغییر"],["created_at","زمان"]]}/></Panel></>;
}
async function Orders({ query }: { query: Query }) {
  const id = rowId(query);
  if (id) {
    const order = await authorized("admin/orders/" + id + "/");
    const transitions: Record<string,[string,string]> = {
      pending_payment: ["cancelled", "لغو سفارش و آزادسازی رزرو"],
      paid: ["processing", "شروع آماده‌سازی"],
      processing: ["completed", "تکمیل سفارش"],
    };
    const transition = transitions[String(order.status)];
    return <Panel title={"سفارش " + order.order_number}><DataTable rows={[order]} columns={[...orderColumns,["user_id","کاربر"]]}/>
      <h3>اقلام</h3><DataTable rows={order.items} columns={[["product_title","محصول"],["quantity","تعداد"],["line_total","جمع"]]}/>
      {transition && <MutationForm id={id} operation="staffOrderStatus" returnTo={"/admin/orders?id=" + id} label={transition[1]} fields={[
        { name: "expected_status", label: "", type: "hidden", value: String(order.status) },
        { name: "status", label: "", type: "hidden", value: transition[0] },
      ]}/>}
      <h3>رزروها</h3><DataTable rows={order.reservations} columns={[["product_id","محصول"],["quantity","تعداد"],["status","وضعیت"],["expires_at","انقضا"]]}/></Panel>;
  }
  const args = listed("/admin/orders",query,"order_number");
  return <Panel title="سفارش‌ها"><SearchAdmin path="/admin/orders" value={args.search} label="شماره سفارش"/><ApiTable endpoint={"admin/orders/" + args.endpoint} route={args.route} page={args.page} columns={orderColumns} actions={row => <Link href={"/admin/orders?id=" + row.id}>جزئیات</Link>}/></Panel>;
}
function Customers({ query }: { query: Query }) {
  const args = listed("/admin/customers",query);
  return <Panel title="مشتریان"><SearchAdmin path="/admin/customers" value={args.search} label="نام، ایمیل یا شماره موبایل"/>
    <ApiTable endpoint={"admin/users/" + args.endpoint} route={args.route} page={args.page} columns={[["first_name","نام"],["last_name","نام خانوادگی"],["phone","موبایل"],["is_active","فعال"]]}
      actions={row => <MutationForm operation="customer" id={identify(row)} returnTo={args.route} label={row.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"} fields={[{name:"is_active",label:"",type:"hidden",value:!row.is_active}]}/>}/></Panel>;
}
async function Payments({ query }: { query: Query }) {
  const id = rowId(query);
  const args = listed("/admin/payments", query);
  return <><Panel title="آمادگی درگاه‌ها"><ApiTable endpoint="admin/payments/providers/" columns={[["display_name","درگاه"],["status","وضعیت"],["enabled","فعال"],["ready","آماده تراکنش واقعی"]]}/></Panel>
    <Panel title="پرداخت‌ها"><SearchAdmin path="/admin/payments" value={args.search} label="شماره سفارش یا مرجع پرداخت"/>
    {id && <DataTable rows={[await authorized("admin/payments/" + id + "/")]} columns={[...paymentColumns,["review_reason","دلیل بررسی"]]}/>}
    <ApiTable endpoint={"admin/payments/" + args.endpoint} route={args.route} page={args.page} columns={paymentColumns} actions={row => <Link href={"/admin/payments?id=" + row.id}>جزئیات</Link>}/></Panel>
    <Panel title="تراکنش‌ها"><ApiTable endpoint={"admin/payments/transactions/" + (id ? "?payment=" + id : "")} columns={[["payment","پرداخت"],["transaction_type","نوع"],["status","وضعیت"],["provider_transaction_id","مرجع"]]}/></Panel>
    <Panel title="مغایرت‌ها"><ApiTable endpoint="admin/payments/reconciliation/" columns={paymentColumns}/></Panel></>;
}
async function RankingSettings() {
  try {
    const { rows } = await list("admin/ranking-weights/");
    const weights = rows[0];
    if (!weights) return <p className="empty">وزن‌های رتبه‌بندی هنوز تنظیم نشده‌اند.</p>;
    const fields: [string, string][] = [
      ["views","بازدید"], ["favorites","علاقه‌مندی"], ["discount","تخفیف"],
      ["affordability","قیمت مناسب"], ["freshness","تازگی"], ["featured","ویژه"],
    ];
    return <MutationForm operation="rankingWeights" id={identify(weights)} returnTo="/admin/settings"
      fields={fields.map(([name,label]) => ({name,label,value:String(weights[name] ?? "")}))} label="ذخیره وزن‌های رتبه‌بندی"/>;
  } catch (error) { return <ServiceIssue error={error}/>; }
}

const seoWarnings: Record<string, string> = {
  missing_title: "عنوان خالی", missing_description: "توضیح خالی", missing_canonical: "Canonical خالی",
  invalid_canonical: "Canonical نامعتبر", duplicate_title: "عنوان تکراری", duplicate_description: "توضیح تکراری",
  long_title: "عنوان طولانی", long_description: "توضیح طولانی", missing_image: "تصویر ندارد",
  missing_alt: "Alt خالی", invalid_slug: "Slug نامعتبر", noindex: "Noindex", not_generated: "پیش‌فرض ذخیره نشده",
  complete: "کامل",
};

async function SEOAudit({ query }: { query: Query }) {
  const status = first(query.seo_status);
  const search = first(query.seo_search);
  const page = Math.max(1, Number(first(query.seo_page)) || 1);
  const params = new URLSearchParams({ status, search, page: String(page), page_size: "20" });
  const path = (position: number) => "/admin/settings?" + new URLSearchParams({ seo_status: status, seo_search: search, seo_page: String(position) });
  try {
    const data: { summary: Record<string, number>; count: number; results: { id: number; title: string; warnings: string[] }[] } =
      await authorized("admin/seo-audit/?" + params);
    const labels = { total: "کل محصولات", complete: "کامل", completion_percentage: "درصد تکمیل" };
    return <Panel title="ممیزی سئوی محصولات">
      <form action="/admin/settings" className="workspace-form">
        <label>محصول<input name="seo_search" defaultValue={search}/></label>
        <label>وضعیت<select name="seo_status" defaultValue={status}><option value="">همه</option>
          {Object.entries(seoWarnings).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <button className="button">اعمال فیلتر</button>
      </form>
      <dl>{Object.entries(data.summary).map(([key,count]) => <div key={key}>
        <dt>{labels[key as keyof typeof labels] || seoWarnings[key] || key}</dt><dd>{count}</dd></div>)}</dl>
      <DataTable rows={data.results.map(row => ({ ...row, warnings: row.warnings.map(code => seoWarnings[code] ?? code).join("، ") || "کامل" }))}
        columns={[["title","محصول"],["warnings","هشدارها"]]} actions={row => <Link href={"/admin/editor?id=" + row.id}>ویرایش سئو</Link>}/>
      <nav className="pagination" aria-label="صفحه‌بندی ممیزی">
        {page > 1 && <Link href={path(page - 1)}>صفحه قبل</Link>}
        {page * 20 < data.count && <Link href={path(page + 1)}>صفحه بعد</Link>}
      </nav>
    </Panel>;
  } catch (error) { return <Panel title="ممیزی سئوی محصولات"><ServiceIssue error={error}/></Panel>; }
}

async function Settings({ query }: { query: Query }) {
  const policyFields = [["favorite_weight","وزن علاقه‌مندی"],["view_weight","وزن بازدید"],["category_weight","وزن دسته"],["title_weight","وزن عنوان"],["description_weight","وزن توضیح"],["history_days","روزهای تاریخچه"],["min_viewed_products","حداقل محصول دیده‌شده"],["seed_limit","حد پیشنهاد اولیه"]];
  let policy: Row | undefined;
  let policyError: unknown;
  try { policy = await authorized("admin/recommendation-settings/"); } catch (e) { policyError = e; }
  return <><SEOAudit query={query}/><Panel title="مدیریت دیدگاه‌ها"><ApiTable endpoint="admin/reviews/" route="/admin/settings" page={readPage(query)} columns={[["title","عنوان"],["rating","امتیاز"],["is_approved","تأیید شده"]]} actions={r => <details><summary>بررسی دیدگاه</summary>
    <p>{String(r.comment ?? "")}</p><MutationForm operation="review" id={identify(r)} returnTo="/admin/settings" label={r.is_approved ? "رد دیدگاه" : "تأیید دیدگاه"} fields={[{name:"is_approved",label:"",type:"hidden",value:!r.is_approved}]}/>
    <MutationForm operation="reply" id={identify(r)} returnTo="/admin/settings" label="ارسال پاسخ" fields={[{name:"comment",label:"پاسخ",type:"textarea",required:true}]}/></details>}/></Panel>
    <Panel title="گزارش محصولات پربازدید"><ApiTable endpoint="admin/reports/most-viewed-products/" columns={[["title","محصول"],["view_count","بازدید"]]}/></Panel>
    <Panel title="محبوب‌ترین محصولات"><ApiTable endpoint="admin/reports/popular-products/" columns={[["title","محصول"],["favorite_count","علاقه‌مندی‌ها"],["view_count","بازدید"]]}/></Panel>
    <Panel title="دسته‌های محبوب"><ApiTable endpoint="admin/reports/popular-categories/" columns={[["name","دسته"],["description","توضیح"]]}/></Panel>
    <Panel title="وزن‌های رتبه‌بندی"><RankingSettings/></Panel>
    <Panel title="تنظیمات پیشنهادها">{policy ? <MutationForm operation="recommendation" returnTo="/admin/settings" label="ذخیره تنظیمات" fields={policyFields.map(([name,label]) => ({name,label,value:String(policy[name] ?? "")}))}/> : <ServiceIssue error={policyError}/>}</Panel></>;
}
export async function adminSection(section: string, query: Query) {
  try {
    switch (section) {
      case "overview": return await Overview();
      case "products": return <Products query={query}/>;
      case "editor": return await ProductEditor({query});
      case "categories": return await Categories({query});
      case "inventory": return await Inventory({query});
      case "orders": return await Orders({query});
      case "customers": return <Customers query={query}/>;
      case "payments": return await Payments({query});
      case "settings": return await Settings({query});
    }
  } catch (error) { return <ServiceIssue error={error}/>; }
}
