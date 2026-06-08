import "dotenv/config";
import { getAIResponse } from "./src/lib/ai";

async function run() {
  console.log("Testing misspelled pool rules...");
  const res0 = await getAIResponse([
    { role: "user", content: "what r the swminning pol ruls?" }
  ]);
  console.log(JSON.stringify(res0, null, 2));

  console.log("\nTesting misspelled president contact...");
  const res = await getAIResponse([
    { role: "user", content: "who iz prezdent annd whats hiz numbr?" }
  ]);
  console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
