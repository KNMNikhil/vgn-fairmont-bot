import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage, downloadWhatsAppMedia } from "@/lib/whatsapp";
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

  // Only handle text and audio messages
  if (!["text", "audio"].includes(message.type)) {
    return Response.json({ status: "unsupported_type" });
  }

  const phone = message.from;
  const isAudio = message.type === "audio";
  const text = isAudio ? "[Voice Message]" : message.text.body;
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

      if (toolName === "route_shop_order") {
        const targetPhone = args.shop_type === "fruits_shop" 
          ? (process.env.FRUITS_SHOP_NUMBER || "919677197402")
          : (process.env.IRON_SHOP_NUMBER || "919677197402");

        if (targetPhone) {
          const orderMessage = `*New Order from Resident*\nName: ${name || "Resident"}\nPhone: ${phone}\nFlat: ${args.flat_number}\nItem: ${args.item}`;
          const shopRes = await sendWhatsAppMessage(targetPhone, orderMessage);
          
          if (shopRes.error) {
            console.error("Shop Message Failed:", shopRes.error);
            replyText = `⚠️ I tried to send your order, but the ${args.shop_type.replace("_", " ")} owner's WhatsApp window is closed. They need to message me first so I can forward your orders!`;
          } else {
            replyText = `Your order for "${args.item}" has been sent to the ${args.shop_type.replace("_", " ")}! They will deliver it to ${args.flat_number}.`;
          }
        } else {
          replyText = `I'm sorry, but the phone number for the ${args.shop_type.replace("_", " ")} is not currently configured.`;
        }
      } else if (toolName === "create_ticket") {
        const { data, error } = await supabase.from("tickets").insert({
          phone,
          description: args.description,
          status: 'open'
        }).select().single();
        if (error) {
          console.error("Ticket error:", error);
          replyText = "Sorry, I couldn't log your ticket right now. Please try again later.";
        } else {
          replyText = `Your ticket has been logged successfully! 🎫\n*Ticket ID:* ${data.id.split('-')[0]}\n*Status:* Open\nWe will look into it soon.`;
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
          replyText = "*📢 Latest Community Notices*\n\n" + data.map((n: any) => `*${n.title}*\n${n.content}\n_Date: ${new Date(n.created_at).toLocaleDateString()}_`).join("\n\n");
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
          replyText = "*🛠️ Trusted Local Services*\n\n" + data.map((s: any) => `*${s.category}:* ${s.name}\n📞 ${s.contact}`).join("\n\n");
        }
      } else if (toolName === "get_active_polls") {
        const { data, error } = await supabase.from("polls").select("*").eq("is_active", true);
        if (error || !data || data.length === 0) {
          replyText = "There are no active polls right now.";
        } else {
          replyText = "*📊 Active Polls*\n\n" + data.map((p: any) => `*Poll ID:* ${p.id.split('-')[0]}\n*Q:* ${p.question}\n*Options:*\n` + p.options.map((opt: string, i: number) => `${i+1}. ${opt}`).join("\n")).join("\n\n") + "\n\nReply with 'Vote [Poll ID] for [Option Number]' to cast your vote!";
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
