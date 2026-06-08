import "dotenv/config";
import { getAIResponse } from "./src/lib/ai";

async function test() {
  console.log("Testing AI generation...");
  const res = await getAIResponse([
    { role: "user", content: "Hello, who are you?" }
  ]);
  console.log("AI Response:", res);
}

test();
