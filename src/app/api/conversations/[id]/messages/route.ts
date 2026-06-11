import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch only the latest 100 messages to prevent hitting PostgREST 1000 row limits
  // and dramatically improve loading performance for long conversations
  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Reverse so the oldest of the 100 is at the top, and newest at the bottom
  const displayMessages = (messages || []).reverse();

  return Response.json(displayMessages);
}
