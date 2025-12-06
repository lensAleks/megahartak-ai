// server.js
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { askAssistant } from "./assistants.js";
import { fetchGoodsPage } from "./ucozApi.js"; // 👈 добавили ES-импорт

const app = express();

app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "megahartak-ai-backend" });
});

// 🔹 Тестовый маршрут для проверки uAPI
app.get("/api/test-goods", async (req, res) => {
  try {
    const data = await fetchGoodsPage({ pageNum: 1, perPage: 10 });
    res.json(data);
  } catch (err) {
    console.error("uAPI error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Основной ассистент
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

    res.json({ reply });
  } catch (err) {
    console.error("Assistant error:", err);
    res.status(500).json({ error: "AI server error" });
  }
});

app.listen(config.port, () => {
  console.log(`🚀 Megahartak AI backend listening on port ${config.port}`);
});
