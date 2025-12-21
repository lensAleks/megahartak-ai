// src/catalog.js
import fetchModule from "node-fetch";

// node-fetch v2 в ESM
const fetch = fetchModule.default || fetchModule;

// URL до большого catalog.json из GitHub Releases
// Пример: https://github.com/lensAleks/megahartak-ai/releases/download/v1/catalog.json
const CATALOG_URL = process.env.CATALOG_URL;

let catalogData = null;      // кэш данных
let loadingPromise = null;   // чтобы параллельные запросы /api/search не качали файл много раз

async function loadCatalogOnce() {
  if (catalogData) return catalogData;
  if (loadingPromise) return loadingPromise;

  if (!CATALOG_URL) {
    throw new Error("CATALOG_URL env var is not set");
  }

  loadingPromise = (async () => {
    console.log("📥 Загрузка catalog.json из:", CATALOG_URL);

    const res = await fetch(CATALOG_URL);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Failed to download catalog.json: ${res.status} ${res.statusText}. Body: ${text.slice(
          0,
          200
        )}`
      );
    }

    const text = await res.text();
    console.log("📦 catalog.json получен, длина строки:", text.length);

    let raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      console.error("❌ Ошибка парсинга catalog.json:", e.message);
      throw new Error("Invalid JSON in catalog.json from CATALOG_URL");
    }

    // Поддержка разных форматов на всякий случай
    if (Array.isArray(raw)) {
      catalogData = raw;
    } else if (Array.isArray(raw.items)) {
      catalogData = raw.items;
    } else if (raw.success?.goods_list) {
      const gl = raw.success.goods_list;
      catalogData = Array.isArray(gl) ? gl : Object.values(gl);
    } else {
      console.warn(
        "⚠️ Неизвестный формат catalog.json, оборачиваю как массив из одного элемента"
      );
      catalogData = Array.isArray(raw) ? raw : [raw];
    }

    console.log("✅ catalog.json загружен, товаров:", catalogData.length);
    return catalogData;
  })();

  return loadingPromise;
}

/**
 * Поиск по локальному каталогу
 * @param {string} query - строка поиска (например "adidas" или "nike")
 * @param {number} limit - максимум найденных товаров
 */
export async function searchCatalog(query, limit = 5) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];

  const list = await loadCatalogOnce();

  const results = [];
  for (const item of list) {
    const title =
      (item.entry_title || item.title || item.name || "").toLowerCase();
    const brand =
      (item.entry_brand || item.brand || item.manufacturer || "").toLowerCase();
    const brief =
      (item.entry_brief || item.description || item.short_description || "").toLowerCase();

    if (title.includes(q) || brand.includes(q) || brief.includes(q)) {
      results.push(item);
      if (results.length >= limit) break;
    }
  }

  return results;
}
