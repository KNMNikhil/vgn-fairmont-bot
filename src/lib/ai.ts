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

/**
 * Detects the primary language/script of a text string based on Unicode ranges.
 * Returns a human-readable language name with script requirement.
 */
function detectLanguage(text: string): string {
  if (!text || typeof text !== "string") return "English";
  
  // Count characters per script
  const tamilChars = (text.match(/[\u0B80-\u0BFF]/g) || []).length;
  const devanagariChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  const teluguChars = (text.match(/[\u0C00-\u0C7F]/g) || []).length;
  const malayalamChars = (text.match(/[\u0D00-\u0D7F]/g) || []).length;
  const kannadaChars = (text.match(/[\u0C80-\u0CFF]/g) || []).length;
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  
  const scores: [number, string, string][] = [
    [tamilChars, "Tamil", "Tamil script (தமிழ்) only - NO Devanagari, NO English, NO other scripts"],
    [devanagariChars, "Hindi", "Hindi Devanagari script (हिंदी) only - NO Tamil, NO English, NO other scripts"],
    [teluguChars, "Telugu", "Telugu script (తెలుగు) only"],
    [malayalamChars, "Malayalam", "Malayalam script (മലയാളം) only"],
    [kannadaChars, "Kannada", "Kannada script (ಕನ್ನಡ) only"],
    [arabicChars, "Arabic", "Arabic script only"],
  ];
  
  // Sort by score descending
  scores.sort((a, b) => b[0] - a[0]);
  
  // If any non-Latin script has significant presence, use it
  if (scores[0][0] > 0) {
    return scores[0][2]; // Return the full instruction string
  }
  
  return "English - ONLY English language, NO Tamil, NO Hindi, NO other languages";
}

