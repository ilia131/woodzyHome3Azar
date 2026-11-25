import type { Row } from "@/lib/private-api";
export type Field = { name: string; label: string; type?: "number" | "email" | "tel" | "password" | "textarea" | "checkbox" | "file" | "select" | "hidden"; required?: boolean; options?: [string, string][]; min?: number; value?: string | number | boolean };
type Operation = { method: "POST" | "PATCH" | "DELETE"; path: (id: string) => string; fields: string[]; integers?: string[]; booleans?: string[]; nullables?: string[]; uuid?: string; multipart?: boolean; result?: (row: Row) => string };

const address = ["label", "recipient_name", "recipient_phone", "province", "city", "address_line", "postal_code", "is_default"];
const product = ["title", "slug", "short_description", "description", "price", "discount_price", "sku", "category", "is_active", "is_featured", "main_image"];
const category = ["name", "slug", "description", "parent", "is_active", "image"];
const seoRobots = ["robots_index", "robots_follow"];
const seo = ["meta_title", "meta_description", "meta_keywords", "focus_keyword", "secondary_keywords",
  "canonical_url", "og_title", "og_description", "og_image", ...seoRobots];
const afterOrder = (row: Row) => "/checkout/payment?order=" + Number(row.id);
const afterPayment = (row: Row) => "/checkout/result?id=" + Number(row.id);
export const operations = {
  profile: { method: "PATCH", path: () => "auth/me/", fields: ["first_name", "last_name", "email"] },
  password: { method: "POST", path: () => "auth/password/change/", fields: ["old_password", "password"] },
  addAddress: { method: "POST", path: () => "addresses/", fields: address, booleans: ["is_default"] },
  editAddress: { method: "PATCH", path: id => "addresses/" + id + "/", fields: address, booleans: ["is_default"] },
  removeAddress: { method: "DELETE", path: id => "addresses/" + id + "/", fields: [] },
  changeCart: { method: "PATCH", path: id => "cart/items/" + id + "/", fields: ["quantity"], integers: ["quantity"] },
  removeCart: { method: "DELETE", path: id => "cart/items/" + id + "/", fields: [] },
  order: { method: "POST", path: () => "orders/", fields: ["address_id"], integers: ["address_id"], result: afterOrder },
  staffOrderStatus: { method: "PATCH", path: id => "admin/orders/" + id + "/status/", fields: ["expected_status", "status"] },
  cancelOrder: { method: "POST", path: id => "orders/" + id + "/cancel/", fields: [] },
  payment: { method: "POST", path: () => "payments/initiate/", fields: ["order_id", "provider", "idempotency_key"], integers: ["order_id"], result: afterPayment },
  simulate: { method: "POST", path: id => "payments/mock/" + id + "/simulate/", fields: ["scenario"], result: afterPayment },
  addReview: { method: "POST", path: id => "products/" + id + "/reviews/", fields: ["title", "comment", "rating"], integers: ["rating"] },
  editReview: { method: "PATCH", path: id => "reviews/" + id + "/", fields: ["title", "comment", "rating"], integers: ["rating"] },
  removeReview: { method: "DELETE", path: id => "reviews/" + id + "/", fields: [] },
  addProduct: { method: "POST", path: () => "admin/products/", fields: [...product, "stock"], integers: ["category", "stock"], booleans: ["is_active", "is_featured"], multipart: true, result: row => "/admin/editor?id=" + Number(row.id) },
  editProduct: { method: "PATCH", path: id => "admin/products/" + id + "/", fields: product.filter(f => f !== "slug"), integers: ["category"], booleans: ["is_active", "is_featured"], multipart: true },
  addSeo: { method: "POST", path: () => "admin/seo/", fields: ["product", ...seo, "main_image_alt_text"], booleans: seoRobots, multipart: true },
  editSeo: { method: "PATCH", path: id => "admin/seo/" + id + "/", fields: [...seo, "main_image_alt_text"], booleans: seoRobots, multipart: true },
  regenerateSeo: { method: "POST", path: id => "admin/seo/" + id + "/regenerate/", fields: [] },
  addCategorySeo: { method: "POST", path: () => "admin/category-seo/", fields: ["category", ...seo], booleans: seoRobots, multipart: true },
  editCategorySeo: { method: "PATCH", path: id => "admin/category-seo/" + id + "/", fields: seo, booleans: seoRobots, multipart: true },
  regenerateCategorySeo: { method: "POST", path: id => "admin/category-seo/" + id + "/regenerate/", fields: [] },
  addImage: { method: "POST", path: () => "admin/product-images/", fields: ["product", "image", "alt_text", "position"], integers: ["product", "position"], multipart: true },
  editImage: { method: "PATCH", path: id => "admin/product-images/" + id + "/", fields: ["alt_text", "position"], integers: ["position"] },
  removeImage: { method: "DELETE", path: id => "admin/product-images/" + id + "/", fields: [] },
  addCategory: { method: "POST", path: () => "admin/categories/", fields: category, integers: ["parent"], booleans: ["is_active"], multipart: true },
  editCategory: { method: "PATCH", path: id => "admin/categories/" + id + "/", fields: category, integers: ["parent"], booleans: ["is_active"], multipart: true },
  stock: { method: "POST", path: id => "admin/inventory/products/" + id + "/adjust/", fields: ["delta", "operation_id"], integers: ["delta"] },
  customer: { method: "PATCH", path: id => "admin/users/" + id + "/", fields: ["is_active"], booleans: ["is_active"] },
  rankingWeights: { method: "PATCH", path: id => "admin/ranking-weights/" + id + "/", fields: ["views", "favorites", "discount", "affordability", "freshness", "featured"] },
  recommendation: { method: "PATCH", path: () => "admin/recommendation-settings/", fields: ["favorite_weight", "view_weight", "category_weight", "title_weight", "description_weight", "history_days", "min_viewed_products", "seed_limit"] },
  review: { method: "PATCH", path: id => "admin/reviews/" + id + "/", fields: ["is_approved"], booleans: ["is_approved"] },
  reply: { method: "POST", path: id => "admin/reviews/" + id + "/replies/", fields: ["comment"] },
} satisfies Record<string, Operation>;
export type OperationKey = keyof typeof operations;
