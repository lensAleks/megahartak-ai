// src/server.js
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { askAssistant } from "./assistants.js";
import { searchCatalog } from "./catalog.js"; // ✅ поиск по JSON с Google Drive

const app = express();

app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json());

// Простой health-check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "megahartak-ai-backend" });
});

/**
 * 🔎 Поиск по каталогу (catalog.json с Google Drive)
 * GET /api/search?q=adidas&limit=5
 */
app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").toLowerCase();
    const limit = Number(req.query.limit || 5);

    if (!q) {
      return res.status(400).json({ error: "q is required" });
    }

    // 👉 searchCatalog сам внутри загрузит JSON с Google Drive (если ещё не загружен)
    const results = await searchCatalog(q, limit);

    res.json({
      query: q,
      count: results.length,
      items: results.map((i) => ({
        title: i.entry_title,
        price: i.entry_price?.price,
        url: i.entry_shop_url,
        image: i.entry_photo?.photo,
      })),
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🤖 Ассистент (как было)
 */
app.post("/assistant", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      return res
        .status(400)
        .json({ error: "Field 'query' is required and must be a string." });
    }

    console.log("👤 USER:", query);

    const reply = await askAssistant(query);

    console.log("🤖 BOT:", reply);

    res.json({ 
      reply,  
      items: Array.isArray(reply?.items) ? reply.items : [],
      category_url: typeof reply?.category_url === "string" ? reply.category_url : null,
      category_key: typeof reply?.category_key === "string" ? reply.category_key : null,
      });
    } catch (err) {
    
    console.error("Assistant error:", err);
    res.status(500).json({ error: "AI server error" });
  }
});

app.listen(config.port, () => {
  console.log(`🚀 Megahartak AI backend listening on port ${config.port}`);
});
