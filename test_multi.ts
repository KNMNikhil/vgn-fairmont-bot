import "dotenv/config";
import { getAIResponse } from "./src/lib/ai";

async function run() {
  console.log("Testing multiple questions at once...");
  const res = await getAIResponse([
    { role: "user", content: "give swimming pool rules and escalation matrix" }
  ]);
  console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
