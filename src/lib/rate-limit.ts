/**
 * Supabase-Backed Sliding Window Rate Limiter
 *
 * OPTIMIZED: Single-query approach using a JOIN instead of two sequential queries.
 * This cuts DB round-trips from 2 → 1 per request, which matters at 800+ concurrent users.
 *
 * No new DB table needed — reads from the existing `messages` table.
 */

import { supabase } from "@/lib/supabase";

const MAX_MESSAGES_PER_MINUTE = 30; // Allow up to 30 messages/min per user

export async function checkRateLimit(phone: string): Promise<{ allowed: boolean }> {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    // Single query: count user messages in last 60s by joining conversations on phone
    // Uses idx_conversations_phone + idx_messages_convo_role_created indexes for speed
    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .gte("created_at", oneMinuteAgo)
      .eq("conversations.phone", phone)
      .not("conversations", "is", null);

    if (error) {
      // If DB check fails, fail open (allow the message) to avoid blocking real users
      console.warn("Rate limit DB check failed, failing open:", error.message);
      return { allowed: true };
    }

    if ((count ?? 0) > MAX_MESSAGES_PER_MINUTE) {
      console.warn(`Rate limit exceeded for ${phone}: ${count} messages in last 60s`);
      return { allowed: false };
    }

    return { allowed: true };
  } catch (err) {
    // Safety: always fail open on unexpected errors
    console.warn("Rate limit check threw unexpectedly, failing open:", err);
    return { allowed: true };
  }
}
