// src/catalog.js
import fetchModule from "node-fetch";

const fetch = fetchModule.default || fetchModule;

const CATALOG_URL = process.env.CATALOG_URL;

let catalogRows = null;
let loadingPromise = null;
console.log("📦 Loading catalog from Google Drive...");

// Один раз загружаем и держим весь JSON в памяти
export async function loadCatalogOnce() {
  if (catalogRows) return catalogRows;
  if (loadingPromise) return loadingPromise;

  if (!CATALOG_URL) {
    throw new Error("CATALOG_URL env var is not set");
  }

  loadingPromise = (async () => {
    console.log("📬 Загрузка catalog.json из:", CATALOG_URL);

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

    const rows = await res.json();
    console.log("📑 Строк в JSON:", rows.length);

    catalogRows = rows;
    return catalogRows;
  })();

  return loadingPromise;
}

/**
 * Поиск по локальному каталогу
 * @param {string} query - строка поиска, например "iphone" или "adidas"
 * @param {number} limit - максимум результатов
 */
export async function searchCatalog(query, limit = 5) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];

  const rows = await loadCatalogOnce();
  const results = [];

  for (const row of rows) {
    // 1) Ищем по ВСЕМ полям строки
    const haystack = Object.values(row)
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(q)) continue;

    // 2) Красиво маппим в формат ассистента
    const entry_title =
      row["Интернет-магазин"] ||
      row["Product name"] ||
      row["Name"] ||
      row["Наименование"] ||
      "";

    const entry_price =
      row["__EMPTY"] ||
      row["Price"] ||
      row["Цена"] ||
      "";

    const entry_photo =
      row["__EMPTY_1"] ||
      row["Image URL"] ||
      row["Picture"] ||
      "";

    const entry_shop_url =
      row["__EMPTY_2"] ||
      row["URL"] ||
      row["Link"] ||
      "";

    results.push({
      entry_title,
      entry_brand: "", // бренда в этой выгрузке похоже нет
      entry_brief: "", // описания тоже нет, можно будет добавить позже
      entry_price: { price: entry_price },
      entry_shop_url,
      entry_photo: { photo: entry_photo },
    });

    if (results.length >= limit) break;
  }

  return results;
}
