import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.WOODZY_TEST_URL ?? "http://localhost:3000";
const live = Boolean(process.env.WOODZY_TEST_STAFF_PHONE && process.env.WOODZY_TEST_STAFF_PASSWORD);
const product = live ? "/products/qa-sofa" : "/products/arta-sofa";
const paths = [
  "/", "/products", product, "/categories", "/categories/living", "/search?q=مبل", "/favorites", "/about",
  "/account/auth", "/account/recovery", "/account/dashboard", "/account/profile", "/account/orders", "/account/activity",
  "/checkout/cart", "/checkout/details", "/checkout/payment", "/checkout/result",
  "/admin/overview", "/admin/products", "/admin/editor", "/admin/categories", "/admin/inventory", "/admin/orders", "/admin/customers", "/admin/payments", "/admin/settings",
];
let browser;
let staffState;

before(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  if (live) {
    const page = await browser.newPage();
    await login(page);
    staffState = await page.context().storageState();
    await page.close();
  }
});
after(async () => browser?.close());

async function login(page, { phone, password } = { phone: process.env.WOODZY_TEST_STAFF_PHONE, password: process.env.WOODZY_TEST_STAFF_PASSWORD }) {
  await page.goto(base + "/account/auth");
  const panel = page.getByRole("heading", { name: "ورود", exact: true }).locator("..");
  await panel.getByLabel("شماره موبایل").fill(phone);
  await panel.getByLabel("گذرواژه").fill(password);
  await panel.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL("**/account/dashboard");
  await page.getByText("خوش آمدید", { exact: false }).waitFor();
}

for (const route of paths) {
  test("RTL, route and responsive geometry " + route, async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, storageState: staffState });
    const failures = [];
    page.on("pageerror", error => failures.push(error.message));
    try {
      const response = await page.goto(base + route);
      assert.equal(response?.status(), 200);
      assert.equal(await page.locator("html").getAttribute("lang"), "fa");
      assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
      await page.locator("main h1").waitFor();
      assert.equal(await page.locator("main h1").count(), 1);
      assert.ok(!(await page.locator("main").textContent()).includes("دریافت اطلاعات ممکن نبود"));
      for (const [width, height] of [[1440, 900], [1280, 900], [1024, 768], [768, 1024], [390, 844], [375, 812], [320, 812]]) {
        await page.setViewportSize({ width, height });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Horizontal overflow at " + width);
        assert.ok(await page.locator("main h1").isVisible());
        assert.equal(await page.locator(".mobile-nav").isVisible(), width <= 760);
        assert.equal(await page.locator(".nav-inner").isVisible(), width > 760);
      }
      assert.deepEqual(failures, []);
    } finally { await page.close(); }
  });
}

test("RTL category filters and autocomplete", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(base + "/categories");
    await page.getByLabel("جست‌وجوی دسته‌بندی").fill("دسته‌ای که پیدا نمی‌شود");
    await page.getByText("دسته‌بندی مطابق جست‌وجو پیدا نشد.").waitFor();
    await page.getByLabel("جست‌وجوی محصولات", { exact: true }).fill("مبل");
    await page.getByRole("list", { name: "پیشنهادهای جست‌وجو" }).waitFor();
    await page.getByLabel("جست‌وجوی محصولات", { exact: true }).press("Enter");
    await page.waitForURL("**/search?*");
    await page.getByRole("heading", { name: "نتایج جست‌وجو" }).waitFor();
  } finally { await page.close(); }
});

test("favorite is added then removed", async () => {
  const page = await browser.newPage({ storageState: staffState });
  try {
    await page.goto(base + product);
    const detail = page.locator(".product-detail");
    const toggle = detail.getByRole("button", { name: /علاقه‌مندی‌ها/ });
    await toggle.waitFor();
    if (await toggle.getAttribute("aria-pressed") === "true") {
      await toggle.click();
    }
    await detail.getByRole("button", { name: "افزودن به علاقه‌مندی‌ها" }).click();
    await page.waitForLoadState("networkidle");
    if (live) {
      await page.goto(base + "/account/dashboard");
      const saved = page.getByRole("heading", { name: "علاقه‌مندی‌های اخیر" }).locator("..");
      await saved.getByRole("link", { name: "مشاهده محصول" }).waitFor();
      await page.goto(base + "/search?q=" + encodeURIComponent("مبل"));
      await page.getByRole("heading", { name: "نتایج جست‌وجو" }).waitFor();
      await page.goto(base + "/search");
      const recent = page.getByRole("heading", { name: "جست‌وجوهای اخیر شما" }).locator("xpath=ancestor::section[1]");
      await recent.getByRole("link", { name: "مبل", exact: true }).waitFor();
    }
    await page.goto(base + "/favorites");
    await page.getByRole("button", { name: "حذف از علاقه‌مندی‌ها" }).click();
    await page.getByText("هنوز محصولی به علاقه‌مندی‌ها اضافه نشده است.").waitFor();
  } finally { await page.close(); }
});

