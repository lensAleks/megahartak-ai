// src/assistants.js
import OpenAI from "openai";
import { config } from "./config.js";
import { searchCatalog } from "./catalog.js";

const client = new OpenAI({ apiKey: config.apiKey });

function safeJsonParse(str, fallback = {}) {
  try {
    return JSON.parse(str || "{}");
  } catch (e) {
    console.warn("⚠️ Invalid JSON in tool arguments:", str);
    return fallback;
  }
}

export async function askAssistant(userQuery) {
  try {
    let collectedItems = [];

    // 1) create thread
    const thread = await client.beta.threads.create({
      messages: [{ role: "user", content: userQuery }],
    });

    // 2) run
    let run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: config.assistantId,
    });

    // 3) handle tools (may require multiple rounds)
    while (run.status === "requires_action" && run.required_action?.submit_tool_outputs) {
      const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
      const toolOutputs = [];

      for (const call of toolCalls) {
        const fname = call.function?.name;
        const args = safeJsonParse(call.function?.arguments, {});
        console.log("🛠 TOOL CALL:", fname, args);

        if (fname === "search_catalog") {
          const query = args.query || userQuery;
          const limit = args.limit ?? 5;

          console.log("🔎 search_catalog → query:", query, "limit:", limit);

          const rawResults = await searchCatalog(query, limit);

          const results = rawResults.map((it) => ({
            title: it.entry_title || "",
            price: it.entry_price?.price ?? "",
            url: it.entry_shop_url || "",
            image: it.entry_photo?.photo || "",
          }));

          collectedItems = results;

          toolOutputs.push({
            tool_call_id: call.id,
            output: JSON.stringify(results),
          });
        } else {
          // IMPORTANT: always return output for every tool call
          toolOutputs.push({
            tool_call_id: call.id,
            output: JSON.stringify({ error: `Unsupported tool: ${fname}` }),
          });
        }
      }

      run = await client.beta.threads.runs.submitToolOutputsAndPoll(
        thread.id,
        run.id,
        { tool_outputs: toolOutputs }
      );
    }

    if (run.status !== "completed") {
      console.error("❌ Run final status:", run.status);
      throw new Error("Assistant run did not complete. Final status: " + run.status);
    }

    // 4) get assistant message
    const messages = await client.beta.threads.messages.list(thread.id, { limit: 10 });
    const assistantMessage = messages.data.find((m) => m.role === "assistant");

    let text = (assistantMessage?.content?.[0]?.text?.value || "").trim();

    // (optional) cut list
    const markers = ["\n1)", "\n1.", "\n•", "\n-", "\n–", "\n—", "\n*"];
    let listIndex = -1;

    for (const m of markers) {
      const idx = text.indexOf(m);
      if (idx !== -1 && (listIndex === -1 || idx < listIndex)) listIndex = idx;
    }
    if (listIndex > 0) text = text.slice(0, listIndex).trim();

    console.log("🤖 BOT TEXT:", text);
    console.log("🤖 BOT ITEMS:", collectedItems.length);

    return { text, items: collectedItems };
  } catch (err) {
    console.error("Assistant error:", err);
    throw err;
  }
}
