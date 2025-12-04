import OpenAI from "openai";
import { config } from "./config.js";
import { searchCatalog } from "./catalog.js";

const client = new OpenAI({
  apiKey: config.apiKey,
});

/**
 * Запрос к ассистенту с поддержкой tools (search_catalog).
 * Ассистент должен быть настроен в OpenAI Platform и иметь tool с name: "search_catalog".
 */
export async function askAssistant(userQuery) {
  // 1. Создаём thread с сообщением пользователя
  const thread = await client.beta.threads.create({
    messages: [{ role: "user", content: userQuery }],
  });

  // 2. Запускаем run ассистента и ждём первой стадии
  let run = await client.beta.threads.runs.createAndPoll(thread.id, {
    assistant_id: config.assistantId,
  });

  // 3. Если ассистент просит вызвать tools (например, search_catalog)
  if (run.status === "requires_action" && run.required_action?.submit_tool_outputs) {
    const toolCalls = run.required_action.submit_tool_outputs.tool_calls;

    const toolOutputs = [];

    for (const call of toolCalls) {
      if (call.function.name === "search_catalog") {
        const args = JSON.parse(call.function.arguments || "{}");
        const query = args.query || userQuery;

        const results = searchCatalog(query);

        toolOutputs.push({
          tool_call_id: call.id,
          output: JSON.stringify(results),
        });
      }
    }

    // 4. Отправляем результаты вызванных tools и ждём финального ответа
    run = await client.beta.threads.runs.submitToolOutputsAndPoll(thread.id, run.id, {
      tool_outputs: toolOutputs,
    });
  }

  if (run.status !== "completed") {
    throw new Error("Assistant run did not complete. Final status: " + run.status);
  }

  // 5. Получаем последнее сообщение ассистента
  const messages = await client.beta.threads.messages.list(thread.id, { limit: 10 });
  const assistantMessage = messages.data.find((m) => m.role === "assistant");

  const content = assistantMessage?.content?.[0]?.text?.value || "";
  return content.trim();
}
