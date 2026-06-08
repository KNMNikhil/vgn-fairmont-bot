import "dotenv/config";
import { getAIResponse } from "./src/lib/ai";

async function run() {
  console.log("Testing: what is the time?");
  const res = await getAIResponse([
    { role: "user", content: "what is the time?" }
  ]);
  console.log(JSON.stringify(res, null, 2));

  console.log("\nTesting: what is today's date?");
  const res2 = await getAIResponse([
    { role: "user", content: "what is today's date?" }
  ]);
  console.log(JSON.stringify(res2, null, 2));
}

run().catch(console.error);
