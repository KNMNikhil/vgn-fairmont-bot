import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    // 1. Peak Hours Calculation (fetch latest 1000 messages)
    const { data: messages } = await supabase
      .from("messages")
      .select("created_at")
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(1000);

    const peakHours = new Array(24).fill(0);
    let totalMessages = 0;

    if (messages) {
      totalMessages = messages.length;
      messages.forEach(msg => {
        const date = new Date(msg.created_at);
        const hour = date.getHours(); // Local timezone based on the server running this, we'll convert to IST roughly
        // We can just use UTC hours and let the frontend adjust, or adjust here.
        // Let's use UTC and let the frontend format it or just simple local hour.
        peakHours[hour]++;
      });
    }

    // 2. Feature Usage
    const { count: ticketsCount } = await supabase.from("tickets").select("*", { count: "exact", head: true });
    const { count: ordersCount } = await supabase.from("orders").select("*", { count: "exact", head: true });

    // 3. Ticket Status Breakdown
    const { data: tickets } = await supabase.from("tickets").select("status");
    const ticketStatus = {
      open: 0,
      in_progress: 0,
      resolved: 0
    };

    if (tickets) {
      tickets.forEach(t => {
        const s = (t.status || "open").toLowerCase();
        if (s.includes("progress")) ticketStatus.in_progress++;
        else if (s === "resolved" || s === "closed") ticketStatus.resolved++;
        else ticketStatus.open++;
      });
    }

    return Response.json({
      peakHours,
      features: {
        chat: totalMessages,
        tickets: ticketsCount || 0,
        orders: ordersCount || 0
      },
      ticketStatus
    });
  } catch (error: any) {
    console.error("Analytics Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
