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
 * Простейший поиск по каталогу.
 * Позже можно улучшить: добавить фильтры по цене, возрасту, полу и т.д.
 */
export function searchCatalog(query) {
  if (!catalog.length) return [];

  const q = query.toLowerCase();

  let results = catalog.filter((item) => {
    return (
      item.title?.toLowerCase().includes(q) ||
      item.brand?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    );
  });

  return results.slice(0, 20);
}