test("isolated Django checkout and verified mock payment", { skip: !live }, async () => {
  const page = await browser.newPage({ storageState: staffState });
  try {
    await page.goto(base + product);
    await page.getByRole("button", { name: "افزودن به سبد خرید" }).click();
    await page.getByRole("status").filter({ hasText: "محصول در سبد خرید ثبت شد" }).waitFor();
    await page.goto(base + "/checkout/cart");
    await page.getByLabel("تعداد", { exact: true }).fill("2");
    await page.getByRole("button", { name: "به‌روزرسانی" }).click();
    await page.getByRole("status").filter({ hasText: "تغییرات ثبت شد" }).waitFor();
    await page.getByRole("link", { name: "ادامه خرید" }).click();
    await page.getByRole("button", { name: "ثبت سفارش", exact: true }).click();
    await page.waitForURL("**/checkout/payment?order=*");
    await page.getByRole("button", { name: "شروع پرداخت آزمایشی" }).click();
    await page.waitForURL("**/checkout/result?id=*");
    await page.getByRole("button", { name: "ارسال سناریوی آزمایشی" }).click();
    await page.getByRole("cell", { name: "موفق", exact: true }).waitFor();
    await page.goto(base + "/account/orders");
    await page.getByRole("cell", { name: "پرداخت‌شده" }).first().waitFor();
    await page.goto(base + "/admin/orders");
    await page.getByRole("link", { name: "جزئیات", exact: true }).first().click();
    await page.getByRole("button", { name: "شروع آماده‌سازی" }).click();
    await page.getByRole("cell", { name: "در حال آماده‌سازی", exact: true }).waitFor();
    await page.getByRole("button", { name: "تکمیل سفارش" }).click();
    await page.getByRole("cell", { name: "تکمیل‌شده", exact: true }).waitFor();
  } finally { await page.close(); }
});

test("Django profile edit and inventory ledger adjustment", { skip: !live }, async () => {
  const page = await browser.newPage({ storageState: staffState });
  try {
    await page.goto(base + "/account/profile");
    await page.getByLabel("نام", { exact: true }).fill("آزمایش فروشگاه");
    await page.getByRole("button", { name: "ذخیره مشخصات" }).click();
    await page.getByRole("status").filter({ hasText: "تغییرات ثبت شد" }).waitFor();
    await page.goto(base + "/admin/inventory");
    await page.getByRole("link", { name: "انتخاب کالا" }).first().click();
    await page.getByLabel("تغییر تعداد (مثبت یا منفی)").fill("3");
    await page.getByRole("button", { name: "ثبت تغییر موجودی" }).click();
    await page.getByRole("status").filter({ hasText: "تغییرات ثبت شد" }).waitFor();
    await page.getByRole("heading", { name: "دفتر تغییرات موجودی" }).waitFor();
  } finally { await page.close(); }
});

test("Django prevents customer access to admin catalog", { skip: !live || !process.env.WOODZY_TEST_CUSTOMER_PHONE }, async () => {
  const page = await browser.newPage();
  try {
    await login(page, { phone: process.env.WOODZY_TEST_CUSTOMER_PHONE, password: process.env.WOODZY_TEST_CUSTOMER_PASSWORD });
    await page.goto(base + "/admin/products");
    await page.getByText("حساب شما مجوز مشاهدهٔ این بخش را ندارد.").waitFor();
    assert.equal(await page.getByRole("table").count(), 0);
  } finally { await page.close(); }
});

