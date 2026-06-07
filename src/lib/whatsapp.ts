export async function markWhatsAppMessageRead(messageId: string) {
  try {
    fetch(`https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    }).catch(e => console.error("Mark read failed asynchronously:", e));
  } catch (error) {
    console.error("Failed to mark message as read:", error);
  }
}



export async function sendWhatsAppMessage(to: string, body: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(
        `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body },
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`WhatsApp API error: ${res.status} ${res.statusText}`);
      }

      return await res.json();
    } catch (error) {
      console.error(`WhatsApp send attempt ${attempt} failed:`, error);
      if (attempt === retries) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
      }
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }
}

// Send WhatsApp Interactive Poll
export async function sendWhatsAppPoll(
  to: string,
  question: string,
  options: Array<string | { id: string; title: string }>,
  retries = 3
) {
  // Format options - accept both string array and object array
  const formattedOptions = options.map((opt, i) => {
    if (typeof opt === 'string') {
      return {
        type: "reply",
        reply: {
          id: `poll_vote_${i}`,
          title: opt.substring(0, 20)
        }
      };
    } else {
      return {
        type: "reply",
        reply: {
          id: opt.id,
          title: opt.title.substring(0, 20)
        }
      };
    }
  }).slice(0, 3);

  const displayText = typeof options[0] === 'string' 
    ? `📊 *Poll:* ${question}\n\n${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}\n\nSelect an option below to vote.`
    : question;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(
        `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            type: "interactive",
            interactive: {
              type: "button",
              body: {
                text: displayText
              },
              action: {
                buttons: formattedOptions
              }
            }
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`WhatsApp API error: ${res.status} ${res.statusText}`);
      }

      const result = await res.json();
      console.log("Poll send result:", JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error(`WhatsApp poll attempt ${attempt} failed:`, error);
      if (attempt === retries) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }
}



export async function downloadWhatsAppMedia(mediaId: string, retries = 3): Promise<{ base64: string, mimeType: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 1. Get Media URL
      const controller1 = new AbortController();
      const timeoutId1 = setTimeout(() => controller1.abort(), 5000);
      const urlRes = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
        signal: controller1.signal,
      });
      clearTimeout(timeoutId1);

      if (!urlRes.ok) {
         throw new Error(`WhatsApp Media URL error: ${urlRes.status}`);
      }
      const urlData = await urlRes.json();
      
      if (!urlData.url) {
        throw new Error(`Failed to get media URL: ${JSON.stringify(urlData)}`);
      }

      // 2. Download Media File
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 10000);
      const mediaRes = await fetch(urlData.url, {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
        signal: controller2.signal,
      });
      clearTimeout(timeoutId2);

      if (!mediaRes.ok) {
         throw new Error(`WhatsApp Media Download error: ${mediaRes.status}`);
      }
      
      const arrayBuffer = await mediaRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      return {
        base64: buffer.toString('base64'),
        mimeType: urlData.mime_type || "audio/ogg",
      };
    } catch (error) {
      console.error(`WhatsApp media download attempt ${attempt} failed:`, error);
      if (attempt === retries) {
         throw error; // Rethrow on last attempt so calling function can catch it
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }
  throw new Error("Failed to download media after retries");
}
