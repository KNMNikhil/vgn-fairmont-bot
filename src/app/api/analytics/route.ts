import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysParam = searchParams.get('days') || '30';
    const days = parseInt(daysParam, 10);
    
    // Calculate the start date for filtering
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - days);
    const pastDateString = pastDate.toISOString();

    // 1. Peak Hours Calculation (fetch messages within the timeframe)
    const { data: messages } = await supabase
      .from("messages")
      .select("created_at")
      .eq("role", "user")
      .gte("created_at", pastDateString)
      .order("created_at", { ascending: false })
      .limit(5000); // Increased limit to ensure we capture enough data

    const peakHours = new Array(24).fill(0);
    let totalMessages = 0;

    if (messages) {
      totalMessages = messages.length;
      messages.forEach(msg => {
        const utcDate = new Date(msg.created_at);
        // Convert to IST manually (UTC + 5 hours 30 mins)
        utcDate.setMinutes(utcDate.getMinutes() + 330);
        const hour = utcDate.getUTCHours(); 
        peakHours[hour]++;
      });
    }

    // 2. Feature Usage
    const { count: ticketsCount } = await supabase.from("tickets")
      .select("*", { count: "exact", head: true })
      .gte("created_at", pastDateString);
      
    const { count: ordersCount } = await supabase.from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", pastDateString);

    // 3. Ticket Status Breakdown
    const { data: tickets } = await supabase.from("tickets")
      .select("status")
      .gte("created_at", pastDateString);
      
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
