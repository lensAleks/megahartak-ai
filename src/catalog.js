// src/catalog.js
import fetchModule from "node-fetch";
import XLSX from "xlsx";

const fetch = fetchModule.default || fetchModule;

// URL до price.xlsx из GitHub Releases
const CATALOG_URL = process.env.CATALOG_URL;

let catalogData = null;
let loadingPromise = null;

// Один раз загружаем и парсим XLSX
async function loadCatalogOnce() {
  if (catalogData) return catalogData;
  if (loadingPromise) return loadingPromise;

  if (!CATALOG_URL) {
    throw new Error("CATALOG_URL env var is not set");
  }

  loadingPromise = (async () => {
    console.log("📥 Загрузка price.xlsx из:", CATALOG_URL);

    const res = await fetch(CATALOG_URL);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Failed to download price.xlsx: ${res.status} ${res.statusText}. Body: ${text.slice(
          0,
          200
        )}`
      );
    }

    // Берём бинарные данные, а не text()
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    console.log("📦 XLSX получен, размер:", buffer.length, "bytes");

    // Парсим XLSX
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Превращаем в массив объектов (одна строка = один товар)
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    console.log("📑 Строк в XLSX:", rows.length);

    // ВАЖНО: здесь нужно подставить ПРАВИЛЬНЫЕ названия колонок из твоего файла.
    // Открой price.xlsx и посмотри заголовки колонок в первой строке.
    catalogData = rows.map((row) => ({
      // Название товара
      entry_title:
        row["Product name"] ||
        row["Name"] ||
        row["Нименование"] ||
        "",

      // Бренд
      entry_brand:
        row["Brand"] ||
        row["Бренд"] ||
        "",

      // Краткое описание
      entry_brief:
        row["Short description"] ||
        row["Description"] ||
        row["Описание"] ||
        "",

      // Цена
      entry_price: {
        price:
          row["Price"] ||
          row["Retail price"] ||
          row["Цена"] ||
          "",
      },

      // URL товара на megahartak/am (если есть в выгрузке)
      entry_shop_url:
        row["URL"] ||
        row["Product URL"] ||
        row["Link"] ||
        "",

      // Картинка
      entry_photo: {
        photo:
          row["Image URL"] ||
          row["Main image"] ||
          row["Picture"] ||
          "",
      },
    }));

    console.log("✅ Каталог сформирован, товаров:", catalogData.length);

    return catalogData;
  })();

  return loadingPromise;
}

/**
 * Поиск по локальному каталогу
 * @param {string} query - строка поиска, например "adidas"
 * @param {number} limit - максимум результатов
 */
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
