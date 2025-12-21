import fs from "fs";

let catalog = [];

// Пробуем загрузить catalog.json из корня проекта
try {
  const raw = fs.readFileSync(new URL("../catalog.json", import.meta.url));
  catalog = JSON.parse(raw.toString("utf8"));
  console.log("✅ catalog.json loaded, items:", catalog.length);
} catch (e) {
  console.log("⚠ catalog.json not found or invalid. searchCatalog will return empty results.");
}

/**
 * Улучшенный поиск по каталогу.
 * Позже можно добавить фильтры по цене, возрасту, полу и т.д.
 */
export function searchCatalog(query) {
  if (!catalog.length) return [];

  const q = query.toLowerCase().trim();

  let results = catalog.filter((item) => {
    const title = item.title?.toLowerCase() || "";
    const brand = item.brand?.toLowerCase() || "";
    const category = item.category?.toLowerCase() || "";
    const keywords = (item.keywords || []).map(k => k.toLowerCase());

    return (
      title.includes(q) ||
      brand.includes(q) ||
      category.includes(q) ||
      keywords.some(k => k.includes(q))
    );
  });

  // Возвращаем максимум 20 записей и только нужные поля
  return results.slice(0, 20).map(item => ({
    title: item.title || "",
    brand: item.brand || "",
    category: item.category || "",
    price: item.price || "",
    url: item.url || "",
  }));
}
