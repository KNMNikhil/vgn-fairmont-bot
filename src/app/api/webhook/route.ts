import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage, downloadWhatsAppMedia, sendWhatsAppPoll } from "@/lib/whatsapp";
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
  const body = await request.json();

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
  const contact = value.contacts?.[0];

  // Only handle text, audio, and interactive messages
  if (!["text", "audio", "interactive"].includes(message.type)) {
    return Response.json({ status: "unsupported_type" });
  }

  const phone = message.from;
  const isAudio = message.type === "audio";
  const isPollResponse = message.type === "interactive" && message.interactive?.type === "button_reply";
  
  let text = "";
  if (isAudio) {
    text = "[Voice Message]";
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
    text = message.text?.body || "";
  }
  
  const name = contact?.profile?.name || null;
  const whatsappMsgId = message.id;

  try {
    // Find or create conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("phone", phone)
      .single();

    if (!conversation) {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({ phone, name })
        .select()
        .single();
      conversation = newConvo;
    } else if (name && name !== conversation.name) {
      await supabase
        .from("conversations")
        .update({ name })
        .eq("id", conversation.id);
    }

    if (!conversation) {
      return Response.json({ error: "Failed to create conversation" }, { status: 500 });
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

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);

    // If mode is 'human', don't auto-reply
    if (conversation.mode === "human") {
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

      if (toolName === "get_current_datetime") {
        // Get current IST date and time - CORRECTED
        const now = new Date();
        
        const dateStr = now.toLocaleDateString('en-US', { 
          timeZone: 'Asia/Kolkata',
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        const timeStr = now.toLocaleTimeString('en-US', { 
          timeZone: 'Asia/Kolkata',
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          hour12: true 
        });
        
        replyText = `📅 *Current Date:* ${dateStr}\n🕐 *Current Time:* ${timeStr} IST`;
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
          }
        } else {
          replyText = `I'm sorry, but the phone number for the ${args.shop_type.replace("_", " ")} is not currently configured.`;
        }
      } else if (toolName === "create_ticket") {
        // Get current IST date and time for ticket - CORRECTED
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

        const { data, error } = await supabase.from("tickets").insert({
          phone,
          description: args.description,
          status: 'open'
        }).select().single();
        if (error) {
          console.error("Ticket error:", error);
          replyText = "Sorry, I couldn't log your ticket right now. Please try again later.";
        } else {
          replyText = `Your ticket has been logged successfully! 🎫\n\n*Ticket Details:*\nTicket ID: ${data.id.split('-')[0]}\nStatus: Open\n📅 Logged on: ${ticketDateTime} IST\n\nWe will look into it soon.`;
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
          // Send event details with RSVP polls
          for (const e of data) {
            const eventDate = new Date(e.event_date + 'T' + e.event_time);
            const formattedDate = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const formattedTime = eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            
            const eventInfo = `*${e.title}*\n📅 ${formattedDate} at ${formattedTime}\n📍 ${e.location}\n${e.description || ''}`;
            await sendWhatsAppMessage(phone, eventInfo);
            
            // Send RSVP poll for this event
            const eventIdShort = e.id.split('-')[0];
            await sendWhatsAppPoll(phone, `RSVP for ${e.title}`, [
              { id: `event_${eventIdShort}_going`, title: "Going" },
              { id: `event_${eventIdShort}_maybe`, title: "Maybe" },
              { id: `event_${eventIdShort}_notgoing`, title: "Not Going" }
            ]);
          }
          replyText = data.length === 1 ? "Here's the upcoming event with RSVP options above!" : `Here are ${data.length} upcoming events with RSVP options above!`;
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
    } else {
      replyText = aiResponse.text;
    }

    // Send response via WhatsApp
    await sendWhatsAppMessage(phone, replyText);

    // Store AI response
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: replyText,
    });

    // Update conversation timestamp again
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);

    return Response.json({ status: "replied" });
  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
