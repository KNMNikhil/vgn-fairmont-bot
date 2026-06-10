import { NextRequest, after } from "next/server";
import crypto from "node:crypto";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage, downloadWhatsAppMedia, sendWhatsAppPoll, markWhatsAppMessageRead, sendWhatsAppReaction } from "@/lib/whatsapp";
import { getAIResponse, translateToolResponse } from "@/lib/ai";
import { scrubPII } from "@/lib/privacy";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60; // Allow function to run up to 60 seconds to prevent Vercel timeouts

// Module-level KB cache — loaded once per serverless instance, not on every request
let _kbCache: Record<string, any> | null = null;
async function getKB(): Promise<Record<string, any>> {
  if (_kbCache) return _kbCache;
  const fs = await import('fs/promises');
  const path = await import('path');
  const kbPath = path.join(process.cwd(), 'src', 'data', 'vgn_fairmont_kb.json');
  _kbCache = JSON.parse(await fs.readFile(kbPath, 'utf-8'));
  return _kbCache!;
}

// Greeting pattern — used for DB-level spam deduplication
const GREETING_REGEX = /^(hi+|hey+|hello+|hola|yo+|hoo+|hyy+|heyy+|heyyy+|hiii+|heyyo|hellouu|sup|wassup|what'?s up|howdy|greetings|namaste|vanakkam|hai|ok+|hmm+|hm+|ah+|oh+|ugh|k|kk|👋|🙏|😊)[\.!\?\s]*$/i;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  // 1. Get raw body for cryptographic signature verification
  const rawBody = await request.text();
  
  // 2. Verify Meta's Digital Wax Seal (X-Hub-Signature-256)
  const signature = request.headers.get("x-hub-signature-256");
  const appSecret = process.env.META_APP_SECRET;

  if (appSecret && signature) {
    const expectedSignature = `sha256=${crypto
      .createHmac("sha256", appSecret)
      .update(rawBody)
      .digest("hex")}`;
      
    if (signature !== expectedSignature) {
      console.error("CRITICAL SECURITY ALERT: Webhook signature spoofing detected! Rejecting request.");
      return new Response("Unauthorized", { status: 401 });
    }
  } else if (!appSecret) {
    console.warn("SECURITY WARNING: META_APP_SECRET is not set. Skipping signature verification. THIS IS INSECURE IN PRODUCTION.");
  }

  // 3. Parse the verified JSON body
  const body = JSON.parse(rawBody);

  // Only process whatsapp_business_account events
  if (body.object !== "whatsapp_business_account") {
    return Response.json({ status: "ignored" });
  }

  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  // Only process actual messages (not status updates)
  if (!value?.messages?.[0]) {
    return Response.json({ status: "no_message" });
  }

  const message = value.messages[0];
  const isAudio = message.type === "audio";

  const phone = message.from;
  const contact = value.contacts?.[0];

  const isPollResponse = message.type === "interactive" && message.interactive?.type === "button_reply";
  const isEventResponse = message.type === "interactive" && message.interactive?.type === "event_rsvp";
  const isFeedbackPoll = isPollResponse && message.interactive?.button_reply?.id?.startsWith('feedback_');
  
  let text = "";
  if (isAudio) {
    text = message.audio?.id ? `[Voice Message] [AUDIO_ID: ${message.audio.id}]` : "[Voice Message]";
  } else if (isEventResponse) {
    // Handle native event RSVP response
    const eventRsvp = message.interactive?.event_rsvp;
    const eventId = eventRsvp?.event_id || '';
    const rsvpStatus = eventRsvp?.rsvp_status || 'going'; // 'going', 'not_going', or 'maybe'
    
    // Find event in database and register RSVP
    const { data: event } = await supabase.from("community_events")
      .select("*")
      .eq("id", eventId)
      .single();
    
    if (event) {
      await supabase.from("event_rsvps").upsert({
        event_id: event.id,
        phone,
        name: contact?.profile?.name || null,
        status: rsvpStatus,
        guests_count: 1
      }, { onConflict: 'event_id,phone' });
      
      const statusMessage = rsvpStatus === 'going' ? 'Great! See you there! 🎉' : 
                           rsvpStatus === 'maybe' ? 'Thanks for letting us know!' : 
                           'Thanks for the update!';
      await sendWhatsAppMessage(phone, statusMessage);
    } else {
      await sendWhatsAppMessage(phone, "Noted.");
    }
    
    return Response.json({ status: "event_rsvp_acknowledged" });
  } else  if (isFeedbackPoll) {
    // Handle satisfaction feedback poll response (format: feedback_TICKETID_RATING)
    const buttonReply = message.interactive?.button_reply;
    const buttonId = buttonReply?.id || '';
    const parts = buttonId.split('_');
    const ticketId = parts[1];
    const rating = parseInt(parts[2] || '0');

    // Store the rating in the ticket
    await supabase.from('tickets')
      .update({ feedback_rating: rating })
      .ilike('id', `${ticketId}%`);

    if (rating <= 2) {
      // Low rating — ask why
      await sendWhatsAppMessage(phone, `We're really sorry to hear that! 😔 Could you tell us what went wrong so we can improve? Your feedback helps us serve you better. 🙏`);
      // Store a pending feedback_comment marker so next message is captured as comment
      await supabase.from('tickets')
        .update({ feedback_comment: 'PENDING' })
        .ilike('id', `${ticketId}%`);
    } else if (rating === 3) {
      await sendWhatsAppMessage(phone, `Thank you for your feedback! ⭐⭐⭐ We'll keep working to improve our service. 🙏`);
    } else {
      await sendWhatsAppMessage(phone, `Thank you for your kind feedback! ${rating === 5 ? '⭐⭐⭐⭐⭐ Excellent!' : '⭐⭐⭐⭐ Great!'} We're glad we could help. 😊`);
    }
    return Response.json({ status: 'feedback_recorded' });
  } else if (isPollResponse) {
    // Handle poll/RSVP button response
    const buttonReply = message.interactive?.button_reply;
    const buttonId = buttonReply?.id || '';
    const selectedOption = buttonReply?.title || 'Unknown';
    
    // Parse button ID to check if it's an event RSVP (format: event_ID_STATUS)
    if (buttonId.startsWith('event_')) {
      const parts = buttonId.split('_');
      if (parts.length >= 3) {
        const eventId = parts[1];
        const status = parts[2]; // 'going', 'maybe', 'notgoing'
        
        // Find event and register RSVP
        const { data: event } = await supabase.from("community_events")
          .select("*")
          .ilike("id", `${eventId}%`)
          .single();
        
        if (event) {
          await supabase.from("event_rsvps").upsert({
            event_id: event.id,
            phone,
            name: contact?.profile?.name || null,
            status: status === 'notgoing' ? 'not_going' : status,
            guests_count: 1
          }, { onConflict: 'event_id,phone' });
        }
      }
      
      // Send immediate acknowledgment
      await sendWhatsAppMessage(phone, "Noted.");
      
      // Return early to skip AI processing
      return Response.json({ status: "poll_response_acknowledged" });
    } else if (buttonId.startsWith('ai_reply_')) {
      const contextId = message.context?.id;
      if (contextId) {
        // Prevent clicking multiple buttons on the same prompt or clicking old buttons
        const { data: promptMsg } = await supabase
          .from("messages")
          .select("created_at")
          .eq("whatsapp_msg_id", contextId)
          .single();
          
        if (promptMsg) {
          const { data: convo } = await supabase
            .from("conversations")
            .select("id")
            .eq("phone", phone)
            .single();

          if (convo) {
            const { data: newerUserMsgs } = await supabase
              .from("messages")
              .select("id")
              .eq("conversation_id", convo.id)
              .eq("role", "user")
              .gt("created_at", promptMsg.created_at)
              .limit(1);
            
          if (newerUserMsgs && newerUserMsgs.length > 0) {
            console.log(`Ignoring duplicate/late button click for context ${contextId}`);
            await sendWhatsAppMessage(phone, "You've already responded to this prompt or sent a newer message. Please continue the chat below! 👇");
            return Response.json({ status: "ignored_late_button_click" });
          }
        }
        }
      }
      
      // Treat this as normal text from the user for the AI to process
      text = selectedOption;
    } else {
      // Send immediate acknowledgment for unknown buttons
      await sendWhatsAppMessage(phone, "Noted.");
      return Response.json({ status: "poll_response_acknowledged" });
    }
  } else {
    text = message.text?.body;
    let imageIdString = "";
    if (message.type === "image" && message.image?.id) {
      imageIdString = ` [IMAGE_ID: ${message.image.id}]`;
    }

    if (!text) {
      if (message.type === "image") text = (message.image?.caption || "[User sent an image]") + imageIdString;
      else if (message.type === "video") text = message.video?.caption || "[User sent a video]";
      else if (message.type === "document") text = message.document?.caption || "[User sent a document]";
      else if (message.type === "location") text = "[User sent a location]";
      else if (message.type === "sticker") text = "[User sent a sticker]";
      else text = `[User sent a ${message.type || 'unknown'} message]`;
    } else {
      text += imageIdString;
    }
  }
  
  const name = contact?.profile?.name || null;
  const whatsappMsgId = message.id;

  // Immediately mark as read and show ⏳ processing indicator (fire and forget)
  markWhatsAppMessageRead(whatsappMsgId);
  sendWhatsAppReaction(phone, whatsappMsgId, "⏳");

  // Check for unparliamentary language
  if (text) {
    const unparliamentaryWords = ["idiot", "fool", "stupid", "dumb", "fuck", "shit", "bitch", "bastard", "asshole", "moron", "jerk", "shut up"];
    const lowerText = text.toLowerCase();
    let detectedWord = null;
    
    for (const word of unparliamentaryWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(lowerText)) {
        detectedWord = word;
        break;
      }
    }

    if (detectedWord) {
      // Send alert to admin
      const adminPhone = process.env.ADMIN_PHONE_NUMBER || "918056240206"; // User specified admin number
      const alertMessage = `🚨 *SECURITY ALERT* 🚨\n\nUnparliamentary language detected in VGN Fairmont Bot!\n\n*Phone Number:* ${phone}\n*Name:* ${name || "Unknown"}\n*Word Used:* "${detectedWord}"\n*Full Message:* "${text}"`;
      
      // Fire and forget alert
      sendWhatsAppMessage(adminPhone, alertMessage).catch(err => console.error("Failed to send admin alert:", err));
      
      // We will still let the AI process the message, as the system prompt has specific instructions for disrespectful queries.
    }
  }

  // Decouple webhook response from slow AI processing
  const immediateResponse = Response.json({ status: "processing_in_background" });
  after(async () => {
  try {
    // 1. Maintenance Mode / Kill Switch
    if (process.env.MAINTENANCE_MODE === 'true') {
      console.warn(`Maintenance mode active. Dropping message from ${phone}`);
      await sendWhatsAppMessage(phone, "System maintenance in progress. I will be back online shortly! 🛠️");
      return Response.json({ status: "maintenance_mode" });
    }

    // 2. Rate Limiting Check
    const rateLimit = await checkRateLimit(phone);
    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for phone ${phone}.`);
      await sendWhatsAppMessage(phone, "Whoa, you're typing really fast! 🏃‍♂️ Give me a few seconds to process all of that and try again in a minute.");
      return Response.json({ status: "rate_limited" });
    }

    // 3. PII Scrubbing
    if (text) {
      const originalText = text;
      text = scrubPII(text);
      if (originalText !== text) {
        console.log(`PII scrubbed from message for phone ${phone}`);
      }
    }

    // Find or create conversation
    let conversation;
    try {
      let { data: existingConvo, error: fetchError } = await supabase
        .from("conversations")
        .select("*")
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();
        
      if (fetchError) {
        console.error("Supabase fetch error:", fetchError);
        throw fetchError;
      }

      if (!existingConvo) {
        const { data: newConvo, error: insertConvoError } = await supabase
          .from("conversations")
          .insert({ phone, name })
          .select()
          .single();
          
        if (insertConvoError) {
          console.error("Supabase insert conversation error:", insertConvoError);
          throw insertConvoError;
        }
        conversation = newConvo;
      } else {
        conversation = existingConvo;
      }
    } catch (err) {
      console.error("Critical database error resolving conversation:", err);
      // Fallback: send error message to user, return 200 so WhatsApp doesn't retry
      await sendWhatsAppMessage(phone, "System maintenance in progress. I will be back online shortly! 🛠️");
      return Response.json({ status: "database_error_handled" });
    }

    if (!conversation) {
      return Response.json({ error: "Failed to create conversation" }, { status: 500 });
    }

    if (conversation.is_blocked) {
      // Send a final message to the user that they are blocked, as requested
      await sendWhatsAppMessage(phone, "You have been blocked from using this bot.");
      return Response.json({ status: "blocked_user" });
    }

    // Store user message (ignore duplicates)
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: text,
      whatsapp_msg_id: whatsappMsgId,
    });

    if (insertError?.code === "23505") {
      // Duplicate message, ignore
      return Response.json({ status: "duplicate" });
    }

    // Check if user has a pending feedback comment request
    if (text) {
      const { data: pendingTicket } = await supabase.from("tickets")
        .select("id")
        .eq("phone", phone)
        .eq("feedback_comment", "PENDING")
        .single();
        
      if (pendingTicket) {
        await supabase.from("tickets")
          .update({ feedback_comment: text })
          .eq("id", pendingTicket.id);
          
        await sendWhatsAppMessage(phone, "Thank you for the details. We have noted this down and the management will review it. 🙏");
        return Response.json({ status: "feedback_comment_saved" });
      }
    }

    // Update conversation timestamp + name in ONE batched async write (not blocking)
    const pendingPromises: any[] = [];
    const conversationUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name && name !== conversation.name) {
      conversationUpdates.name = name; // Batch name update instead of blocking await
    }
    pendingPromises.push(supabase
      .from("conversations")
      .update(conversationUpdates)
      .eq("id", conversation.id));

    // If mode is 'human', don't auto-reply
    if (conversation.mode === "human") {
      await Promise.allSettled(pendingPromises);
      return Response.json({ status: "stored_for_human" });
    }

    // Fetch history and audio in parallel
    const historyPromise = supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(20);

    let audioPromise: Promise<{ base64: string, mimeType: string } | undefined> = Promise.resolve(undefined);
    if (isAudio && message.audio?.id) {
      audioPromise = downloadWhatsAppMedia(message.audio.id).catch(err => {
        console.error("Failed to download audio:", err);
        return undefined;
      });
    }

    const [{ data: rawHistory }, audioResult] = await Promise.all([historyPromise, audioPromise]);
    const history = (rawHistory || []).reverse();
    const audioData = audioResult;

    let isFirstMessageOfDay = true;
    if (rawHistory && rawHistory.length > 1) {
      // Current message is at index 0, previous is at index 1
      const prevDate = new Date(rawHistory[1].created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      const currDate = new Date(rawHistory[0].created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      if (prevDate === currDate) {
        isFirstMessageOfDay = false;
      }
    }

    // ─── DB-LEVEL GREETING SPAM DEDUPLICATION ─────────────────────────────────
    // Logic:
    // 1. Look at the last 15 seconds of messages from this user.
    // 2. Walk BACKWARDS from the current (latest) message.
    // 3. Count only the UNBROKEN consecutive streak of greetings at the end.
    //    - If a non-greeting message appears in between, the streak RESETS.
    // 4. If the current message is part of a consecutive greeting streak of >1,
    //    drop it. But if a non-greeting broke the chain before this, treat this
    //    greeting as fresh (streak of 1) and let it through.
    //
    // Example: ["Hi", "Hola", "Escalation matrix", "Hey"]
    //  - "Hi"   → streak=1 → reply ✅
    //  - "Hola" → streak=2, all greetings → drop ❌
    //  - "Escalation matrix" → not a greeting → reply ✅ (streak reset to 0)
    //  - "Hey"  → streak=1 (chain was broken by "escalation matrix") → reply ✅
    if (text && !isAudio && GREETING_REGEX.test(text.trim())) {
      const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString();
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("whatsapp_msg_id, content, created_at")
        .eq("conversation_id", conversation.id)
        .eq("role", "user")
        .gte("created_at", fifteenSecondsAgo)
        .order("created_at", { ascending: true }); // oldest → newest

      if (recentMessages && recentMessages.length > 1) {
        // Walk backwards from the end to find the unbroken consecutive greeting streak.
        // Stop as soon as we hit a non-greeting message.
        let consecutiveGreetingStreak = 0;
        for (let i = recentMessages.length - 1; i >= 0; i--) {
          const content = (recentMessages[i].content || "").trim();
          if (GREETING_REGEX.test(content)) {
            consecutiveGreetingStreak++;
          } else {
            // A different message broke the streak — stop counting
            break;
          }
        }

        // If there are 2+ consecutive greetings at the end AND current message
        // is not the first one in that streak, drop it.
        if (consecutiveGreetingStreak > 1) {
          // The first message in the streak is at index: (length - consecutiveGreetingStreak)
          const firstInStreak = recentMessages[recentMessages.length - consecutiveGreetingStreak];
          if (firstInStreak && firstInStreak.whatsapp_msg_id !== whatsappMsgId) {
            console.log(`DB spam dedup: dropping greeting "${text}" — consecutive streak of ${consecutiveGreetingStreak}, not the first.`);
            sendWhatsAppReaction(phone, whatsappMsgId, ""); // Remove ⏳
            return Response.json({ status: "dropped_greeting_not_first" });
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────


    // Get AI response
    const aiResponse = await getAIResponse(
      history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      audioData,
      isFirstMessageOfDay
    );

    let replyText = "";
    let conversationalText = "";
    let skipSend = false;
    let botMsgId: string | undefined = undefined;
    let pendingPollArgs: { phone: string, message: string, options: any[] } | null = null;

    if (aiResponse.tool_call) {
      const toolName = aiResponse.tool_call.name;
      const args = aiResponse.tool_call.args;

      try {
        if (toolName === "get_current_datetime") {
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const timeStr = now.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          });
          replyText = `📅 Today is ${dateStr}\n🕐 Current time is ${timeStr} IST`;
        } else if (toolName === "ask_custom_buttons") {
          const options = Array.isArray(args.options) ? args.options.slice(0, 3) : [];
          // BUG FIX: Don't send the poll immediately! Store it to send after text.
          pendingPollArgs = {
            phone,
            message: args.message,
            options: options.map((opt: string) => ({
              id: "ai_reply_" + opt.toLowerCase().replace(/[^a-z0-9]/g, '_'),
              title: opt
            }))
          };
          replyText = args.message; // Save it to the DB so we have history context
          skipSend = true; // Button sent natively
        } else if (toolName === "route_shop_order") {
        const targetPhone = args.shop_type === "supermarket" 
          ? (process.env.SUPERMARKET_NUMBER || "919677197402")
          : (process.env.IRON_SHOP_NUMBER || "919677197402");

        // Get current IST date and time for order - CORRECTED
        const now = new Date();
        const orderDateTime = now.toLocaleString('en-US', { 
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        if (targetPhone) {
          const orderMessage = `*New Order from Resident*\nName: ${name || "Resident"}\nPhone: ${phone}\nFlat: ${args.flat_number}\nItem: ${args.item}\nDate & Time: ${orderDateTime} IST`;
          const shopRes = await sendWhatsAppMessage(targetPhone, orderMessage);
          
          if (shopRes.error) {
            console.error("Shop Message Failed:", shopRes.error);
            replyText = `⚠️ I tried to send your order, but the ${args.shop_type.replace("_", " ")} owner's WhatsApp window is closed. They need to message me first so I can forward your orders!`;
          } else {
            replyText = `✅ Your order has been placed!\n\n📦 *Order Details:*\nItem: ${args.item}\nFlat: ${args.flat_number}\nShop: ${args.shop_type.replace("_", " ").toUpperCase()}\n📅 Date & Time: ${orderDateTime} IST\n\nThe shop will deliver it soon!`;
            // Insert into orders table to track
            await supabase.from("orders").insert({
              phone,
              shop_type: args.shop_type,
              item: args.item,
              flat_number: args.flat_number
            });
          }
        } else {
          replyText = `I'm sorry, but the phone number for the ${args.shop_type.replace("_", " ")} is not currently configured.`;
        }
      } else if (toolName === "post_classified_ad") {
        // Post a classified ad
        const { data, error } = await supabase.from("classifieds").insert({
          phone,
          seller_name: args.seller_name || name || "Resident",
          item_name: args.item_name,
          description: args.description,
          price: args.price,
          image_id: args.image_id || null,
          status: 'active'
        }).select().single();
        
        if (error) {
          console.error("Classifieds error:", error);
          replyText = "Sorry, I couldn't post your classified ad right now. Please try again later.";
        } else {
          replyText = `✅ Your classified ad for *${args.item_name}* has been successfully posted to the community board!\n\nPrice: ${args.price}\nDescription: ${args.description}\n\nOther residents can now contact you.`;
        }
      } else if (toolName === "get_active_classifieds") {
        const { data, error } = await supabase.from("classifieds")
          .select("id, item_name, description, price, seller_name")
          .eq("status", "active")
          .order("created_at", { ascending: false });
          
        if (error || !data || data.length === 0) {
          replyText = "There are currently no items for sale in the community classifieds.";
        } else {
          replyText = "Here are the items currently for sale:\n\n" + data.map(item => 
            `🛒 *${item.item_name}*\n💰 Price: ${item.price}\n📝 Desc: ${item.description}\n👤 Seller: ${item.seller_name}\nID: ${item.id}\n`
          ).join("\n");
        }
      } else if (toolName === "send_classified_details") {
        const { data: item, error } = await supabase.from("classifieds")
          .select("*")
          .eq("id", args.classified_id)
          .single();
          
        if (error || !item) {
          replyText = "I couldn't find that classified ad. It may have been sold or removed.";
        } else {
          // Send message directly with image if available
          const messageText = `🛒 *Classified Ad: ${item.item_name}*\n\n💰 *Price:* ${item.price}\n📝 *Description:* ${item.description || 'N/A'}\n👤 *Seller:* ${item.seller_name || 'Resident'}\n📞 *Contact:* +${item.phone}\n\nYou can reach out to the seller directly on their number!`;
          
          await sendWhatsAppMessage(phone, messageText, item.image_id || undefined);
          replyText = `I have sent you the details and photo of the ${item.item_name} directly to your chat!`;
        }
      } else if (toolName === "create_ticket") {
        // Get current IST date and time for ticket
        const now = new Date();
        const ticketDateTime = now.toLocaleString('en-US', { 
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        // Smart ticket priority classification
        const descLower = (args.description || '').toLowerCase();
        let priority = 'green';
        let priorityEmoji = '🟢';
        let priorityLabel = 'Low Priority';

        const redKeywords = ['lift', 'elevator', 'water leak', 'gas leak', 'fire', 'flood', 'safety', 'power failure', 'electric shock', 'electrical hazard', 'short circuit', 'burst pipe', 'emergency', 'danger', 'accident', 'injury', 'sewage overflow', 'generator failure'];
        const yellowKeywords = ['door', 'lock', 'paint', 'painting', 'plumb', 'ac ', 'air condition', 'noise', 'fan', 'light', 'bulb', 'window', 'seepage', 'damp', 'crack', 'repair', 'broken', 'not working', 'wifi', 'internet', 'cctv', 'intercom'];

        if (redKeywords.some(kw => descLower.includes(kw))) {
          priority = 'red';
          priorityEmoji = '🔴';
          priorityLabel = 'URGENT';
        } else if (yellowKeywords.some(kw => descLower.includes(kw))) {
          priority = 'yellow';
          priorityEmoji = '🟡';
          priorityLabel = 'Medium Priority';
        }

        const { data, error } = await supabase.from("tickets").insert({
          phone,
          description: args.description,
          status: 'open',
          priority
        }).select().single();
        if (error) {
          console.error("Ticket error:", error);
          replyText = "Sorry, I couldn't log your ticket right now. Please try again later.";
        } else {
          replyText = `Your ticket has been logged successfully! 🎫\n\n*Ticket Details:*\nTicket ID: ${data.id.split('-')[0]}\nIssue/Reason: ${args.description}\nPriority: ${priorityEmoji} ${priorityLabel}\nStatus: Open\n📅 Logged on: ${ticketDateTime} IST\n\n${priority === 'red' ? '🚨 This is marked URGENT and the team has been alerted immediately!' : priority === 'yellow' ? '🔧 This will be addressed by the maintenance team soon.' : '✅ We have received your feedback and will look into it.'}`;
        }
      } else if (toolName === "check_ticket_status") {
        const { data, error } = await supabase.from("tickets")
          .select("*")
          .ilike("id", `${args.ticket_id}%`)
          .single();
        if (error || !data) {
          replyText = `I couldn't find a ticket with ID "${args.ticket_id}".`;
        } else {
          replyText = `*Ticket Status* 🎫\n*ID:* ${data.id.split('-')[0]}\n*Issue:* ${data.description}\n*Status:* ${data.status.toUpperCase()}\n*Logged:* ${new Date(data.created_at).toLocaleDateString()}`;
        }
      } else if (toolName === "check_maintenance_balance") {
        const { data, error } = await supabase.from("maintenance_dues")
          .select("amount_due, due_date, flat_number")
          .eq("phone_number", phone)
          .eq("status", "unpaid")
          .single();
        if (error || !data) {
          replyText = "Great news! You have no pending maintenance dues recorded.";
        } else {
          replyText = `🧾 *Maintenance Dues*\n\nFlat: ${data.flat_number}\nAmount Due: ₹${data.amount_due}\nDue Date: ${new Date(data.due_date).toLocaleDateString()}\n\nPlease pay at your earliest convenience to avoid late fees.`;
        }
      } else if (toolName === "report_lost_item") {
        const { error } = await supabase.from("lost_and_found").insert({
          item_type: "lost",
          description: args.description,
          reported_by_phone: phone,
          status: "open"
        });
        if (error) {
          replyText = "Sorry, I couldn't record your lost item. Please try again.";
        } else {
          replyText = `✅ I've recorded your lost item: "${args.description}". If anyone finds it, they can report it here and we'll check!`;
        }
      } else if (toolName === "report_found_item") {
        const { error } = await supabase.from("lost_and_found").insert({
          item_type: "found",
          description: args.description,
          reported_by_phone: phone,
          status: "open"
        });
        if (error) {
          replyText = "Sorry, I couldn't record the found item. Please try again.";
        } else {
          replyText = `✅ Thank you! I've recorded the found item: "${args.description}". We'll let you know if someone claims it.`;
        }
      } else if (toolName === "search_lost_and_found") {
        const { data, error } = await supabase.from("lost_and_found")
          .select("*")
          .eq("status", "open")
          .ilike("description", `%${args.query}%`)
          .limit(5);
        if (error || !data || data.length === 0) {
          replyText = `No active lost or found reports matching "${args.query}" were found.`;
        } else {
          replyText = `🔍 *Lost & Found Results:*\n\n` + data.map((item: any) => `*${item.item_type.toUpperCase()}:* ${item.description}\n_Reported on ${new Date(item.created_at).toLocaleDateString()}_`).join("\n\n");
        }
      } else if (toolName === "broadcast_emergency") {
        // ADMIN CHECK - replace with actual admin numbers in production
        const adminNumbers = (process.env.ADMIN_NUMBERS || "919677197402").split(",");
        if (!adminNumbers.includes(phone)) {
          replyText = "❌ You do not have permission to use the emergency broadcast command.";
        } else {
          let query = supabase.from("residents").select("phone_number");
          if (args.block_number && args.block_number.toUpperCase() !== "ALL") {
            query = query.ilike("block_number", `%${args.block_number}%`);
          }
          const { data: residents, error } = await query;
          
          if (error || !residents || residents.length === 0) {
            replyText = `No residents found registered for block ${args.block_number}.`;
          } else {
            // Note: Since this is outside the 24-hour window, it requires an approved Utility Template.
            const broadcastMessage = `🚨 *EMERGENCY BROADCAST*\n\n${args.message}\n\n_Sent by Community Administration_`;
            
            // In a real scenario, you'd queue this to avoid rate limits, but for demo:
            let successCount = 0;
            for (const res of residents) {
              try {
                await sendWhatsAppMessage(res.phone_number, broadcastMessage);
                successCount++;
              } catch (e) {
                console.error("Broadcast fail for", res.phone_number);
              }
            }
            replyText = `✅ Broadcast initiated for ${successCount} residents in Block ${args.block_number.toUpperCase()}.`;
          }
        }
      } else if (toolName === "get_user_stats") {
        const { count: ticketCount, error: ticketError } = await supabase.from("tickets")
          .select('*', { count: 'exact', head: true })
          .eq("phone", phone);
          
        const { count: orderCount, error: orderError } = await supabase.from("orders")
          .select('*', { count: 'exact', head: true })
          .eq("phone", phone);

        if (ticketError || orderError) {
          console.error("Stats fetch error:", ticketError, orderError);
          replyText = "Sorry, I couldn't fetch your statistics right now. Please try again later.";
        } else {
          replyText = `📊 *Your Activity Stats:*\n\n🎫 Tickets Raised: ${ticketCount || 0}\n📦 Orders Placed: ${orderCount || 0}\n\nThank you for being an active resident!`;
        }
      } else if (toolName === "get_latest_notices") {
        const { data, error } = await supabase.from("notices").select("*").order("created_at", { ascending: false }).limit(3);
        if (error || !data || data.length === 0) {
          replyText = "There are no recent notices right now.";
        } else {
          replyText = "*📢 Latest Community Notices*\n\n" + data.map((n: { title: string, content: string, created_at: string }) => `*${n.title}*\n${n.content}\n_Date: ${new Date(n.created_at).toLocaleDateString()}_`).join("\n\n");
        }
      } else if (toolName === "get_local_services") {
        let query = supabase.from("services").select("*");
        if (args.category) {
          query = query.ilike("category", `%${args.category}%`);
        }
        const { data, error } = await query;
        if (error || !data || data.length === 0) {
          replyText = "I couldn't find any services matching your request in the directory.";
        } else {
          replyText = "*🛠️ Trusted Local Services*\n\n" + data.map((s: { category: string, name: string, contact: string }) => `*${s.category}:* ${s.name}\n📞 ${s.contact}`).join("\n\n");
        }
      } else if (toolName === "get_active_polls") {
        const { data, error } = await supabase.from("polls").select("*").eq("is_active", true);
        if (error || !data || data.length === 0) {
          replyText = "There are no active polls right now.";
        } else {
          // Send native WhatsApp polls
          for (const poll of data) {
            await sendWhatsAppPoll(phone, poll.question, poll.options);
          }
          replyText = `📊 I've sent ${data.length} active poll(s) above. Please vote directly in the poll!`;
        }
      } else if (toolName === "get_upcoming_events") {
        const daysAhead = args.days_ahead || 30;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);
        
        const { data, error } = await supabase.from("community_events")
          .select("*")
          .eq("status", "scheduled")
          .gte("event_date", new Date().toISOString().split('T')[0])
          .lte("event_date", futureDate.toISOString().split('T')[0])
          .order("event_date", { ascending: true });
          
        if (error || !data || data.length === 0) {
          replyText = "There are no upcoming events in the next " + daysAhead + " days.";
        } else {
          // Send native WhatsApp event cards
          for (const e of data) {
            const eventDateTime = new Date(e.event_date + 'T' + e.event_time);
            // End time: assume 2 hours duration if not specified
            const endDateTime = new Date(eventDateTime.getTime() + (2 * 60 * 60 * 1000));
            
            const formattedDate = eventDateTime.toLocaleString('en-US', {
              timeZone: 'Asia/Kolkata',
              weekday: 'short', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit', hour12: true
            });
            const question = `🎉 *${e.title}*\n📍 Location: ${e.location}\n🕒 Time: ${formattedDate}\n\n${e.description || ""}\n\nWill you be attending?`;

            await sendWhatsAppPoll(phone, question, [
              { id: `event_${e.id}_going`, title: "Going ✅" },
              { id: `event_${e.id}_maybe`, title: "Maybe 🤷" },
              { id: `event_${e.id}_notgoing`, title: "Not Going ❌" }
            ]);
          }
          replyText = data.length === 1 
            ? "📅 Here's the upcoming event! Please use the buttons above to RSVP." 
            : `📅 Here are ${data.length} upcoming events! Please use the buttons above to RSVP for each one.`;
        }
      } else if (toolName === "rsvp_to_event") {
        const { data: event, error: eventError } = await supabase.from("community_events")
          .select("*")
          .ilike("id", `${args.event_id}%`)
          .single();
          
        if (eventError || !event) {
          replyText = `I couldn't find an event with ID "${args.event_id}".`;
        } else {
          const { error: rsvpError } = await supabase.from("event_rsvps").upsert({
            event_id: event.id,
            phone,
            name,
            status: args.status,
            guests_count: args.guests_count || 1
          }, { onConflict: 'event_id,phone' });
          
          if (rsvpError) {
            console.error("RSVP error:", rsvpError);
            replyText = "Sorry, I couldn't register your RSVP. Please try again.";
          } else {
            const statusMsg = args.status === "going" ? "You're registered!" : args.status === "maybe" ? "Marked as Maybe" : "Noted you won't attend";
            replyText = `✅ ${statusMsg}\n\n*Event:* ${event.title}\n📅 ${new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\n${args.guests_count && args.guests_count > 1 ? `👥 Guests: ${args.guests_count}\n` : ''}\nSee you there! 🎉`;
          }
        }
      } else if (toolName === "submit_poll_vote") {
        // Find the poll
        const { data: poll, error: pollError } = await supabase.from("polls").select("*").ilike("id", `${args.poll_id}%`).single();
        if (pollError || !poll) {
          replyText = `I couldn't find a poll with ID "${args.poll_id}".`;
        } else {
          const { error: voteError } = await supabase.from("poll_votes").insert({
            poll_id: poll.id,
            phone,
            vote: args.option
          });
          if (voteError?.code === "23505") {
            replyText = "You have already voted on this poll!";
          } else if (voteError) {
            console.error("Vote error:", voteError);
            replyText = "Sorry, I couldn't register your vote. Please try again.";
          } else {
            replyText = `Thank you! Your vote for "${args.option}" has been recorded. ✅`;
          }
        }
      } else if (toolName === "get_community_groups") {
        // Load knowledge base from cache (avoids disk I/O on every request)
        const kbData = await getKB();
        const groups = kbData.community_groups || {};
        
        const groupType = args.group_type?.toLowerCase().replace(/ /g, '_');
        
        if (groupType && groups[groupType + '_group']) {
          const group = groups[groupType + '_group'];
          replyText = `*${group.name}* 📱\n\n${group.description}\n\n`;
          if (group.join_link && !group.join_link.includes('[')) {
            replyText += `🔗 *Join Link:*\n${group.join_link}\n\n`;
          }
          if (group.admin_contact) {
            replyText += `👤 *Admin Contact:*\nName: ${group.admin_name || 'Admin'}\nPhone: ${group.admin_contact}\n`;
            if (!group.join_link || group.join_link.includes('[')) {
              replyText += `\nContact the admin to be added to the group.`;
            }
          }
          if (group.note) {
            replyText += `\n\n_Note: ${group.note}_`;
          }
        } else {
          // Show all groups
          replyText = "*📱 VGN Fairmont Community Groups*\n\n";
          const groupEntries = Object.entries(groups);
          for (const [key, group] of groupEntries) {
            const g = group as { name: string; description: string; join_link?: string; admin_contact?: string; admin_name?: string };
            replyText += `*${g.name}*\n${g.description}\n`;
            if (g.admin_contact) {
              replyText += `Admin: ${g.admin_name || 'Contact'} - ${g.admin_contact}\n`;
            }
            replyText += "\n";
          }
          replyText += "\nReply with the group name to get join link and admin details!";
        }
      } else {
        replyText = `Hmm, I tried to use a tool called "${toolName}" but I don't know how to handle it.`;
        }
      } catch (toolErr) {
        console.error(`Error executing tool ${toolName}:`, toolErr);
        replyText = `I ran into an issue while trying to use the ${toolName.replace(/_/g, ' ')} tool. Please try again later.`;
      }
    } else {
      // If AI didn't call a tool, it might still have generated a missing argument prompt
      // which we asked it to delimit with ||| so we can send it as a separate message.
      if (aiResponse.text && aiResponse.text.includes("|||")) {
        const parts = aiResponse.text.split("|||");
        conversationalText = parts[0].trim();
        replyText = parts[1].trim(); 
      } else {
        replyText = aiResponse.text;
      }
    }

    // ─── RESPONSE ORDERING: AI text (info) first, tool response last ──────────
    // When a tool was called AND the AI also generated informational text, we
    // translate the tool response, but DO NOT concatenate them here. We will send 
    // them as two SEPARATE WhatsApp messages later (user requested tool receipt at the end).
    if (aiResponse.tool_call) {
      if (text) {
        replyText = await translateToolResponse(replyText, text, aiResponse.text);
      }
      if (aiResponse.text && aiResponse.text.trim()) {
        conversationalText = aiResponse.text.trim();
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (!replyText && !conversationalText) {
      console.log("No reply text generated, dropping silently.");
      return Response.json({ status: "dropped_silently" });
    }

    // ─── CONCURRENCY CHECK: PREVENT DUPLICATE/RACE CONDITION REPLIES ─────────
    const { data: dbMsg } = await supabase
      .from("messages")
      .select("created_at")
      .eq("whatsapp_msg_id", whatsappMsgId)
      .single();

    if (dbMsg) {
      const { data: newerMessages } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversation.id)
        .eq("role", "user")
        .gt("created_at", dbMsg.created_at)
        .limit(1);

      if (newerMessages && newerMessages.length > 0) {
        console.log(`[RACE CONDITION] Silently dropping reply for ${whatsappMsgId} because a newer message arrived. The newer webhook will answer all unanswered messages.`);
        sendWhatsAppReaction(phone, whatsappMsgId, ""); // Remove ⏳
        return Response.json({ status: "superseded_by_newer_message" });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    let mediaUrl: string | undefined = undefined;
    if (replyText.includes("Nikhil") || replyText.includes("நிகில்") || replyText.includes("निखिल") || replyText.includes("నిఖిల్") || replyText.includes("നിഖിൽ")) {
       mediaUrl = "https://vgn-fairmont-bot.vercel.app/founder.png";
    }

    // Send AI conversational text FIRST (if any)
    let aiTextSent = false;
    if (conversationalText) {
       // Only send if it's not a duplicate of a button prompt (if skipSend is true, button prompt is pending)
       let isDuplicate = false;
       if (skipSend && aiResponse.tool_call?.args?.message) {
         const buttonPrompt = aiResponse.tool_call.args.message;
         isDuplicate = conversationalText.includes(buttonPrompt) || buttonPrompt.includes(conversationalText);
       }
       if (!isDuplicate) {
         await sendWhatsAppMessage(phone, conversationalText);
         aiTextSent = true;
       } else {
         console.log("Skipping duplicate text response that matches button prompt.");
       }
    }

    // Send Tool Response LAST (if skipSend is false, meaning it's a normal text tool like order receipt)
    if (!skipSend && replyText) {
      const sendResult = await sendWhatsAppMessage(phone, replyText, mediaUrl);
      if (sendResult?.messages?.[0]?.id) botMsgId = sendResult.messages[0].id;
    }
    
    // Execute pending UI components (Polls) AFTER the text response is successfully sent!
    if (pendingPollArgs) {
      const pollRes = await sendWhatsAppPoll(pendingPollArgs.phone, pendingPollArgs.message, pendingPollArgs.options);
      if (pollRes?.messages?.[0]?.id) botMsgId = pollRes.messages[0].id;
    }
    
    sendWhatsAppReaction(phone, whatsappMsgId, ""); // Remove the processing reaction

    // Store AI response and update timestamp (async)
    let fullDbContent = replyText;
    if (conversationalText && replyText) {
      fullDbContent = conversationalText + "\n\n" + replyText;
    } else if (conversationalText) {
      fullDbContent = conversationalText;
    }
    
    pendingPromises.push(supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: fullDbContent,
      whatsapp_msg_id: botMsgId || undefined
    }));

    pendingPromises.push(supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id));

    // Await all background DB writes before freezing the serverless function
    await Promise.allSettled(pendingPromises);

    return Response.json({ status: "replied" });
  } catch (error) {
    console.error("Webhook top-level error:", error);
    sendWhatsAppReaction(phone, whatsappMsgId, ""); // Always remove ⏳ even on crash
    
    // SAFETY NET: If the entire worker crashes for an unexpected reason, don't leave the user hanging silently!
    try {
      await sendWhatsAppMessage(phone, "Sorry, I ran into a technical issue! 🛠️ Please try sending your message again.");
    } catch (e) {
      console.error("Failed to send crash fallback message:", e);
    }
    
    // Even on top-level crash, return 200 so Meta stops retrying. We already logged it.
    return Response.json({ status: "error_handled_gracefully" }, { status: 200 });
  }
  });

  return immediateResponse;
}
