/**
 * Supabase-Backed Sliding Window Rate Limiter
 *
 * Unlike an in-memory Map, this uses the existing `messages` table to count
 * how many messages a phone number sent in the last 60 seconds.
 * This is shared across ALL serverless function instances, making it work
 * correctly even when 100s of users message simultaneously on Vercel.
 *
 * No new DB table needed — it reads from the `messages` table that already exists.
 */

import { supabase } from "@/lib/supabase";

const MAX_MESSAGES_PER_MINUTE = 30; // Allow up to 30 messages/min per user

export async function checkRateLimit(phone: string): Promise<{ allowed: boolean }> {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    // Count messages from this phone in the last 60 seconds by joining conversations
    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .gte("created_at", oneMinuteAgo)
      .in(
        "conversation_id",
        // Sub-select: get conversation IDs for this phone
        (await supabase.from("conversations").select("id").eq("phone", phone)).data?.map((c) => c.id) ?? []
      );

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
