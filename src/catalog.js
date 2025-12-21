// src/catalog.js
import fetchModule from "node-fetch";

const fetch = fetchModule.default || fetchModule;

// URL до catalog.json из GitHub Releases
const CATALOG_URL = process.env.CATALOG_URL;

let catalogData = null;
let loadingPromise = null;

// Один раз загружаем и парсим JSON
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

    // Тут уже JSON, а не XLSX
    const rows = await res.json();

    console.log("📑 Строк в JSON:", rows.length);

    // rows — это как раз то, что ты сохранила из convert-xlsx.js
    catalogData = rows.map((row) => ({
      entry_title:
        row["Product name"] ||
        row["Name"] ||
        row["Нименование"] ||
        "",

      entry_brand:
        row["Brand"] ||
        row["Бренд"] ||
        "",

      entry_brief:
        row["Short description"] ||
        row["Description"] ||
        row["Описание"] ||
        "",

      entry_price: {
        price:
          row["Price"] ||
          row["Retail price"] ||
          row["Цена"] ||
          "",
      },

      entry_shop_url:
        row["URL"] ||
        row["Product URL"] ||
        row["Link"] ||
        "",

      entry_photo: {
        photo:
          row["Image URL"] ||
          row["Main image"] ||
          row["Picture"] ||
          "",
      },
    }));

    console.log("✅ Каталог сформирован из JSON, товаров:", catalogData.length);

    return catalogData;
  })();

  return loadingPromise;
}

export async function searchCatalog(query, limit = 5) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];

  const list = await loadCatalogOnce();

  const results = [];
  for (const item of list) {
    const title = (item.entry_title || "").toLowerCase();
    const brand = (item.entry_brand || "").toLowerCase();
    const brief = (item.entry_brief || "").toLowerCase();

    if (title.includes(q) || brand.includes(q) || brief.includes(q)) {
      results.push(item);
      if (results.length >= limit) break;
    }
  }

  return results;
}
