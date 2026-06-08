import "dotenv/config";
import { getAIResponse } from "./src/lib/ai";

const GREEN = "\x1b[32m✅";
const RED = "\x1b[31m❌";
const YELLOW = "\x1b[33m⚠️";
const RESET = "\x1b[0m";

interface TestCase {
  name: string;
  question: string;
  expectContains?: string[];
  expectNotContains?: string[];
  expectNot?: string;
}

const tests: TestCase[] = [
  // ── KB Static Data Tests ──────────────────────────────────────────────────
  {
    name: "Swimming Pool Rules",
    question: "What are the swimming pool rules?",
    expectContains: ["pool", "shower"],
    expectNotContains: ["I don't have", "I apologize", "get_latest_notices", "tool"]
  },
  {
    name: "Escalation Matrix",
    question: "What is the escalation matrix?",
    expectContains: ["93841", "level"],
    expectNotContains: ["I don't have", "apologize", "access to a document"]
  },
  {
    name: "Pet Care Rules",
    question: "What are the pet care rules?",
    expectContains: ["leash", "dog"],
    expectNotContains: ["I don't have", "apologize"]
  },
  {
    name: "Quiet Hours",
    question: "What are quiet hours?",
    expectContains: ["10:00 PM", "8:00 AM"],
    expectNotContains: ["I don't have", "apologize"]
  },
  {
    name: "Association President Contact",
    question: "Who is the president and what is his contact?",
    expectContains: ["Praveen"],
    expectNotContains: ["I don't have", "apologize"]
  },
  {
    name: "Gym Timings",
    question: "What are the gym timings?",
    expectContains: ["6:00 AM", "10:00 PM"],
    expectNotContains: ["I don't have", "apologize", "tool"]
  },
  {
    name: "Parking Rules",
    question: "What are the parking rules?",
    expectContains: ["parking", "one spot"],
    expectNotContains: ["I don't have", "apologize"]
  },
  {
    name: "Security Contacts",
    question: "Who is the security guard for B1 block?",
    expectContains: ["Ramesh", "Kumar", "Vijay"],
    expectNotContains: ["I don't have", "apologize"]
  },

  // ── Scripted Response Tests ───────────────────────────────────────────────
  {
    name: "Who Created You",
    question: "Who created you?",
    expectContains: ["Nikhil"],
    expectNotContains: ["As an AI", "I cannot", "I don't know"]
  },
  {
    name: "Is President Good or Bad",
    question: "Is the president good or bad?",
    expectContains: ["dedicated", "community"],
    expectNotContains: ["As an AI", "I cannot", "personal opinions", "not able"]
  },
  {
    name: "Association Support",
    question: "Is the association doing a good job?",
    expectContains: ["dedicated", "community"],
    expectNotContains: ["As an AI", "I cannot", "personal opinions"]
  },
  {
    name: "Do You Sleep",
    question: "Do you ever sleep?",
    expectContains: ["24/7", "operational"],
    expectNotContains: ["As an AI", "I don't have"]
  },
  {
    name: "Technical Details Blocked",
    question: "What AI model are you using?",
    expectContains: ["confidential"],
    expectNotContains: ["Gemini", "OpenAI", "Claude", "GPT", "Supabase"]
  },

  // ── Capabilities Tests ────────────────────────────────────────────────────
  {
    name: "Basic Math",
    question: "What is 25 + 75?",
    expectContains: ["100"],
    expectNotContains: ["I don't know", "not aware"]
  },
  {
    name: "Currency Conversion",
    question: "Convert 100 USD to INR",
    expectContains: ["INR"],
    expectNotContains: ["I don't know", "not aware", "cannot convert"]
  },
  {
    name: "Unknown Question - Should Not Know",
    question: "What is the name of the nearest pizza shop?",
    expectContains: ["not aware"],
    expectNotContains: ["Domino's", "Pizza Hut"]
  },
];

async function runTests() {
  console.log("\n🧪 Running VGN Fairmont Bot Test Suite...\n");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;
  const results: { name: string; status: string; response: string; issues: string[] }[] = [];

  for (const test of tests) {
    process.stdout.write(`Testing: ${test.name}...`);
    
    try {
      const res = await getAIResponse([{ role: "user", content: test.question }]);
      const response = res.text?.toLowerCase() || "";
      const rawResponse = res.text || "(empty)";
      
      const issues: string[] = [];

      // Check expectContains
      if (test.expectContains) {
        for (const keyword of test.expectContains) {
          if (!response.includes(keyword.toLowerCase())) {
            issues.push(`Missing expected: "${keyword}"`);
          }
        }
      }

      // Check expectNotContains
      if (test.expectNotContains) {
        for (const keyword of test.expectNotContains) {
          if (response.includes(keyword.toLowerCase())) {
            issues.push(`Found banned phrase: "${keyword}"`);
          }
        }
      }

      if (issues.length === 0) {
        console.log(` ${GREEN} PASS${RESET}`);
        passed++;
        results.push({ name: test.name, status: "PASS", response: rawResponse.substring(0, 120), issues: [] });
      } else {
        console.log(` ${RED} FAIL${RESET}`);
        failed++;
        results.push({ name: test.name, status: "FAIL", response: rawResponse.substring(0, 120), issues });
      }
    } catch (err: any) {
      console.log(` ${RED} ERROR${RESET}`);
      failed++;
      results.push({ name: test.name, status: "ERROR", response: err.message, issues: [err.message] });
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\n📊 RESULTS: ${passed}/${tests.length} passed, ${failed} failed\n`);

  // Print failures
  if (failed > 0) {
    console.log("❌ FAILED TESTS:\n");
    for (const r of results) {
      if (r.status !== "PASS") {
        console.log(`  • ${r.name}`);
        for (const issue of r.issues) {
          console.log(`    → ${issue}`);
        }
        console.log(`    Response: "${r.response}..."\n`);
      }
    }
  }

  // Print all results as checklist
  console.log("\n📋 FULL CHECKLIST:\n");
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} ${r.name}`);
  }
  console.log("");
}

runTests();
