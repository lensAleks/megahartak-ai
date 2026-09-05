// src/assistants.js
import OpenAI from "openai";
import { config } from "./config.js";
import { searchCatalog } from "./catalog.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const categoriesJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "categories.json"), "utf-8")
);

console.log(
  "✅ categories.json loaded:",
  Array.isArray(categoriesJson.categories)
);
console.log(
  "✅ categories count:",
  categoriesJson.categories?.length
);

const client = new OpenAI({
  apiKey: config.apiKey,
});

/**
 * --------------------------------
 * CATEGORY WHITELIST
 * --------------------------------
 */
const CATEGORY_URL_BY_KEY = Object.fromEntries(
  (categoriesJson.categories || []).map((c) => [c.key, c.url])
);

/**
 * --------------------------------
 * CATEGORY INTENT
 * --------------------------------
 */
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

  // translit
  "bajin",
  "kategoria",
];

function isCategoryLinkRequest(q) {
  const s = String(q || "").toLowerCase();
  return CATEGORY_LINK_MARKERS.some((m) => s.includes(m));
}

const CATEGORY_KEYWORDS_MAP = [
  {
    key: "sport_fitness",
    kws: [
      "спорт",
      "фитнес",
      "training",
      "sport",
      "fitness",
      "սպորտ",
      "ֆիթնես",
      "nike",
      "adidas",
      "puma",
    ],
  },
  {
    key: "toys_costumes",
    kws: [
      "игруш",
      "toys",
      "lego",
      "disney",
      "marvel",
      "barbie",
      "խաղալի",
      "տոնական",
      "զգեստ",
    ],
  },
  {
    key: "kitchen_gourmet",
    kws: [
      "кухн",
      "kitchen",
      "gourmet",
      "խոհանոց",
      "գուրմե",
      "tefal",
      "bosch",
      "philips",
      "moulinex",
    ],
  },
  {
    key: "original_gifts",
    kws: [
      "подар",
      "gift",
      "gifts",
      "նվեր",
      "օրիգինալ",
      "star wars",
      "playstation",
    ],
  },
  {
    key: "fashion_accessories",
    kws: [
      "мода",
      "fashion",
      "аксесс",
      "accessories",
      "նորաձև",
      "աքսեսուար",
      "guess",
      "kors",
      "hilfiger",
      "boss",
    ],
  },
  {
    key: "computers_electronics",
    kws: [
      "комп",
      "ноут",
      "laptop",
      "notebook",
      "pc",
      "electronics",
      "համակարգիչ",
      "նոթբուք",
      "հեռախոս",
      "apple",
      "samsung",
      "lenovo",
      "asus",
      "hp",
      "sony",
    ],
  },
  {
    key: "perfume_cosmetics",
    kws: [
      "парф",
      "духи",
      "perfume",
      "cosmetics",
      "օծանելիք",
      "կոսմետիկ",
      "dior",
      "chanel",
      "armani",
      "ysl",
      "lancome",
    ],
  },
  {
    key: "health_beauty",
    kws: [
      "красот",
      "здоров",
      "beauty",
      "health",
      "առողջ",
      "գեղեցկ",
      "oral-b",
      "braun",
      "beurer",
      "philips",
    ],
  },
  {
    key: "home_garden",
    kws: [
      "дом",
      "сад",
      "home",
      "garden",
      "տուն",
      "այգի",
      "bosch",
      "black+decker",
      "gardena",
    ],
  },
];

function detectCategoryKey(q) {
  const s = String(q || "").toLowerCase();

  let best = {
    key: null,
    score: 0,
  };

  for (const c of CATEGORY_KEYWORDS_MAP) {
    let score = 0;

    for (const kw of c.kws) {
      if (s.includes(String(kw).toLowerCase())) {
        score++;
      }
    }

    if (score > best.score) {
      best = {
        key: c.key,
        score,
      };
    }
  }

  return best.score > 0 ? best.key : null;
}

/**
 * --------------------------------
 * OPENAI TOOLS
 * --------------------------------
 */
const tools = [
  {
    type: "file_search",

    // ВАЖНО:
    // добавим сюда ID твоего старого Vector Store
    vector_store_ids: [config.vectorStoreId],
  },

  {
    type: "function",
    name: "search_catalog",
    description:
      "Search the Megahartak product catalog. Use this when the user wants products, prices, brands, models, or product recommendations.",

    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Product search query. Include important brand/model/category words.",
        },

        limit: {
          type: "integer",
          description: "Maximum number of products to return.",
          minimum: 1,
          maximum: 10,
        },
      },

      required: ["query"],
      additionalProperties: false,
    },
  },
];

/**
 * --------------------------------
 * INSTRUCTIONS
 * --------------------------------
 */
