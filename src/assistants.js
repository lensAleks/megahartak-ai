// // src/assistants.js
// import OpenAI from "openai";
// import { config } from "./config.js";
// import { searchCatalog } from "./catalog.js";

// const client = new OpenAI({ apiKey: config.apiKey });

// function safeJsonParse(str, fallback = {}) {
//   try {
//     return JSON.parse(str || "{}");
//   } catch (e) {
//     console.warn("⚠️ Invalid JSON in tool arguments:", str);
//     return fallback;
//   }
// }

// export async function askAssistant(userQuery) {
//   try {
//     let collectedItems = [];

//     // 1) create thread
//     const thread = await client.beta.threads.create({
//       messages: [{ role: "user", content: userQuery }],
//     });

//     // 2) run
//     let run = await client.beta.threads.runs.createAndPoll(thread.id, {
//       assistant_id: config.assistantId,
//     });

//     // 3) handle tools (may require multiple rounds)
//     while (run.status === "requires_action" && run.required_action?.submit_tool_outputs) {
//       const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
//       const toolOutputs = [];

//       for (const call of toolCalls) {
//         const fname = call.function?.name;
//         const args = safeJsonParse(call.function?.arguments, {});
//         console.log("🛠 TOOL CALL:", fname, args);

//         if (fname === "search_catalog") {
//           const query = args.query || userQuery;
//           const limit = args.limit ?? 5;

//           console.log("🔎 search_catalog → query:", query, "limit:", limit);

//           const rawResults = await searchCatalog(query, limit);

//           const results = rawResults.map((it) => ({
//             title: it.entry_title || "",
//             price: it.entry_price?.price ?? "",
//             url: it.entry_shop_url || "",
//             image: it.entry_photo?.photo || "",
//           }));

//           collectedItems = results;

//           toolOutputs.push({
//             tool_call_id: call.id,
//             output: JSON.stringify(results),
//           });
//         } else {
//           // IMPORTANT: always return output for every tool call
//           toolOutputs.push({
//             tool_call_id: call.id,
//             output: JSON.stringify({ error: `Unsupported tool: ${fname}` }),
//           });
//         }
//       }

//       run = await client.beta.threads.runs.submitToolOutputsAndPoll(
//         thread.id,
//         run.id,
//         { tool_outputs: toolOutputs }
//       );
//     }

//    if (run.status !== "completed") {
//   console.error("❌ Run final status:", run.status);
//   console.error("❌ Run last_error:", run.last_error);
//   console.error("❌ Run required_action:", run.required_action);
//   throw new Error(
//     run.last_error?.message || ("Assistant run did not complete. Final status: " + run.status)
//   );
// }

//     // 4) get assistant message
//     const messages = await client.beta.threads.messages.list(thread.id, { limit: 10 });
//     const assistantMessage = messages.data.find((m) => m.role === "assistant");

//     let text = (assistantMessage?.content?.[0]?.text?.value || "").trim();

//     // (optional) cut list
//     const markers = ["\n1)", "\n1.", "\n•", "\n-", "\n–", "\n—", "\n*"];
//     let listIndex = -1;

//     for (const m of markers) {
//       const idx = text.indexOf(m);
//       if (idx !== -1 && (listIndex === -1 || idx < listIndex)) listIndex = idx;
//     }
//     if (listIndex > 0) text = text.slice(0, listIndex).trim();

//     console.log("🤖 BOT TEXT:", text);
//     console.log("🤖 BOT ITEMS:", collectedItems.length);

//     return { text, items: collectedItems };
//   } catch (err) {
//     console.error("Assistant error:", err);
//     throw err;
//   }
// }





// src/assistants.js
import OpenAI from "openai";
import { config } from "./config.js";
import { searchCatalog } from "./catalog.js";
import categoriesJson from "./categories.json"

const client = new OpenAI({ apiKey: config.apiKey });

function safeJsonParse(str, fallback = {}) {
  try {
    return JSON.parse(str || "{}");
  } catch (e) {
    console.warn("⚠️ Invalid JSON in tool arguments:", str);
    return fallback;
  }
}

/** ----------------------------
 *  CATEGORY WHITELIST MAP
 *  ---------------------------- */
const CATEGORY_URL_BY_KEY = Object.fromEntries(
  (categoriesJson.categories || []).map((c) => [c.key, c.url])
);

/** ----------------------------
 *  INTENT DETECTION
 *  ---------------------------- */

// 1) Жёсткие маркеры "дай ссылку / category link / բաժին / ..."
// Если есть — это НЕ поиск товара. Это запрос ссылки на раздел.
const CATEGORY_LINK_MARKERS = [
  // RU
  "ссылка",
  "ссылку",
  "категория",
  "категорию",
  "раздел",
  "раздела",
  // EN
  "category",
  "link",
  "section",
  // AM
  "բաժին",
  "կատեգորիա",
  // Translit
  "bajin",
  "kategoria"
];

function isCategoryLinkRequest(q) {
  const s = String(q || "").toLowerCase();
  return CATEGORY_LINK_MARKERS.some((m) => s.includes(m));
}

