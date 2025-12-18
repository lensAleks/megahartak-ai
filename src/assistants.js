import OpenAI from "openai";
import { config } from "./config.js";
// ❌ больше не нужен локальный каталог
// import { searchCatalog } from "./catalog.js";
import { fetchGoodsPage } from "./ucozApi.js";

const client = new OpenAI({ apiKey: config.apiKey });

// простая “поисковая” функция: берём 2-3 страницы и фильтруем по названию/описанию
async function searchUcozCatalog(query, { rows = 20, pagesToScan = 3, limit = 5 } = {}) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];

  const results = [];
  for (let pnum = 1; pnum <= pagesToScan; pnum++) {
    const data = await fetchGoodsPage({ page: "allgoods", pnum, rows });

    // подстройка под твою структуру: goods_list — объект, превращаем в массив
    const listObj = data?.success?.goods_list || {};
    const items = Object.values(listObj);

    for (const it of items) {
      const title = (it.entry_title || "").toLowerCase();
      const brief = (it.entry_brief || "").toLowerCase();
      const desc = (it.entry_description || "").toLowerCase();
      const brand = (it.entry_brand || "").toLowerCase();

      if (title.includes(q) || brief.includes(q) || desc.includes(q) || brand.includes(q)) {
        results.push({
          id: it.entry_id,
          title: it.entry_title,
          price: it.entry_price?.price_raw ?? it.entry_price?.price,
          url: it.entry_shop_url,
          image: it.entry_photo?.def_photo?.photo || it.entry_photo?.def_photo?.middl || null,
        });
        if (results.length >= limit) return results;
      }
    }
  }
  return results;
}

export async function askAssistant(userQuery) {
  const thread = await client.beta.threads.create({
    messages: [{ role: "user", content: userQuery }],
  });

  let run = await client.beta.threads.runs.createAndPoll(thread.id, {
    assistant_id: config.assistantId,
  });

  if (run.status === "requires_action" && run.required_action?.submit_tool_outputs) {
    const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
    const toolOutputs = [];

    for (const call of toolCalls) {
      if (call.function.name === "search_catalog") {
        const args = JSON.parse(call.function.arguments || "{}");
        const query = args.query || userQuery;

        // ✅ теперь ищем в реальном uCoz
        const results = await searchUcozCatalog(query, { limit: 5, rows: 20, pagesToScan: 3 });

        toolOutputs.push({
          tool_call_id: call.id,
          output: JSON.stringify(results),
        });
      }
    }

    run = await client.beta.threads.runs.submitToolOutputsAndPoll(thread.id, run.id, {
      tool_outputs: toolOutputs,
    });
  }

  if (run.status !== "completed") {
    throw new Error("Assistant run did not complete. Final status: " + run.status);
  }

  const messages = await client.beta.threads.messages.list(thread.id, { limit: 10 });
  const assistantMessage = messages.data.find((m) => m.role === "assistant");
  return (assistantMessage?.content?.[0]?.text?.value || "").trim();
}
