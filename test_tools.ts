import "dotenv/config";
import { getAIResponse } from "./src/lib/ai";

async function run() {
  console.log("Testing shop order (Missing item)...");
  const res0 = await getAIResponse([
    { role: "user", content: "Order some fruits from the shop. Block B4 flat 2E" }
  ]);
  console.log(JSON.stringify(res0, null, 2));

  console.log("\nTesting shop order (Full)...");
  const res = await getAIResponse([
    { role: "user", content: "I am in block B4 flat 2E. Order 1kg apple from fruits shop." }
  ]);
  console.log(JSON.stringify(res, null, 2));

  console.log("\nTesting active poll...");
  const res2 = await getAIResponse([
    { role: "user", content: "What are the active polls?" }
  ]);
  console.log(JSON.stringify(res2, null, 2));

  console.log("\nTesting upcoming event...");
  const res3 = await getAIResponse([
    { role: "user", content: "What are the upcoming events?" }
  ]);
  console.log(JSON.stringify(res3, null, 2));
}

run().catch(console.error);
