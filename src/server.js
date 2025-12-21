import { searchCatalog } from "./catalog.js";

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "");
    const limit = Number(req.query.limit || 5);

    if (!q) {
      return res.status(400).json({ error: "q is required" });
    }

    const results = await searchCatalog(q, limit);

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

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message });
  }
});
