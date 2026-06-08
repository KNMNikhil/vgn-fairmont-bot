import "dotenv/config";
import { getAIResponse } from "./src/lib/ai";

async function run() {
  console.log("Testing current datetime...");
  const res = await getAIResponse([
    { role: "user", content: "What is the current time?" }
  ]);
  console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
