// src/catalog.js
import fetch from "node-fetch";

let catalog = null; // кеш в памяти

export async function loadCatalog() {
  if (catalog) return catalog; // уже загружено

  const url = process.env.CATALOG_URL;
  if (!url) {
    throw new Error("CATALOG_URL is not defined in environment variables");
  }

  console.log("📥 Загружаю catalog.json из Google Drive...");

  const response = await fetch(url);
  const json = await response.json();

  console.log("📦 Файл загружен. Количество товаров:", json.length);

  catalog = json;
  return json;
}

export async function searchCatalog(query, limit = 5) {
  const q = query.toLowerCase();

  const list = await loadCatalog();

  const results = list.filter(item => {
    const title = (item.entry_title || "").toLowerCase();
    const brief = (item.entry_brief || "").toLowerCase();
    const brand = (item.entry_brand || "").toLowerCase();

    return (
      title.includes(q) ||
      brief.includes(q) ||
      brand.includes(q)
    );
  });

  return results.slice(0, limit);
}
