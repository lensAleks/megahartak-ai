import "dotenv/config";

export const config = {
  port: process.env.PORT || 3000,
  apiKey: process.env.OPENAI_API_KEY,
  assistantId: process.env.ASSISTANT_ID,
};
