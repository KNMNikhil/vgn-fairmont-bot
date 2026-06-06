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
        to,
        type: "interactive",
        interactive: {
          type: "poll_creation",
          header: {
            type: "text",
            text: "📊 Community Poll"
          },
          body: {
            text: question
          },
          action: {
            name: "poll_creation",
            values: options.slice(0, 12).map(opt => ({ text: opt })) // Max 12 options
          }
        }
      }),
    }
  );
  return res.json();
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
