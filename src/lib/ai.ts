import OpenAI from "openai";
import { COMMUNITY_SYSTEM_PROMPT } from "@/lib/system-prompt";

// Support both OpenRouter and Google AI Studio (Gemini) natively using OpenAI SDK
const isGemini = process.env.AI_MODEL?.toLowerCase().includes("gemini");

const openai = new OpenAI({
  baseURL: isGemini 
    ? "https://generativelanguage.googleapis.com/v1beta/openai/" 
    : "https://openrouter.ai/api/v1",
  apiKey: process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || "dummy-key-for-build",
});

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: any }[],
  audioData?: { base64: string }
) {
  try {
    const formattedMessages: any[] = [
      {
        role: "system",
        content: COMMUNITY_SYSTEM_PROMPT,
      },
      ...messages,
    ];

    if (formattedMessages.length > 0) {
      const lastMessage = formattedMessages[formattedMessages.length - 1];
      if (lastMessage.role === "user") {
        const langSuffix = "\n\n[CRITICAL SYSTEM RULE: You MUST reply in the EXACT same language as the text above. Ignore the language of previous messages.]";
        if (typeof lastMessage.content === "string") {
          lastMessage.content += langSuffix;
        } else if (Array.isArray(lastMessage.content)) {
          lastMessage.content[0].text += langSuffix;
        }
        
        if (audioData) {
          if (typeof lastMessage.content === "string") {
            lastMessage.content = [
              { type: "text", text: lastMessage.content },
              {
                type: "input_audio",
                input_audio: {
                  data: audioData.base64,
                  format: "wav" 
                }
              }
            ];
          } else if (Array.isArray(lastMessage.content)) {
            lastMessage.content.push({
              type: "input_audio",
              input_audio: {
                data: audioData.base64,
                format: "wav" 
              }
            });
          }
        }
      }
    }

    const completion = await openai.chat.completions.create({
      model: isGemini ? "gemini-2.5-flash" : "anthropic/claude-sonnet-4-20250514",
      messages: formattedMessages,
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
        },
        {
          type: "function",
          function: {
            name: "create_ticket",
            description: "Create a maintenance or complaint ticket. Use when a resident reports an issue.",
            parameters: {
              type: "object",
              properties: {
                description: {
                  type: "string",
                  description: "Detailed description of the issue."
                }
              },
              required: ["description"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "check_ticket_status",
            description: "Check the status of a specific ticket.",
            parameters: {
              type: "object",
              properties: {
                ticket_id: {
                  type: "string",
                  description: "The UUID or short ID of the ticket."
                }
              },
              required: ["ticket_id"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_latest_notices",
            description: "Fetch the latest community announcements and notices.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "get_local_services",
            description: "Get a list of trusted local service vendors (e.g., Plumber, Electrician).",
            parameters: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  description: "The type of service requested (e.g., Plumber, Electrician, Carpenter). Leave empty to get all."
                }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_active_polls",
            description: "Fetch all active community polls that residents can vote on.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "submit_poll_vote",
            description: "Submit a resident's vote for a specific poll.",
            parameters: {
              type: "object",
              properties: {
                poll_id: {
                  type: "string",
                  description: "The UUID of the poll being voted on."
                },
                option: {
                  type: "string",
                  description: "The option the resident is voting for."
                }
              },
              required: ["poll_id", "option"]
            }
          }
        }
      ],
      tool_choice: "auto"
    });

    const message = completion.choices[0]?.message;
    console.log("Raw AI Message:", JSON.stringify(message, null, 2));

    // Check if the AI wants to call a tool
    let toolCallName = "";
    let toolCallArgs = "{}";

    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      if (toolCall.type === "function") {
        toolCallName = toolCall.function.name;
        toolCallArgs = toolCall.function.arguments || "{}";
      }
    } else if (message?.function_call) {
      toolCallName = message.function_call.name;
      toolCallArgs = message.function_call.arguments || "{}";
    }

    if (toolCallName) {
      const args = JSON.parse(toolCallArgs);
      return {
        text: "", // The webhook will handle the rest based on tool_call
        tool_call: {
          name: toolCallName,
          args: args
        }
      };
    }

    return { text: message?.content || `DEBUG - AI returned empty content. Raw message: ${JSON.stringify(message)}` };
  } catch (error) {
    console.error("AI Generation Error:", error);
    return { text: "I am currently experiencing a very high volume of requests from the community. Please wait a few seconds and try asking me again!" };
  }
}
