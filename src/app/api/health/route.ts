import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const status: Record<string, any> = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      supabase: "unknown",
      env: "unknown"
    }
  };

  try {
    // 1. Check Env Vars
    const requiredEnv = [
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID",
      "GEMINI_API_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY"
    ];
    
    const missing = requiredEnv.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      status.services.env = `missing: ${missing.join(", ")}`;
    } else {
      status.services.env = "ok";
    }

    // 2. Check Supabase
    try {
      // Very lightweight query just to verify connection
      const { error } = await supabase.from("conversations").select("id").limit(1);
      if (error) {
        status.services.supabase = `error: ${error.message}`;
      } else {
        status.services.supabase = "ok";
      }
    } catch (e) {
      status.services.supabase = "disconnected";
    }

    // Determine overall health
    const isHealthy = status.services.env === "ok" && status.services.supabase === "ok";
    
    return NextResponse.json(status, {
      status: isHealthy ? 200 : 503
    });
    
  } catch (err) {
    status.error = err instanceof Error ? err.message : String(err);
    return NextResponse.json(status, { status: 500 });
  }
}
