import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const mediaId = params.id;

  if (!mediaId) {
    return new NextResponse("Missing media ID", { status: 400 });
  }

  try {
    // 1. Get the media URL from WhatsApp API
    const urlRes = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    if (!urlRes.ok) {
      throw new Error(`WhatsApp Media URL error: ${urlRes.status}`);
    }
    const urlData = await urlRes.json();
    
    if (!urlData.url) {
      throw new Error("Failed to get media URL");
    }

    // 2. Download the media file using the provided URL
    const mediaRes = await fetch(urlData.url, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    if (!mediaRes.ok) {
      throw new Error(`WhatsApp Media Download error: ${mediaRes.status}`);
    }

    // 3. Buffer the media and send it back to the client
    const arrayBuffer = await mediaRes.arrayBuffer();
    
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": urlData.mime_type || "application/octet-stream",
        "Cache-Control": "public, max-age=86400", // Cache for 1 day
      },
    });

  } catch (error: any) {
    console.error("Error fetching media:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