test("Django admin category, product and SEO creation", { skip: !live }, async () => {
  const page = await browser.newPage({ storageState: staffState });
  const key = Date.now().toString(36);
  try {
    await page.goto(base + "/admin/categories");
    const category = page.locator("form").filter({ has: page.getByRole("button", { name: "ثبت دسته", exact: true }) });
    await category.getByLabel("نام", { exact: true }).fill("دسته آزمایشی " + key);
    await category.getByLabel("نشانی", { exact: true }).fill("qa-category-" + key);
    await category.getByRole("button", { name: "ثبت دسته", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "تغییرات ثبت شد" }).waitFor();
    await page.getByRole("cell", { name: "دسته آزمایشی " + key, exact: true }).waitFor();

    await page.goto(base + "/admin/editor");
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "ذخیره محصول", exact: true }) });
    await form.getByLabel("عنوان", { exact: true }).fill("محصول آزمایشی " + key);
    await form.getByLabel("نشانی محصول").fill("qa-product-" + key);
    await form.getByLabel("شناسه کالا").fill("QA-" + key);
    await form.getByLabel("توضیح کوتاه").fill("این محصول برای آزمایش رابط ایجاد شده است.");
    await form.getByLabel("توضیحات", { exact: true }).fill("شرح آزمایشی محصول.");
    await form.getByLabel("قیمت", { exact: true }).fill("12000000");
    await form.getByLabel("دسته", { exact: true }).selectOption({ label: "دسته آزمایشی " + key });
    await form.getByRole("button", { name: "ذخیره محصول" }).click();
    await page.waitForURL("**/admin/editor?id=*");
    await page.getByLabel("عنوان متا").fill("صفحه آزمایشی سئو");
    await page.getByRole("button", { name: "ذخیره سئو" }).click();
    await page.getByRole("status").filter({ hasText: "تغییرات ثبت شد" }).waitFor();
    await page.goto(base + "/products/qa-product-" + key);
    await page.waitForFunction(() => document.title.includes("صفحه آزمایشی سئو"));
  } finally { await page.close(); }
});

test("Django registration, address CRUD and review moderation", { skip: !live }, async () => {
  const customer = await browser.newPage();
  const admin = await browser.newPage({ storageState: staffState });
  const phone = "091" + String(Date.now()).slice(-8);
  const password = "Local-QA-Registration-529!";
  const reviewTitle = "دیدگاه آزمایشی " + Date.now().toString(36);
  try {
    await customer.goto(base + "/account/auth");
    const register = customer.getByRole("heading", { name: "ثبت‌نام", exact: true }).locator("..");
    await register.getByLabel("شماره موبایل").fill(phone);
    await register.getByLabel("گذرواژه").fill(password);
    await register.getByRole("button", { name: "ساخت حساب" }).click();
    await customer.getByRole("status").filter({ hasText: "حساب ساخته شد" }).waitFor();
    await login(customer, { phone, password });

    await customer.goto(base + "/account/profile");
    const address = customer.locator("form").filter({ has: customer.getByRole("button", { name: "ثبت آدرس", exact: true }) });
    for (const [name, value] of [["عنوان آدرس", "آدرس آزمایش"], ["گیرنده", "گیرنده آزمایش"], ["شماره گیرنده", phone], ["استان", "تهران"], ["شهر", "تهران"], ["کد پستی", "1234567890"], ["نشانی", "خیابان آزمایش"]]) {
      await address.getByLabel(name, { exact: true }).fill(value);
    }
    await address.getByRole("button", { name: "ثبت آدرس" }).click();
    await customer.getByText("آدرس آزمایش · خیابان آزمایش").click();
    const edit = customer.locator("details").filter({ hasText: "آدرس آزمایش · خیابان آزمایش" });
    await edit.getByLabel("نشانی", { exact: true }).fill("کوچه آزمایش");
    await edit.getByRole("button", { name: "ذخیره آدرس" }).click();
    await customer.getByText("آدرس آزمایش · کوچه آزمایش").click();
    await customer.getByRole("button", { name: "حذف آدرس", exact: true }).click();
    await customer.getByText("آدرس آزمایش · کوچه آزمایش").waitFor({ state: "detached" });

    await customer.goto(base + product + "?tab=reviews");
    await customer.getByRole("link", { name: "ثبت دیدگاه", exact: true }).click();
    await customer.getByLabel("عنوان", { exact: true }).fill(reviewTitle);
    await customer.getByLabel("دیدگاه", { exact: true }).fill("ثبت دیدگاه از طریق رابط برای آزمون تأیید مدیر.");
    await customer.getByRole("button", { name: "ثبت دیدگاه", exact: true }).click();
    await customer.getByRole("cell", { name: reviewTitle }).waitFor();

    await admin.goto(base + "/admin/settings");
    const review = admin.getByRole("row").filter({ hasText: reviewTitle });
    await review.getByText("بررسی دیدگاه").click();
    await review.getByRole("button", { name: "تأیید دیدگاه", exact: true }).click();
    await admin.getByRole("status").filter({ hasText: "تغییرات ثبت شد" }).waitFor();
    await customer.goto(base + product + "?tab=reviews");
    await customer.getByText(reviewTitle, { exact: true }).waitFor();
  } finally { await customer.close(); await admin.close(); }
});

