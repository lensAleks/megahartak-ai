import fs from "fs";
import XLSX from "xlsx";

const INPUT_FILE = "price.xlsx";
const OUTPUT_FILE = "catalog.json";

console.log("Читаю XLSX:", INPUT_FILE);

const workbook = XLSX.readFile(INPUT_FILE);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(rows, null, 2));

console.log(`Готово! Сохранено ${rows.length} товаров в ${OUTPUT_FILE}`);
