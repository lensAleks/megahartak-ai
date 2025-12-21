// src/assistants.js
import OpenAI from "openai";
import { config } from "./config.js";
import { searchCatalog } from "./catalog.js"; // ✅ поиск по catalog.json

const client = new OpenAI({ apiKey: config.apiKey });

export async function askAssistant(userQuery) {
  try {
    // 1. создаём тред
    const thread = await client.beta.threads.create({
      messages: [{ role: "user", content: userQuery }],
    });

    // 2. запускаем ран
    let run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: config.assistantId,
    });

    // 3. обработка инструментов
    if (run.status === "requires_action" && run.required_action?.submit_tool_outputs) {
      const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
      const toolOutputs = [];

      for (const call of toolCalls) {
        const fname = call.function.name;
        console.log("🛠 TOOL CALL NAME:", fname, call.function.arguments);

        if (fname === "search_catalog") {
          const args = JSON.parse(call.function.arguments || "{}");
          const query = args.query || userQuery;
          const limit = args.limit ?? 5;

          console.log("🔎 search_catalog → query:", query, "limit:", limit);

          // ✅ ТУТ ИСПОЛЬЗУЕМ ТОЛЬКО НОВЫЙ КАТАЛОГ
          const rawResults = await searchCatalog(query, limit);

          const results = rawResults.map((it) => ({
            title: it.entry_title || "",
            price: it.entry_price?.price ?? "",
            url: it.entry_shop_url || "",
            image: it.entry_photo?.photo || "",
          }));

          console.log("✅ search_catalog results:", results.length);

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
      console.error("❌ Run final status:", run.status);
      throw new Error("Assistant run did not complete. Final status: " + run.status);
    }

    const messages = await client.beta.threads.messages.list(thread.id, { limit: 10 });
    const assistantMessage = messages.data.find((m) => m.role === "assistant");
    const text = (assistantMessage?.content?.[0]?.text?.value || "").trim();

    console.log("🤖 BOT:", text);

    return text;
  } catch (err) {
    console.error("Assistant error:", err);
    throw err;
  }
}
