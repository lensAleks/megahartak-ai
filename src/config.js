import "dotenv/config";

export const config = {
  port: process.env.PORT || 3000,

  apiKey: process.env.OPENAI_API_KEY,

  vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID,

  model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
};