// 2) Простейшая привязка слов → category_key (можно расширять)
// Важно: это работает ДО ассистента и гарантирует правильный URL.
const CATEGORY_KEYWORDS_MAP = [
  {
    key: "sport_fitness",
    kws: ["спорт", "фитнес", "training", "sport", "fitness", "սպորտ", "ֆիթնես", "nike", "adidas", "puma"]
  },
  {
    key: "toys_costumes",
    kws: ["игруш", "toys", "lego", "disney", "marvel", "barbie", "խաղալի", "տոնական", "զգեստ"]
  },
  {
    key: "kitchen_gourmet",
    kws: ["кухн", "kitchen", "gourmet", "խոհանոց", "գուրմե", "tefal", "bosch", "philips", "moulinex"]
  },
  {
    key: "original_gifts",
    kws: ["подар", "gift", "gifts", "նվեր", "օրիգինալ", "star wars", "playstation"]
  },
  {
    key: "fashion_accessories",
    kws: ["мода", "fashion", "аксесс", "accessories", "նորաձև", "աքսեսուար", "guess", "kors", "hilfiger", "boss"]
  },
  {
    key: "computers_electronics",
    kws: ["комп", "ноут", "laptop", "notebook", "pc", "electronics", "համակարգիչ", "նոթբուք", "հեռախոս", "apple", "samsung", "lenovo", "asus", "hp", "sony"]
  },
  {
    key: "perfume_cosmetics",
    kws: ["парф", "духи", "perfume", "cosmetics", "օծանելիք", "կոսմետիկ", "dior", "chanel", "armani", "ysl", "lancome"]
  },
  {
    key: "health_beauty",
    kws: ["красот", "здоров", "beauty", "health", "առողջ", "գեղեցկ", "oral-b", "braun", "beurer", "philips"]
  },
  {
    key: "home_garden",
    kws: ["дом", "сад", "home", "garden", "տուն", "այգի", "bosch", "black+decker", "gardena"]
  }
];

function detectCategoryKey(q) {
  const s = String(q || "").toLowerCase();

  // Если пользователь явно написал "bbay sport category link" — ключ должен быть sport_fitness
  // Берём лучший матч по количеству совпадений.
  let best = { key: null, score: 0 };

  for (const c of CATEGORY_KEYWORDS_MAP) {
    let score = 0;
    for (const kw of c.kws) {
      if (s.includes(String(kw).toLowerCase())) score++;
    }
    if (score > best.score) best = { key: c.key, score };
  }

  return best.score > 0 ? best.key : null;
}

/** ----------------------------
 *  MAIN
 *  ---------------------------- */
export async function askAssistant(userQuery) {
  try {
    // ✅ 0) CATEGORY LINK REQUEST OVERRIDE (самый важный фикс)
    // Если пользователь просит "ссылку/категорию/раздел" — НЕ даём ассистенту решать URL.
    if (isCategoryLinkRequest(userQuery)) {
      const category_key = detectCategoryKey(userQuery);

      // Если не смогли определить категорию — никаких URL, только текст
      if (!category_key) {
        return {
          text: "Ссылку на категорию сейчас не могу подобрать точно. Напишите, пожалуйста, какую именно категорию вы хотите (спорт, электроника, кухня, подарки и т.д.).",
          items: [],
          category_key: null,
          category_url: null
        };
      }

      const category_url = CATEGORY_URL_BY_KEY[category_key] || null;

      // Если ключ есть, но URL нет (ошибка в json) — тоже не выдаём URL
      if (!category_url) {
        return {
          text: "Ссылка на категорию временно недоступна.",
          items: [],
          category_key,
          category_url: null
        };
      }

      // ВАЖНО: URL отдаём только из whitelist
      return {
        text: "", // фронт может показать только ссылку, или ты можешь вывести её сам
        items: [],
        category_key,
        category_url
      };
    }

    // ✅ 1) otherwise continue normal assistant flow (products / support)
    let collectedItems = [];

    const thread = await client.beta.threads.create({
      messages: [{ role: "user", content: userQuery }]
    });

    let run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: config.assistantId
    });

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
            image: it.entry_photo?.photo || ""
          }));

          collectedItems = results;

          // ✅ Важно: ассистенту лучше давать объект, а не "голый массив"
          toolOutputs.push({
            tool_call_id: call.id,
            output: JSON.stringify({ items: results })
          });
        } else {
          toolOutputs.push({
            tool_call_id: call.id,
            output: JSON.stringify({ error: `Unsupported tool: ${fname}` })
          });
        }
      }

      run = await client.beta.threads.runs.submitToolOutputsAndPoll(thread.id, run.id, {
        tool_outputs: toolOutputs
      });
    }

    if (run.status !== "completed") {
      console.error("❌ Run final status:", run.status);
      console.error("❌ Run last_error:", run.last_error);
      console.error("❌ Run required_action:", run.required_action);
      throw new Error(
        run.last_error?.message || "Assistant run did not complete. Final status: " + run.status
      );
    }

    const messages = await client.beta.threads.messages.list(thread.id, { limit: 10 });
    const assistantMessage = messages.data.find((m) => m.role === "assistant");

    let text = (assistantMessage?.content?.[0]?.text?.value || "").trim();

    // ⚠️ Важно: ты раньше резал списки — из-за этого мог “отрезать” важный кусок.
    // Я бы НЕ резал вообще. Но если хочешь — режь только если items есть.
    if (collectedItems.length > 0) {
      const markers = ["\n1)", "\n1.", "\n•", "\n-", "\n–", "\n—", "\n*"];
      let listIndex = -1;
      for (const m of markers) {
        const idx = text.indexOf(m);
        if (idx !== -1 && (listIndex === -1 || idx < listIndex)) listIndex = idx;
      }
      if (listIndex > 0) text = text.slice(0, listIndex).trim();
    }

    // ✅ 5) если товаров НЕТ — попробуем предложить категорию (но опять же: URL только из whitelist)
    let category_key = null;
    let category_url = null;

    if (collectedItems.length === 0) {
      category_key = detectCategoryKey(userQuery);
      category_url = category_key ? (CATEGORY_URL_BY_KEY[category_key] || null) : null;
    }

    return { text, items: collectedItems, category_key, category_url };
  } catch (err) {
    console.error("Assistant error:", err);
    throw err;
  }
}