const instructions = `
You are "Megahartak AI Assistant", the shopping and customer-support
assistant for Megahartak.am.

The primary marketplace language is Armenian.

LANGUAGE:
- If the customer writes Armenian, answer Armenian.
- If the customer writes Russian, answer Russian.
- If the customer writes English, answer English.
- If language is mixed, answer in the dominant language.

YOUR TASKS:
- Help customers understand Megahartak.
- Help customers find products.
- Answer questions about brands, products, delivery, authenticity,
  returns, warranty and marketplace rules.
- Use File Search for Megahartak / BBAY knowledge-base questions.
- Use search_catalog when the customer is looking for actual products,
  prices, product models or recommendations.

IMPORTANT:
- Never invent products.
- Never invent prices.
- Never invent availability.
- Never invent delivery conditions.
- Never claim something is in stock unless the catalog data confirms it.
- For policies, BBAY, authenticity, delivery, insurance and similar
  factual questions, rely on the connected knowledge base.
- If reliable information is not available, tell the customer that it
  should be confirmed with a Megahartak operator.
- Do not promise refunds or compensation unless supported by the
  knowledge base.

PRODUCT SEARCH:
- When search_catalog returns products, summarize the results naturally.
- Mention useful product names/features when appropriate.
- Do not create products that were not returned by the tool.
- If many products are returned, highlight the best matches.
- Do not fabricate URLs.

Keep answers clear, useful and suitable for an online marketplace customer.
`;

/**
 * --------------------------------
 * MAIN
 * --------------------------------
 */
export async function askAssistant(userQuery) {
  try {
    /**
     * 0. Category URL override
     *
     * Keep this logic outside OpenAI.
     * This guarantees that URLs come only from our whitelist.
     */
    if (isCategoryLinkRequest(userQuery)) {
      const category_key = detectCategoryKey(userQuery);

      if (!category_key) {
        return {
          text:
            "Ссылку на категорию сейчас не могу подобрать точно. " +
            "Напишите, пожалуйста, какую именно категорию вы хотите " +
            "(спорт, электроника, кухня, подарки и т.д.).",

          items: [],
          category_key: null,
          category_url: null,
        };
      }

      const category_url =
        CATEGORY_URL_BY_KEY[category_key] || null;

      if (!category_url) {
        return {
          text: "Ссылка на категорию временно недоступна.",
          items: [],
          category_key,
          category_url: null,
        };
      }

      return {
        text: "",
        items: [],
        category_key,
        category_url,
      };
    }

    /**
     * 1. First Responses API call
     */
    let collectedItems = [];

    let response = await client.responses.create({
      model: config.model || "gpt-5.6-terra",

      instructions,

      tools,

      input: userQuery,
    });

    /**
     * 2. Function-call loop
     *
     * File Search is handled automatically by OpenAI.
     * Our local search_catalog function must be executed by us.
     */
    while (true) {
      const functionCalls =
        response.output?.filter(
          (item) => item.type === "function_call"
        ) || [];

      if (functionCalls.length === 0) {
        break;
      }

      const toolOutputs = [];

      for (const call of functionCalls) {
        console.log(
          "🛠 TOOL CALL:",
          call.name,
          call.arguments
        );

        if (call.name === "search_catalog") {
          let args = {};

          try {
            args = JSON.parse(call.arguments || "{}");
          } catch (err) {
            console.warn(
              "⚠️ Invalid function arguments:",
              call.arguments
            );
          }

          const query =
            args.query || userQuery;

          const limit =
            Number(args.limit) || 5;

          console.log(
            "🔎 search_catalog → query:",
            query,
            "limit:",
            limit
          );

          const rawResults =
            await searchCatalog(query, limit);
          
            console.log(
              "🔍 RAW PRODUCT:",
              JSON.stringify(rawResults[0], null, 2)
            );
            
          const results = rawResults.map((it) => ({
            title: it.entry_title || "",
            price: it.entry_price?.price ?? "",
            url: it.entry_shop_url || "",
            image: it.entry_photo?.photo || "",
          }));

          collectedItems = results;

          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({
              items: results,
            }),
          });
        } else {
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({
              error: `Unsupported tool: ${call.name}`,
            }),
          });
        }
      }

      /**
       * Continue the same response after our function outputs.
       */
      response = await client.responses.create({
        model: config.model || "gpt-5.6-terra",

        instructions,

        tools,

        previous_response_id: response.id,

        input: toolOutputs,
      });
    }

    /**
     * 3. Final text
     */
    let text =
      String(response.output_text || "").trim();

    console.log("🤖 BOT TEXT:", text);
    console.log(
      "🤖 BOT ITEMS:",
      collectedItems.length
    );

    /**
     * Optional:
     * If actual products are returned, don't duplicate
     * a huge product list in the text because the frontend
     * already renders product cards.
     */
    if (collectedItems.length > 0) {
      const markers = [
        "\n1)",
        "\n1.",
        "\n•",
        "\n-",
        "\n–",
        "\n—",
        "\n*",
      ];

      let listIndex = -1;

      for (const marker of markers) {
        const idx = text.indexOf(marker);

        if (
          idx !== -1 &&
          (listIndex === -1 || idx < listIndex)
        ) {
          listIndex = idx;
        }
      }

      if (listIndex > 0) {
        text = text.slice(0, listIndex).trim();
      }
    }

    /**
     * 4. Category suggestion when product search returned nothing
     */
    let category_key = null;
    let category_url = null;

    if (collectedItems.length === 0) {
      category_key =
        detectCategoryKey(userQuery);

      category_url =
        category_key
          ? CATEGORY_URL_BY_KEY[category_key] || null
          : null;
    }

    return {
      text,
      items: collectedItems,
      category_key,
      category_url,
    };
  } catch (err) {
    console.error(
      "❌ Responses API error:",
      err
    );

    throw err;
  }
}