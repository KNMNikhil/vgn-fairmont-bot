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
  try {
    const completion = await openai.chat.completions.create({
      model: isGemini ? "gemini-2.5-flash" : "anthropic/claude-sonnet-4-20250514",
      messages: [
        {
          role: "system",
          content: COMMUNITY_SYSTEM_PROMPT,
        },
        ...messages,
      ],
      temperature: 0.2,
      max_tokens: 1000,
      tools: [
        {
          type: "function",
          function: {
            name: "route_shop_order",
            description: "Route an order to a specific shop (e.g., fruits shop, iron shop). Automatically extracts the sender's name and phone number. MUST ONLY be called if the user has provided their block and flat/door number.",
            parameters: {
              type: "object",
              properties: {
                shop_type: {
                  type: "string",
                  enum: ["fruits_shop", "iron_shop"],
                  description: "The shop to send the order to."
                },
                item: {
                  type: "string",
                  description: "The item or service being requested (e.g., '1kg Apple', 'Ironing 5 shirts')."
                },
                flat_number: {
                  type: "string",
                  description: "The user's block and door number (e.g., 'B4-2E')."
                }
              },
              required: ["shop_type", "item", "flat_number"]
            }
          }
        }
      ],
      tool_choice: "auto"
    });

    const message = completion.choices[0]?.message;

    // Check if the AI wants to call a tool
    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      if (toolCall.function.name === "route_shop_order") {
        const args = JSON.parse(toolCall.function.arguments);
        return {
          text: "", // The webhook will handle the rest based on tool_call
          tool_call: {
            name: "route_shop_order",
            args: args
          }
        };
      }
    }

    return { text: message?.content || "Sorry, I couldn't generate a response." };
  } catch (error) {
    console.error("AI Generation Error:", error);
    return "I am currently experiencing a very high volume of requests from the community. Please wait a few seconds and try asking me again!";
  }
}
