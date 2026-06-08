import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage, downloadWhatsAppMedia, sendWhatsAppPoll, markWhatsAppMessageRead } from "@/lib/whatsapp";
import { getAIResponse } from "@/lib/ai";

export const maxDuration = 60; // Allow function to run up to 60 seconds to prevent Vercel timeouts

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
    text = "[Voice Message]";
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
    }
    
    // Send immediate acknowledgment
    await sendWhatsAppMessage(phone, "Noted.");
    
    // Return early to skip AI processing
    return Response.json({ status: "poll_response_acknowledged" });
  } else {
    text = message.text?.body;
    if (!text) {
      if (message.type === "image") text = message.image?.caption || "[User sent an image]";
      else if (message.type === "video") text = message.video?.caption || "[User sent a video]";
      else if (message.type === "document") text = message.document?.caption || "[User sent a document]";
      else if (message.type === "location") text = "[User sent a location]";
      else if (message.type === "sticker") text = "[User sent a sticker]";
      else text = `[User sent a ${message.type || 'unknown'} message]`;
    }
  }
  
  const name = contact?.profile?.name || null;
  const whatsappMsgId = message.id;

  // Immediately mark as read (fire and forget)
  markWhatsAppMessageRead(whatsappMsgId);

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

  try {
    // Find or create conversation
    let conversation;
    try {
      let { data: existingConvo, error: fetchError } = await supabase
        .from("conversations")
        .select("*")
        .eq("phone", phone)
        .single();
        
      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
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

    if (name && name !== conversation.name) {
      await supabase
        .from("conversations")
        .update({ name })
        .eq("id", conversation.id);
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

    // Update conversation timestamp (async)
    const pendingPromises: any[] = [];
    pendingPromises.push(supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id));

    // If mode is 'human', don't auto-reply
    if (conversation.mode === "human") {
      await Promise.allSettled(pendingPromises);
      return Response.json({ status: "stored_for_human" });
    }

    // Fetch conversation history (last 20 messages for context)
    const { data: rawHistory } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const history = (rawHistory || []).reverse();

    // Download audio if present
    let audioData: { base64: string, mimeType: string } | undefined = undefined;
    if (isAudio && message.audio?.id) {
      try {
        audioData = await downloadWhatsAppMedia(message.audio.id);
      } catch (err) {
        console.error("Failed to download audio:", err);
      }
    }

    // Get AI response
    const aiResponse = await getAIResponse(
      history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      audioData
    );

    let replyText = "";

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
        } else if (toolName === "route_shop_order") {
        const targetPhone = args.shop_type === "fruits_shop" 
          ? (process.env.FRUITS_SHOP_NUMBER || "919677197402")
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
          replyText = `Your ticket has been logged successfully! 🎫\n\n*Ticket Details:*\nTicket ID: ${data.id.split('-')[0]}\nPriority: ${priorityEmoji} ${priorityLabel}\nStatus: Open\n📅 Logged on: ${ticketDateTime} IST\n\n${priority === 'red' ? '🚨 This is marked URGENT and the team has been alerted immediately!' : priority === 'yellow' ? '🔧 This will be addressed by the maintenance team soon.' : '✅ We have received your feedback and will look into it.'}`;
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
        // Load knowledge base
        const fs = await import('fs/promises');
        const path = await import('path');
        const kbPath = path.join(process.cwd(), 'src', 'data', 'vgn_fairmont_kb.json');
        const kbData = JSON.parse(await fs.readFile(kbPath, 'utf-8'));
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
      replyText = aiResponse.text;
    }

    if (!replyText || replyText.trim() === "") {
      console.log("No reply text generated, dropping silently.");
      return Response.json({ status: "dropped_silently" });
    }

    // Check if the AI's response is the founder response to attach the photo
    let mediaUrl: string | undefined = undefined;
    if (replyText.includes("Nikhil") || replyText.includes("நிகில்") || replyText.includes("निखिल") || replyText.includes("నిఖిల్") || replyText.includes("നിഖിൽ")) {
       mediaUrl = "https://vgn-fairmont-bot.vercel.app/founder.png";
    }

    // Send response via WhatsApp
    await sendWhatsAppMessage(phone, replyText, mediaUrl);

    // Store AI response and update timestamp (async)
    pendingPromises.push(supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: replyText,
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
    // Even on top-level crash, return 200 so Meta stops retrying. We already logged it.
    return Response.json({ status: "error_handled_gracefully" }, { status: 200 });
  }
}
