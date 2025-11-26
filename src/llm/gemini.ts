import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash-latest";

export const buildGeminiModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  return new ChatGoogleGenerativeAI({
    apiKey,
    model: DEFAULT_MODEL,
    temperature: 0.4,
    maxOutputTokens: 256,
    apiVersion: "v1beta",
  });
};
