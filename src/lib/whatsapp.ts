export async function sendWhatsAppMessage(to: string, body: string) {
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
    }
  );
  return res.json();
}

// Send WhatsApp Interactive Poll
export async function sendWhatsAppPoll(
  to: string,
  question: string,
  options: string[]
) {
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
            text: `📊 *Poll:* ${question}\n\n${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}\n\nReply with the option number to vote.`
          },
          action: {
            buttons: options.slice(0, 3).map((opt, i) => ({
              type: "reply",
              reply: {
                id: `poll_vote_${i}`,
                title: opt.substring(0, 20)
              }
            }))
          }
        }
      }),
    }
  );
  const result = await res.json();
  console.log("Poll send result:", JSON.stringify(result, null, 2));
  return result;
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<{ base64: string, mimeType: string }> {
  // 1. Get Media URL
  const urlRes = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    },
  });
  const urlData = await urlRes.json();
  
  if (!urlData.url) {
    throw new Error(`Failed to get media URL: ${JSON.stringify(urlData)}`);
  }

  // 2. Download Media File
  const mediaRes = await fetch(urlData.url, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    },
  });
  
  const arrayBuffer = await mediaRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return {
    base64: buffer.toString('base64'),
    mimeType: urlData.mime_type || "audio/ogg",
  };
}
