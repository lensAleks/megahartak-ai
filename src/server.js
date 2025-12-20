// // src/server.js
// import express from "express";
// import cors from "cors";
// import { config } from "./config.js";
// import { askAssistant } from "./assistants.js";
// import { fetchGoodsPage } from "./ucozApi.js"; // 👉 новый импорт
// import fetch from "node-fetch";


// const app = express();

// app.use(
//   cors({
//     origin: "*",
//   })
// );

// app.use(express.json());

// app.get("/", (req, res) => {
//   res.json({ status: "ok", service: "megahartak-ai-backend" });
// });

// // 👉 ТЕСТОВЫЙ роут для проверки связи с uCoz uAPI
// // app.get("/api/test-goods", async (req, res) => {
// //   try {
// //     const page = req.query.page || "allgoods";
// //     const pnum = Number(req.query.pnum || 1);
// //     const rows = Number(req.query.rows || 10);

// //     const data = await fetchGoodsPage({ page, pnum, rows });
// //     res.json(data);
// //   } catch (err) {
// //     console.error("uAPI error:", err);
// //     res.status(500).json({ error: err.message });
// //   }
// // });


// // 👉 Прокси к твоему uCoz PHP (ping.php), чтобы фронт/ассистент получали чистый JSON
// app.get("/api/ucoz/allgoods", async (req, res) => {
//   try {
//     const rows = Number(req.query.rows || 5);
//     const pnum = Number(req.query.pnum || 1);

//     const phpUrl = `https://megahartak.am/php/goods-api.php?rows=${rows}&pnum=${pnum}`;

//     const r = await fetch(phpUrl);
//     const text = await r.text();

//     // ВАЖНО: не JSON.parse
//     res.json({
//       source: "ucoz-php",
//       raw: text,
//     });
//   } catch (err) {
//     console.error("PHP proxy error:", err);
//     res.status(500).json({ error: "PHP proxy error", message: err.message });
//   }
// });

// // server.js
// app.get("/api/search", async (req, res) => {
//   try {
//     const q = String(req.query.q || "").toLowerCase();
//     const limit = Number(req.query.limit || 5);

//     if (!q) {
//       return res.status(400).json({ error: "q is required" });
//     }

//     // 1. Берём товары
//     const r = await fetch("https://megahartak.am/php/goods-api.php?rows=200&pnum=1");
//     const data = await r.json();

//    // const list = data?.success?.goods_list || [];
//     const rawList = data?.success?.goods_list || {};
//     const list = Array.isArray(rawList) ? rawList : Object.values(rawList);
    
//     // 2. Фильтруем
//     const results = list.filter(item => {
//       const title = (item.entry_title || "").toLowerCase();
//       const brief = (item.entry_brief || "").toLowerCase();
//       const brand = (item.entry_brand || "").toLowerCase();

//       return (
//         title.includes(q) ||
//         brief.includes(q) ||
//         brand.includes(q)
//       );
//     }).slice(0, limit);

//     res.json({
//       query: q,
//       count: results.length,
//       items: results.map(i => ({
//         title: i.entry_title,
//         price: i.entry_price?.price,
//         url: i.entry_shop_url,
//         image: i.entry_photo?.photo
//       }))
//     });

//   } catch (e) {
//     res.status(500).json({ error: e.message });
//   }
// });



// // Твой AI-ассистент (как было)
// app.post("/assistant", async (req, res) => {
//   try {
//     const { query } = req.body;

//     if (!query || typeof query !== "string") {
//       return res
//         .status(400)
//         .json({ error: "Field 'query' is required and must be a string." });
//     }

//     console.log("👤 USER:", query);

//     const reply = await askAssistant(query);

//     console.log("🤖 BOT:", reply);

//     res.json({ reply });
//   } catch (err) {
//     console.error("Assistant error:", err);
//     res.status(500).json({ error: "AI server error" });
//   }
// });

// app.listen(config.port, () => {
//   console.log(
//     `🚀 Megahartak AI backend listening on port ${config.port}`
//   );
// });


// src/server.js
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { askAssistant } from "./assistants.js";
import { fetchGoodsPage } from "./ucozApi.js"; // 👉 новый импорт
import fetch from "node-fetch";


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

// 👉 ТЕСТОВЫЙ роут для проверки связи с uCoz uAPI
// app.get("/api/test-goods", async (req, res) => {
//   try {
//     const page = req.query.page || "allgoods";
//     const pnum = Number(req.query.pnum || 1);
//     const rows = Number(req.query.rows || 10);

//     const data = await fetchGoodsPage({ page, pnum, rows });
//     res.json(data);
//   } catch (err) {
//     console.error("uAPI error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });


// 👉 Прокси к твоему uCoz PHP (ping.php), чтобы фронт/ассистент получали чистый JSON
app.get("/api/ucoz/allgoods", async (req, res) => {
  try {
    const rows = Number(req.query.rows || 5);
    const pnum = Number(req.query.pnum || 1);

    const phpUrl = `https://megahartak.am/php/goods-api.php?rows=${rows}&pnum=${pnum}`;

    const r = await fetch(phpUrl);
    const text = await r.text();

    // ВАЖНО: не JSON.parse
    res.json({
      source: "ucoz-php",
      raw: text,
    });
  } catch (err) {
    console.error("PHP proxy error:", err);
    res.status(500).json({ error: "PHP proxy error", message: err.message });
  }
});

// server.js
app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").toLowerCase();
    const limit = Number(req.query.limit || 5);

    if (!q) {
      return res.status(400).json({ error: "q is required" });
    }

    // 1. Берём товары
    const r = await fetch("https://megahartak.am/php/goods-api.php?rows=200&pnum=1");
    const data = await r.json();

   // const list = data?.success?.goods_list || [];
    const rawList = data?.success?.goods_list || {};
    const list = Array.isArray(rawList) ? rawList : Object.values(rawList);
    
    // 2. Фильтруем
    const results = list.filter(item => {
      const title = (item.entry_title || "").toLowerCase();
      const brief = (item.entry_brief || "").toLowerCase();
      const brand = (item.entry_brand || "").toLowerCase();

      return (
        title.includes(q) ||
        brief.includes(q) ||
        brand.includes(q)
      );
    }).slice(0, limit);

    res.json({
      query: q,
      count: results.length,
      items: results.map(i => ({
        title: i.entry_title,
        price: i.entry_price?.price,
        url: i.entry_shop_url,
        image: i.entry_photo?.photo
      }))
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



// Твой AI-ассистент (как было)
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
  console.log(
    `🚀 Megahartak AI backend listening on port ${config.port}`
  );
});
