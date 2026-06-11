import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

export const dynamic = "force-dynamic";

// Simple in-memory cache to prevent abuse and save API costs
let cachedFaq: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function GET(_request: NextRequest) {
  try {
    if (cachedFaq && Date.now() - lastCacheTime < CACHE_TTL) {
      return Response.json(cachedFaq);
    }

    // Fetch the 50 most recent user messages
    const { data: messages } = await supabase
      .from("messages")
      .select("content")
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!messages || messages.length === 0) {
      return Response.json({ questions: [] });
    }

    const messageList = messages.map(m => m.content).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "You are an analytics engine. Read the following recent user messages from a WhatsApp community bot. Identify the 3 most frequently discussed topics or questions. Return a JSON array of 3 objects, each with 'question' (a generalized string of the common question) and 'reason' (a 1-sentence explanation of why it's common based on the data)."
        },
        { role: "user", content: messageList }
      ],
      response_format: { type: "json_object" }
    });

    const aiResponseStr = completion.choices[0]?.message?.content || '{"questions":[]}';
    let result;
    try {
      result = JSON.parse(aiResponseStr);
      // Sometimes gemini might nest it
      if (!result.questions && Array.isArray(result)) {
        result = { questions: result };
      }
    } catch(e) {
      result = { questions: [] };
    }

    cachedFaq = result;
    lastCacheTime = Date.now();

    return Response.json(result);
  } catch (error: any) {
    console.error("FAQ Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