test("Django contact form stores a message", { skip: !live }, async () => {
  const page = await browser.newPage();
  try {
    await page.goto(base + "/about#contact");
    const form = page.locator("#contact form");
    await form.getByLabel("نام", { exact: true }).fill("آزمون تماس");
    await form.getByLabel("ایمیل").fill("test@example.org");
    await form.getByLabel("پیام", { exact: true }).fill("این پیام برای آزمایش ثبت فرم در محیط ایزوله است.");
    await form.getByRole("button", { name: "ارسال پیام" }).click();
    await page.getByRole("status").filter({ hasText: "در صندوق پیام فروشگاه ثبت شد" }).waitFor();
  } finally { await page.close(); }
});

test("Django rotates the browser session and logout revokes its refresh token", { skip: !live }, async () => {
  const page = await browser.newPage();
  try {
    await login(page);
    const before = (await page.context().cookies()).find(cookie => cookie.name === "woodzy-refresh");
    assert.ok(before?.httpOnly);
    await page.goto(base + "/account/auth");
    await page.getByRole("button", { name: "تمدید نشست" }).click();
    await page.waitForURL("**/account/dashboard");
    const after = (await page.context().cookies()).find(cookie => cookie.name === "woodzy-refresh");
    assert.ok(after?.httpOnly && after.value !== before.value);
    await page.getByRole("button", { name: "خروج از حساب" }).click();
    await page.waitForURL("**/account/auth");
    assert.ok(!(await page.context().cookies()).some(cookie => cookie.name === "woodzy-refresh"));
    await page.goto(base + "/account/dashboard");
    await page.getByRole("link", { name: "وارد شوید" }).waitFor();
  } finally { await page.close(); }
});

test("SEO metadata is server-rendered from Django with public discovery files", { skip: !live }, async () => {
  const page = await browser.newPage();
  try {
    const response = await page.request.get(base + product);
    assert.equal(response.status(), 200);
    const html = await response.text();
    const head = html.split("</head>")[0];
    assert.match(head, /<title>[^<]+<\/title>/);
    assert.match(head, /<meta name="description" content="[^"]+"/);
    assert.match(head, /<link rel="canonical" href="[^"]+\/products\/qa-sofa"/);
    assert.match(head, /name="twitter:card"/);
    await page.goto(base + product);
    const records = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(JSON.parse);
    assert.ok(records.some(value => value["@type"] === "Product" && value.offers.price && value.offers.priceCurrency));
    assert.ok(records.some(value => value["@type"] === "BreadcrumbList" && value.itemListElement.length >= 3));

    await page.goto(base + "/categories/living?in_stock=true");
    assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /noindex/);
    const sitemap = await page.request.get(base + "/sitemap.xml");
    assert.equal(sitemap.status(), 200);
    const xml = await sitemap.text();
    assert.match(xml, /<loc>[^<]*\/products\/qa-sofa<\/loc>/);
    assert.match(xml, /<loc>[^<]*\/categories\/living<\/loc>/);
    assert.doesNotMatch(xml, /\/checkout/);
    const robots = await page.request.get(base + "/robots.txt");
    assert.equal(robots.status(), 200);
    assert.match(await robots.text(), /Disallow: \/checkout/);
  } finally { await page.close(); }
});
