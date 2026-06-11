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

    // 1. Fetch messages within the timeframe (both user and assistant for better analytics)
    const { data: messages } = await supabase
      .from("messages")
      .select("created_at, conversation_id, role, content")
      .gte("created_at", pastDateString)
      .order("created_at", { ascending: false })
      .limit(10000);

    const timelineMap = new Map<string, number>();
    // Pre-fill the map with the last X days so we have a continuous timeline even with 0 messages
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setMinutes(d.getMinutes() + 330); // IST Offset
      const dateStr = d.toISOString().split('T')[0];
      timelineMap.set(dateStr, 0);
    }

    const dayCounts = new Array(7).fill(0);
    const uniqueUsersSet = new Set<string>();
    
    let totalUserMessages = 0;
    let totalBotMessages = 0;
    let totalWords = 0;
    
    // Map to find the most active resident
    const residentActivity = new Map<string, number>();

    if (messages) {
      messages.forEach(msg => {
        // Calculate Words Processed
        if (msg.content) {
          totalWords += msg.content.split(/\s+/).length;
        }

        if (msg.role === "assistant") {
          totalBotMessages++;
          return; // Skip timeline and busiest day calculations for bot responses
        }
        
        // --- Below is User Message Only Logic ---
        totalUserMessages++;
        
        const utcDate = new Date(msg.created_at);
        utcDate.setMinutes(utcDate.getMinutes() + 330); // IST
        
        const dateStr = utcDate.toISOString().split('T')[0];
        const day = utcDate.getUTCDay(); // 0 = Sunday
        
        // Update Timeline
        if (timelineMap.has(dateStr)) {
          timelineMap.set(dateStr, timelineMap.get(dateStr)! + 1);
        } else {
          timelineMap.set(dateStr, 1);
        }

        // Update Busiest Day
        dayCounts[day]++;
        
        // Update Resident Activity
        if (msg.conversation_id) {
          uniqueUsersSet.add(msg.conversation_id);
          residentActivity.set(msg.conversation_id, (residentActivity.get(msg.conversation_id) || 0) + 1);
        }
      });
    }

    // Convert timeline to array format for frontend
    const timeline = Array.from(timelineMap.entries()).map(([date, count]) => ({ date, count }));

    // Find Most Active Resident ID
    let topResidentId: string | null = null;
    let maxResidentMsgs = 0;
    for (const [convoId, count] of residentActivity.entries()) {
      if (count > maxResidentMsgs) {
        maxResidentMsgs = count;
        topResidentId = convoId;
      }
    }

    // Fetch name of the most active resident
    let topResidentName = "N/A";
    if (topResidentId) {
      const { data: topConvo } = await supabase
        .from("conversations")
        .select("name, phone")
        .eq("id", topResidentId)
        .single();
      if (topConvo) {
        topResidentName = topConvo.name || topConvo.phone;
      }
    }

    // Process Insights
    const uniqueUsers = uniqueUsersSet.size;
    const avgMessagesPerUser = uniqueUsers > 0 ? (totalUserMessages / uniqueUsers).toFixed(1) : 0;
    
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const maxDayCount = Math.max(...dayCounts);
    const busiestDayIndex = dayCounts.indexOf(maxDayCount);
    const busiestDay = maxDayCount > 0 ? daysOfWeek[busiestDayIndex] : "N/A";
    const busiestDayPercentage = totalUserMessages > 0 ? Math.round((maxDayCount / totalUserMessages) * 100) : 0;
    
    const botRatio = totalUserMessages > 0 ? ((totalBotMessages / totalUserMessages) * 100).toFixed(0) : 0;

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
      timeline,
      insights: {
        uniqueUsers,
        avgMessagesPerUser,
        busiestDay,
        busiestDayPercentage,
        totalWords,
        topResidentName,
        botRatio
      },
      features: {
        chat: totalUserMessages,
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
