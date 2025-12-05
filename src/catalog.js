import { catalog } from "./catalog-data.js";

/**
 * Улучшенный поиск по каталогу BBay/Megahartak
 */
export function searchCatalog(query) {
  if (!catalog.length) return [];

  const q = query.toLowerCase().trim();

  let results = catalog.filter((item) => {
    const title = item.title?.toLowerCase() || "";
    const brand = item.brand?.toLowerCase() || "";
    const category = item.category?.toLowerCase() || "";
    const keywords = item.keywords?.map(k => k.toLowerCase()) || [];

    return (
      title.includes(q) ||
      brand.includes(q) ||
      category.includes(q) ||
      keywords.some(k => k.includes(q))
    );
  });

  // Возвращаем красиво отформатированные поля
  return results.slice(0, 20).map(item => ({
    title: item.title,
    brand: item.brand,
    category: item.category,
    price: item.price,
    url: item.url
  }));
}
