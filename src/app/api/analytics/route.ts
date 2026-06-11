import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysParam = searchParams.get('days') || '30';
    const days = parseInt(daysParam, 10);

    const now = new Date();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - days);
    const pastDateString = pastDate.toISOString();

    // Previous period for week-over-week comparison
    const prevPastDate = new Date();
    prevPastDate.setDate(prevPastDate.getDate() - days * 2);
    const prevPastDateString = prevPastDate.toISOString();

    // ── 1. Fetch all messages in period ──────────────────────────────────────
    const { data: messages } = await supabase
      .from("messages")
      .select("created_at, conversation_id, role, content")
      .gte("created_at", pastDateString)
      .order("created_at", { ascending: true })
      .limit(10000);

    // ── 2. Fetch previous period user messages (for growth comparison) ───────
    const { count: prevUserMsgCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("role", "user")
      .gte("created_at", prevPastDateString)
      .lt("created_at", pastDateString);

    // ── 3. Process messages ──────────────────────────────────────────────────
    const dayCounts = new Array(7).fill(0);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const uniqueUsersSet = new Set<string>();
    const residentActivity = new Map<string, number>();
    // Track conversations for first-time vs returning
    const conversationFirstSeen = new Map<string, string>(); // convoId -> earliest date

    let totalUserMessages = 0;
    let totalBotMessages = 0;
    let totalWords = 0;
    let totalBotWords = 0;
    let totalConvos = new Set<string>();

    if (messages) {
      messages.forEach(msg => {
        if (msg.content) totalWords += msg.content.split(/\s+/).filter(Boolean).length;

        if (msg.role === "assistant") {
          totalBotMessages++;
          if (msg.content) totalBotWords += msg.content.split(/\s+/).filter(Boolean).length;
          return;
        }

        // User message logic
        totalUserMessages++;
        const utcDate = new Date(msg.created_at);
        utcDate.setMinutes(utcDate.getMinutes() + 330); // IST
        const day = utcDate.getUTCDay();
        dayCounts[day]++;

        if (msg.conversation_id) {
          uniqueUsersSet.add(msg.conversation_id);
          totalConvos.add(msg.conversation_id);
          residentActivity.set(msg.conversation_id, (residentActivity.get(msg.conversation_id) || 0) + 1);

          const dateStr = utcDate.toISOString().split('T')[0];
          if (!conversationFirstSeen.has(msg.conversation_id)) {
            conversationFirstSeen.set(msg.conversation_id, dateStr);
          }
        }
      });
    }

    // ── 4. First-time vs Returning users ─────────────────────────────────────
    // A "returning" user is one whose conversation existed before this period
    const { data: allConvos } = await supabase
      .from("conversations")
      .select("id, created_at")
      .in("id", Array.from(uniqueUsersSet).slice(0, 500));

    let newUsers = 0;
    let returningUsers = 0;
    if (allConvos) {
      allConvos.forEach(c => {
        const createdAt = new Date(c.created_at);
        if (createdAt >= pastDate) newUsers++;
        else returningUsers++;
      });
    }

    // ── 5. Top 5 Most Active Residents ───────────────────────────────────────
    const sortedResidents = Array.from(residentActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topResidents: { name: string; messages: number }[] = [];
    for (const [convoId, count] of sortedResidents) {
      const { data: convo } = await supabase
        .from("conversations")
        .select("name, phone")
        .eq("id", convoId)
        .single();
      topResidents.push({
        name: convo?.name || convo?.phone || convoId,
        messages: count
      });
    }

    // ── 6. Compute insights ──────────────────────────────────────────────────
    const uniqueUsers = uniqueUsersSet.size;
    const avgMessagesPerUser = uniqueUsers > 0 ? parseFloat((totalUserMessages / uniqueUsers).toFixed(1)) : 0;
    const avgBotResponseLength = totalBotMessages > 0 ? Math.round(totalBotWords / totalBotMessages) : 0;
    const avgConversationLength = totalConvos.size > 0 ? parseFloat(((totalUserMessages + totalBotMessages) / totalConvos.size).toFixed(1)) : 0;

    const maxDayCount = Math.max(...dayCounts, 0);
    const busiestDayIndex = dayCounts.indexOf(maxDayCount);
    const busiestDay = maxDayCount > 0 ? ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][busiestDayIndex] : "N/A";
    const busiestDayPercentage = totalUserMessages > 0 ? Math.round((maxDayCount / totalUserMessages) * 100) : 0;

    const botRatio = totalUserMessages > 0 ? parseFloat(((totalBotMessages / totalUserMessages) * 100).toFixed(0)) : 0;

    // Week-over-week growth
    const weekOverWeekGrowth = (prevUserMsgCount && prevUserMsgCount > 0)
      ? parseFloat((((totalUserMessages - prevUserMsgCount) / prevUserMsgCount) * 100).toFixed(1))
      : 0;

    // Unresolved ticket rate
    const { count: ticketsCount } = await supabase.from("tickets")
      .select("*", { count: "exact", head: true })
      .gte("created_at", pastDateString);

    const { count: ordersCount } = await supabase.from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", pastDateString);

    const { data: tickets, error: ticketsErr } = await supabase.from("tickets")
      .select("status, priority")
      .gte("created_at", pastDateString);

    if (ticketsErr) {
      console.error("Tickets query error:", ticketsErr);
    }

    const ticketStatus = { open: 0, in_progress: 0, resolved: 0 };
    const ticketCategories = new Map<string, number>();

    if (tickets) {
      tickets.forEach(t => {
        const s = (t.status || "open").toLowerCase();
        if (s.includes("progress")) ticketStatus.in_progress++;
        else if (s === "resolved" || s === "closed") ticketStatus.resolved++;
        else ticketStatus.open++;

        let cat = "General Request";
        if (t.priority === "red") cat = "Urgent / Emergency";
        else if (t.priority === "yellow") cat = "Maintenance";

        ticketCategories.set(cat, (ticketCategories.get(cat) || 0) + 1);
      });
    }

    const unresolvedRate = (ticketsCount && ticketsCount > 0)
      ? Math.round(((ticketStatus.open + ticketStatus.in_progress) / ticketsCount) * 100)
      : 0;

    const ticketCategoryBreakdown = Array.from(ticketCategories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([category, count]) => ({ category, count }));

    // Day of week distribution for heatmap
    const dayOfWeekData = dayNames.map((name, i) => ({ day: name, count: dayCounts[i] }));

    return Response.json({
      insights: {
        uniqueUsers,
        newUsers,
        returningUsers,
        avgMessagesPerUser,
        avgBotResponseLength,
        avgConversationLength,
        busiestDay,
        busiestDayPercentage,
        totalWords,
        botRatio,
        weekOverWeekGrowth,
        unresolvedRate,
        topResidentName: topResidents[0]?.name || "N/A"
      },
      topResidents,
      dayOfWeekData,
      features: {
        chat: totalUserMessages,
        tickets: ticketsCount || 0,
        orders: ordersCount || 0
      },
      ticketStatus,
      ticketCategoryBreakdown
    });
  } catch (error: any) {
    console.error("Analytics Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