export async function getAIResponse(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: { role: "user" | "assistant"; content: any }[],
  audioData?: { base64: string }
) {
  try {
    // Get current time for context
    const now = new Date();
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const birthTime = new Date('2026-06-05T23:59:25+05:30'); // June 5, 2026, 11:59:25 PM IST
    
    // Calculate age
    const ageMs = now.getTime() - birthTime.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const ageHours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const ageMinutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));
    const ageSeconds = Math.floor((ageMs % (1000 * 60)) / 1000);
    
    // Format current time
    const timeStr = istTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    });
    const dateStr = istTime.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Inject current time context into system prompt
    const timeContext = `\n\n[CURRENT TIME CONTEXT - Use this for time/date questions]:\n- Current Date & Time (IST): ${dateStr} at ${timeStr}\n- Your Age: ${ageDays} days, ${ageHours} hours, ${ageMinutes} minutes, and ${ageSeconds} seconds old\n- Birth Time: June 5, 2026 at 11:59:25 PM IST`;
    
    // Detect language of the last user message programmatically
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    const lastUserText = typeof lastUserMsg?.content === "string" 
      ? lastUserMsg.content 
      : (Array.isArray(lastUserMsg?.content) ? lastUserMsg.content.find((c: any) => c.type === "text")?.text : "") || "";
    
    const isAudioMessage = lastUserText === "AUDIO_MESSAGE_RECEIVED" && !!audioData;
    const detectedLangInstruction = isAudioMessage
      ? "AUDIO: Detect language from audio and reply in that spoken language only."
      : detectLanguage(lastUserText);

    // Tool usage ban — appended directly to the ONE system message
    const toolBanRules = `

TOOL USAGE — STRICT RULES:
NEVER call any tool for: swimming pool rules, gym rules, parking rules, pet rules, quiet hours, amenities, security contacts, escalation matrix, association members, maintenance charges, shop locations, maid contacts, community groups, or ANY info already in the knowledge base.
For those questions: read the knowledge base and reply DIRECTLY. No tools needed.
Tools are ONLY for: create_ticket, check_ticket_status, get_latest_notices (live DB notices), route_shop_order, rsvp_to_event, get_active_polls, get_upcoming_events (live DB events), get_local_services, get_community_groups, submit_poll_vote.

LANGUAGE RULE (CURRENT MESSAGE):
${isAudioMessage
  ? "This is a VOICE MESSAGE. Detect the spoken language from the audio. Reply ENTIRELY in that spoken language. Do NOT default to Tamil or any prior conversation language."
  : `Reply ENTIRELY in: ${detectedLangInstruction}`}`;

    // SINGLE system message — Gemini only reads the first system message reliably
    const formattedMessages: any[] = [
      {
        role: "system",
        content: COMMUNITY_SYSTEM_PROMPT + timeContext + toolBanRules,
      },
      ...messages,
    ];

    // Handle audio attachment on the last user message
    if (formattedMessages.length > 0) {
      const lastMessage = formattedMessages[formattedMessages.length - 1];
      if (lastMessage.role === "user" && audioData) {
        const audioTextPrefix = isAudioMessage 
          ? "[VOICE MESSAGE - transcribe and detect language, reply in that spoken language]: "
          : "";
        if (typeof lastMessage.content === "string") {
          lastMessage.content = [
            { type: "text", text: audioTextPrefix + lastMessage.content },
            { type: "input_audio", input_audio: { data: audioData.base64, format: "wav" } }
          ];
        } else if (Array.isArray(lastMessage.content)) {
          lastMessage.content.push(
            { type: "input_audio", input_audio: { data: audioData.base64, format: "wav" } }
          );
        }
      }
    }


    let completion: any = null;
    let retries = 3;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        completion = await openai.chat.completions.create({
          model: isGemini ? (process.env.AI_MODEL || "gemini-2.5-flash") : "anthropic/claude-sonnet-4-20250514",
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
            name: "get_current_datetime",
            description: "Get the current date and time in IST (Indian Standard Time). MUST be called when user asks about current date, time, today's date, or what time it is.",
            parameters: { type: "object", properties: { _dummy: { type: "string" } } }
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
            description: "ONLY use to fetch LIVE community announcements posted by admins in the database. DO NOT use for rules, amenities, contacts, escalation matrix, swimming pool rules, parking rules, pet rules, or anything already in the knowledge base. Those must be answered from the knowledge base directly.",
            parameters: { type: "object", properties: { _dummy: { type: "string" } } }
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
            parameters: { type: "object", properties: { _dummy: { type: "string" } } }
          }
        },
        {
          type: "function",
          function: {
            name: "get_upcoming_events",
            description: "ONLY use to fetch LIVE upcoming events from the database that were created dynamically. DO NOT use for general community rules, amenities, contacts, or knowledge base info.",
            parameters: {
              type: "object",
              properties: {
                days_ahead: {
                  type: "number",
                  description: "Number of days ahead to show events (default 30)"
                }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "rsvp_to_event",
            description: "RSVP to a community event. Use when user wants to attend, register, or confirm attendance for an event.",
            parameters: {
              type: "object",
              properties: {
                event_id: {
                  type: "string",
                  description: "The event ID or partial ID"
                },
                status: {
                  type: "string",
                  enum: ["going", "maybe", "not_going"],
                  description: "RSVP status"
                },
                guests_count: {
                  type: "number",
                  description: "Number of guests (including self)"
                }
              },
              required: ["event_id", "status"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_community_groups",
            description: "Get community WhatsApp group links and admin contacts. Use when user asks about joining groups like ladies group, pet owners group, sports group, etc.",
            parameters: {
              type: "object",
              properties: {
                group_type: {
                  type: "string",
                  description: "Type of group (e.g., 'ladies', 'pet_owners', 'sports', 'cultural', 'main'). Leave empty to show all groups."
                }
              }
            }
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
        break; // Success
      } catch (err) {
        console.error(`AI Attempt ${attempt} failed:`, err);
        if (attempt === retries) throw err;
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }

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

    if (!message?.content && !toolCallName) {
      console.warn("Gemini returned empty content. Possible safety filter trigger.");
      return { text: "I'm not sure how to answer that! Could you try rephrasing your question?" };
    }

    return { text: message?.content || "" };
  } catch (error: any) {
    console.error("AI Generation Critical Error (All Retries Failed):", error);
    
    // If it's a rate limit from spamming 100 messages, silently drop it so we don't spam back.
    if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota") || error?.message?.includes("rate limit")) {
      return { text: "" };
    }

    // For any other internal error, respond gracefully instead of getting stuck
    return { text: "Wow, that question actually made my circuits pause for a second! My connection to the brain had a hiccup. Could you try asking again?" };
  }
}
