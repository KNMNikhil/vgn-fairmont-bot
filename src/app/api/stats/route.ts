import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  // Fetch token counts grouped by conversation
  const { data: messages, error } = await supabase
    .from("messages")
    .select("conversation_id, prompt_tokens, completion_tokens, total_tokens")
    .eq("role", "assistant");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Fetch conversations to get phone numbers
  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id, phone");

  if (convError) {
    return Response.json({ error: convError.message }, { status: 500 });
  }

  const phoneMap: Record<string, string> = {};
  conversations.forEach((c) => {
    phoneMap[c.id] = c.phone;
  });

  // Aggregate by phone
  const statsByPhone: Record<string, { phone: string, prompt: number, completion: number, total: number }> = {};
  
  let totalPrompt = 0;
  let totalCompletion = 0;

  messages.forEach((msg) => {
    const phone = phoneMap[msg.conversation_id] || "Unknown";
    if (!statsByPhone[phone]) {
      statsByPhone[phone] = { phone, prompt: 0, completion: 0, total: 0 };
    }
    statsByPhone[phone].prompt += msg.prompt_tokens || 0;
    statsByPhone[phone].completion += msg.completion_tokens || 0;
    statsByPhone[phone].total += msg.total_tokens || 0;

    totalPrompt += msg.prompt_tokens || 0;
    totalCompletion += msg.completion_tokens || 0;
  });

  // Gemini 1.5/2.5 Flash Approximate Pricing in USD
  // Input: $0.075 / 1M tokens
  // Output: $0.30 / 1M tokens
  // USD to INR conversion roughly 83 INR
  const usdToInr = 83.5;
  const promptRateInr = (0.075 / 1000000) * usdToInr;
  const completionRateInr = (0.30 / 1000000) * usdToInr;

  const userStats = Object.values(statsByPhone).map(stat => ({
    ...stat,
    costInr: ((stat.prompt * promptRateInr) + (stat.completion * completionRateInr)).toFixed(4)
  })).sort((a, b) => b.total - a.total);

  const totalCostInr = ((totalPrompt * promptRateInr) + (totalCompletion * completionRateInr)).toFixed(4);

  return Response.json({
    totalPrompt,
    totalCompletion,
    totalTokens: totalPrompt + totalCompletion,
    totalCostInr,
    userStats
  });
}
