import OpenAI from "openai";
import { COMMUNITY_SYSTEM_PROMPT } from "@/lib/system-prompt";

// Enforce Gemini 2.5 Flash natively using OpenAI SDK
const openai = new OpenAI({
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  apiKey: process.env.GEMINI_API_KEY || "dummy-key-for-build",
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
  audioData?: { base64: string },
  isFirstMessageOfDay: boolean = false
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
    const currentHour = istTime.getHours();
    let timeGreeting = "Good morning";
    if (currentHour >= 12 && currentHour < 17) {
      timeGreeting = "Good afternoon";
    } else if (currentHour >= 17 && currentHour < 21) {
      timeGreeting = "Good evening";
    } else if (currentHour >= 21 || currentHour < 4) {
      timeGreeting = "Good night";
    }

    // ── MULTILINGUAL VOICE NOTE INSTRUCTION ─────────────────────────────────────
    // This is sent as the text prefix WITH the audio blob. Gemini 2.5 Flash has
    // native audio understanding and can transcribe + respond in one pass.
    // The instruction is detailed so it handles all real-world audio scenarios:
    //   - Fast speech, mumbling, background noise
    //   - Slang and colloquial phrases in any language
    //   - Code-switching (mixing Tamil+English, Hindi+English, etc.)
    //   - Mispronunciations and incomplete words
    //   - Accents from different regions of Tamil Nadu and Andhra Pradesh
    const AUDIO_TRANSCRIPTION_INSTRUCTION = `[VOICE MESSAGE — MULTILINGUAL AUDIO UNDERSTANDING]

This resident sent a voice note. You are a multilingual AI fluent in Tamil, Telugu, Hindi, and English — including all regional accents, slang, dialects, and informal speech patterns from Chennai and surrounding areas.

YOUR TASK:
1. LISTEN carefully to the full audio — including any background noise, fast speech, mumbling, or partial words.
2. UNDERSTAND the intent — even if the speaker speaks very fast, cuts words short, uses slang, mixes languages, or pronounces words incorrectly (like "lifttu" for "lift", "ticketu" for "ticket", "compaint" for "complaint", "poollu" for "pool", "maintenanu" for "maintenance").
3. DETECT the primary language spoken:
   - Pure Tamil (spoken by most Chennai residents) → Reply fully in Tamil script
   - Pure Hindi (Devanagari) → Reply fully in Hindi script
   - Pure Telugu → Reply fully in Telugu script
   - Pure English → Reply fully in English
   - Tanglish (Tamil words with English) → Reply in the SAME casual Tanglish style they used
   - Hinglish (Hindi words with English) → Reply in the SAME casual Hinglish style
   - Tenglish (Telugu words with English) → Reply in the SAME casual Tenglish style
4. HANDLE SLANG and colloquial terms intelligently:
   - Tamil slang: "dei", "da", "di", "macha", "pa", "bro", "anna", "akka", "thalaiva", "podu", "sollu", "seri", "illa", "enna", "epdi", "oru", "romba", "nalla" — treat these naturally
   - Hindi slang: "yaar", "bhai", "arre", "kya baat", "suno", "boss", "acha", "theek hai", "bas", "matlab" — treat naturally
   - Telugu slang: "ra", "da", "bro", "anna", "akka", "enti", "cheppandi", "cheyandi", "okati", "sare" — treat naturally
   - Anglicized Indian words: "lift", "complaint", "ticket", "pool", "maintenance", "security", "plumber" spoken with Indian accent — always understand correctly
5. NEVER ask the resident to repeat themselves or to type their question instead. You MUST understand and respond.
6. If even after best effort the audio is completely inaudible or silent, reply with: "I couldn't catch that clearly 🎙️ — could you resend the voice note or just type it out?"

Now listen to the audio and respond to the resident's request:`;

    const detectedLangInstruction = isAudioMessage
      ? "AUDIO: Detect language from audio and reply in that spoken language only."
      : detectLanguage(lastUserText);

    // Tool usage ban — appended directly to the ONE system message
    const toolBanRules = `

TOOL USAGE — STRICT RULES:
NEVER call any tool for: swimming pool rules, gym rules, parking rules, pet rules, quiet hours, amenities, security contacts, escalation matrix, association members, maintenance charges, shop locations, maid contacts, community groups, or ANY info already in the knowledge base.
For those questions: read the knowledge base and reply DIRECTLY. No tools needed.
Tools are ONLY for: create_ticket, check_ticket_status, get_latest_notices (live DB notices), route_shop_order, ask_confirmation_buttons, rsvp_to_event, get_active_polls, get_upcoming_events (live DB events), get_local_services, get_community_groups, submit_poll_vote, get_user_stats, post_classified_ad, get_active_classifieds, send_classified_details.

LANGUAGE RULE (CURRENT MESSAGE):
${isAudioMessage
  ? "This is a VOICE MESSAGE. Detect the spoken language from the audio. Reply ENTIRELY in that spoken language. Match the resident's style — if they spoke Tanglish, reply in Tanglish. If Tamil, reply in Tamil. Do NOT default to any prior conversation language."
  : `Reply ENTIRELY in: ${detectedLangInstruction}`}`;

    // SINGLE system message — Gemini only reads the first system message reliably
    let dynamicSystemPrompt = COMMUNITY_SYSTEM_PROMPT;
    if (isFirstMessageOfDay) {
      dynamicSystemPrompt += `\n\nFIRST MESSAGE OF DAY GREETING (CRITICAL):\nThis is the user's first message of the day. You MUST unconditionally start your response with the exact friendly greeting: "${timeGreeting}!". Do this BEFORE answering their question or fulfilling their request.`;
    } else {
      dynamicSystemPrompt += `\n\nNO GREETING RULE (CRITICAL):\nThis is NOT the first message of the day. The user has already been greeted today or is in an ongoing conversation. You MUST NOT say "Good morning", "Good afternoon", "Good evening", "Hello", or "Hi" in your response. Answer their question directly without any pleasantry preamble.`;
    }

    const formattedMessages: any[] = [
      {
        role: "system",
        content: dynamicSystemPrompt + timeContext + toolBanRules,
      },
      ...messages,
    ];

    // Handle audio attachment on the last user message
    if (formattedMessages.length > 0) {
      const lastMessage = formattedMessages[formattedMessages.length - 1];
      if (lastMessage.role === "user" && audioData) {
        if (typeof lastMessage.content === "string") {
          lastMessage.content = [
            // Use the rich multilingual audio instruction as the text prompt
            { type: "text", text: isAudioMessage ? AUDIO_TRANSCRIPTION_INSTRUCTION : lastMessage.content },
            { type: "input_audio", input_audio: { data: audioData.base64, format: "wav" } }
          ];
        } else if (Array.isArray(lastMessage.content)) {
          // Prepend audio instruction as first text part if not already present
          if (isAudioMessage) {
            const hasText = lastMessage.content.some((c: any) => c.type === "text");
            if (hasText) {
              lastMessage.content[0].text = AUDIO_TRANSCRIPTION_INSTRUCTION;
            } else {
              lastMessage.content.unshift({ type: "text", text: AUDIO_TRANSCRIPTION_INSTRUCTION });
            }
          }
          lastMessage.content.push(
            { type: "input_audio", input_audio: { data: audioData.base64, format: "wav" } }
          );
        }
      }
    }


    let completion: any = null;
    const MAX_RETRIES = 5;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        completion = await openai.chat.completions.create({
          model: "gemini-2.5-flash",
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
                  enum: ["supermarket", "iron_shop"],
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
            name: "ask_custom_buttons",
            description: "Send an interactive message with custom buttons to the user. Use this when you want to give the user multiple specific options to choose from (e.g. 'Wrong Order', 'Wrong Address', 'Both' or 'Raise Ticket', 'No Need').",
            parameters: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "The question or prompt to display above the buttons."
                },
                options: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of button text options (minimum 1, maximum 3 options)."
                }
              },
              required: ["message", "options"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_current_datetime",
            description: "Get the current date and time in IST (Indian Standard Time). MUST be called when user asks about current date, time, today's date, or what time it is.",
            parameters: { type: "object", properties: { execute: { type: "boolean", description: "Set to true" } } }
          }
        },
        {
          type: "function",
          function: {
            name: "create_ticket",
            description: "Create a maintenance or complaint ticket. MUST be called when the user confirms they want to raise a ticket. You MUST extract the issue from their earlier messages to populate the description.",
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
            name: "get_user_stats",
            description: "Fetch the total count of tickets and orders placed by the current user.",
            parameters: { type: "object", properties: { execute: { type: "boolean", description: "Set to true" } } }
          }
        },
        {
          type: "function",
          function: {
            name: "get_latest_notices",
            description: "ONLY use to fetch LIVE community announcements posted by admins in the database. DO NOT use for rules, amenities, contacts, escalation matrix, swimming pool rules, parking rules, pet rules, or anything already in the knowledge base. Those must be answered from the knowledge base directly.",
            parameters: { type: "object", properties: { execute: { type: "boolean", description: "Set to true" } } }
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
            parameters: { type: "object", properties: { execute: { type: "boolean", description: "Set to true" } } }
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
        },
        {
          type: "function",
          function: {
            name: "post_classified_ad",
            description: "Post an item for sale in the community classifieds.",
            parameters: {
              type: "object",
              properties: {
                item_name: { type: "string", description: "The name of the item being sold." },
                description: { type: "string", description: "A short description of the item." },
                price: { type: "string", description: "The price of the item (e.g., 'Rs. 500' or 'Free')." },
                image_id: { type: "string", description: "The WhatsApp Image ID if the user sent an image. IMPORTANT: You MUST ONLY extract this from the MOST RECENT [IMAGE_ID: <id>] tag in the chat history. NEVER use an older image ID from previous messages." },
                seller_name: { type: "string", description: "The name of the seller." }
              },
              required: ["item_name", "description", "price"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_active_classifieds",
            description: "Fetch all active classified ads (items for sale by residents).",
            parameters: { type: "object", properties: { execute: { type: "boolean", description: "Set to true" } } }
          }
        },
        {
          type: "function",
          function: {
            name: "check_maintenance_balance",
            description: "Check the pending maintenance dues for the resident. Use when resident asks about their maintenance balance, dues, or if they have paid.",
            parameters: { type: "object", properties: { execute: { type: "boolean", description: "Set to true" } } }
          }
        },
        {
          type: "function",
          function: {
            name: "report_lost_item",
            description: "Report an item that the user has lost in the community.",
            parameters: {
              type: "object",
              properties: {
                description: { type: "string", description: "Detailed description of the lost item." }
              },
              required: ["description"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "report_found_item",
            description: "Report an item that the user has found in the community.",
            parameters: {
              type: "object",
              properties: {
                description: { type: "string", description: "Detailed description of the found item and where it is kept." }
              },
              required: ["description"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "search_lost_and_found",
            description: "Search the lost and found board to see if an item was reported lost or found.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query or keyword (e.g., 'keys', 'bottle', 'watch')." }
              },
              required: ["query"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "broadcast_emergency",
            description: "ADMIN ONLY: Broadcast an emergency message to all residents of a specific block.",
            parameters: {
              type: "object",
              properties: {
                block_number: { type: "string", description: "The block number to broadcast to (e.g., 'A1', 'B2', or 'ALL' for everyone)." },
                message: { type: "string", description: "The emergency message content to broadcast." }
              },
              required: ["block_number", "message"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "send_classified_details",
            description: "Send the image and full details of a specific classified ad to the buyer. Call this when a buyer asks to buy or see a specific item from the active classifieds.",
            parameters: {
              type: "object",
              properties: {
                classified_id: { type: "string", description: "The UUID of the classified ad." }
              },
              required: ["classified_id"]
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
            text: message?.content || "", // Preserving AI text if it answered multiple questions simultaneously
            tool_call: {
              name: toolCallName,
              args: args
            }
          };
        }

        if (!message?.content && !toolCallName) {
          const finishReason = completion?.choices?.[0]?.finish_reason || "unknown";
          if (finishReason === "stop") {
            // Gemini returned stop+empty (no text, no tool call).
            // This happens when it wants to call a tool but something blocks it.
            // Fix: retry once with tool_choice:"none" to force a text-only response.
            // The model will understand the message and reply intelligently in text.
            console.warn("Gemini returned stop+empty. Retrying with tool_choice:none to force text response.");
            try {
              const fallbackCompletion = await openai.chat.completions.create({
                model: "gemini-2.5-flash",
                messages: messages as any,
                temperature: 0.7,
                max_tokens: 1000,
                tool_choice: "none" // Force text-only, no tool calls
              });
              const fallbackContent = fallbackCompletion.choices[0]?.message?.content?.trim();
              if (fallbackContent) {
                console.log("Fallback text response succeeded.");
                return { text: fallbackContent };
              }
            } catch (fallbackErr) {
              console.error("Fallback call also failed:", fallbackErr);
            }
            // If even the fallback fails, return a generic message
            return { text: "I understand your concern! Please type your question once more and I'll help you right away. 😊" };
          }
          console.warn(`Gemini returned empty content. Possible safety filter trigger. Reason: ${finishReason}`);
          return { text: `I'm not sure how to answer that! Could you try rephrasing your question? (Error: ${finishReason})` };
        }

        const finalContent = message?.content || "";
        if (finalContent.includes("[IGNORE_SPAM]")) {
          console.log("Semantic spam detected, ignoring.");
          return { text: "" };
        }
        return { text: finalContent };
      } catch (err: any) {
        const status = err?.status ?? 0;
        console.error(`AI Attempt ${attempt}/${MAX_RETRIES} failed (status ${status}):`, err?.message ?? err);

        if (attempt === MAX_RETRIES) {
          // All retries exhausted — surface a helpful reply to the user instead of silence
          // 429 = quota/rate-limit (user was spamming, drop silently)
          if (status === 429 || err?.message?.includes("429") || err?.message?.includes("quota") || err?.message?.includes("rate limit")) {
            return { text: "" }; // Silent drop for spam rate-limits
          }
          // For any other failure (503 overload, network blip, etc.) tell the user clearly
          console.error("AI Generation Critical Error (All Retries Failed):", err);
          return { text: "Sorry, I'm having a little trouble connecting right now! 🔄 Please send your message again and I'll get it sorted immediately. 😊" };
        }

        // Smart backoff based on error type:
        // 503 = Gemini momentarily overloaded → retry quickly (1s, 2s, 4s …)
        // 429 = rate limit → wait longer before retry (3s, 9s, 27s …)
        // Other → standard exponential backoff
        let waitMs: number;
        if (status === 503 || err?.message?.includes("503")) {
          waitMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s, 8s
        } else if (status === 429 || err?.message?.includes("429") || err?.message?.includes("rate limit")) {
          waitMs = Math.pow(3, attempt) * 1000;      // 3s, 9s, 27s, 81s
        } else {
          waitMs = Math.pow(2, attempt) * 500;       // 1s, 2s, 4s, 8s
        }
        console.log(`Waiting ${waitMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  } catch (error: any) {
    console.error("Unexpected outer error in getAIResponse:", error);
    return { text: "Sorry, I'm having a little trouble connecting right now! 🔄 Please send your message again and I'll get it sorted immediately. 😊" };
  }
  
  return { text: "" };
}

export async function translateToolResponse(englishText: string, userMessage: string, contextMessage?: string): Promise<string> {
  let sourceTextForLanguage = userMessage;
  if (userMessage.startsWith("[Voice Message]") && contextMessage) {
    sourceTextForLanguage = contextMessage;
  }
  
  const langInstructions = detectLanguage(sourceTextForLanguage);
  if (langInstructions.startsWith("English")) return englishText;

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: `Translate the following system message according to this instruction: ${langInstructions}. Keep emojis and formatting intact. ONLY output the translation, nothing else.` },
          { role: "user", content: englishText }
        ],
        temperature: 0.1,
      });
      return completion.choices[0]?.message?.content?.trim() || englishText;
    } catch (e: any) {
      lastError = e;
      console.warn(`Translation attempt ${attempt} failed:`, e?.message || e);
      if (attempt < 3) {
        await new Promise(res => setTimeout(res, 1000 * attempt)); // wait 1s, 2s
      }
    }
  }
  
  console.error("Translation completely failed after retries:", lastError);
  return englishText;
}
