import OpenAI from "openai";
import { COMMUNITY_SYSTEM_PROMPT } from "@/lib/system-prompt";

// Support both OpenRouter and Google AI Studio (Gemini) natively using OpenAI SDK
const isGemini = process.env.AI_MODEL?.toLowerCase().includes("gemini");

const openai = new OpenAI({
  baseURL: isGemini 
    ? "https://generativelanguage.googleapis.com/v1beta/openai/" 
    : "https://openrouter.ai/api/v1",
  apiKey: process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY,
});

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[]
) {
  const completion = await openai.chat.completions.create({
    model: process.env.AI_MODEL || "anthropic/claude-sonnet-4-20250514",
    messages: [
      {
        role: "system",
        content: COMMUNITY_SYSTEM_PROMPT,
      },
      ...messages,
    ],
  });

  return completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
}
