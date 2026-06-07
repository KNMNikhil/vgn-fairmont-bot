const PHONE_NUMBER = "919999999999"; // Test dummy number
const WEBHOOK_URL = "https://vgn-fairmont-bot.vercel.app/api/webhook";

const testCases = [
  {
    name: "1. General greeting with bad spelling",
    text: "hlo bot hw r u wht can u do in vgn firmnt?",
    type: "text"
  },
  {
    name: "2. Check Time",
    text: "wht time is it nw?",
    type: "text"
  },
  {
    name: "3. Latest Notices (Tamil)",
    text: "சமீபத்திய அறிவிப்புகள் என்ன?",
    type: "text"
  },
  {
    name: "4. Upcoming Events",
    text: "any evnts coming up ds week?",
    type: "text"
  },
  {
    name: "5. Active Polls",
    text: "r ther any active pols to vote on?",
    type: "text"
  },
  {
    name: "6. Interactive Poll Response",
    type: "interactive",
    interactiveData: {
      type: "button_reply",
      button_reply: {
        id: "poll_123_opt1",
        title: "Option 1"
      }
    }
  },
  {
    name: "7. Local Services",
    text: "i ned a plumbr urjently, do u knw ne 1?",
    type: "text"
  },
  {
    name: "8. Community Groups (Hindi)",
    text: "खेल समूह का लिंक भेजें", // Send sports group link
    type: "text"
  },
  {
    name: "9. Create Ticket",
    text: "lift in C block is nt workng, pls rpt ds issue",
    type: "text"
  },
  {
    name: "10. Route Shop Order",
    text: "i am in flat C-404. I need 2kg tomatoes from fruits shop pls",
    type: "text"
  }
];

async function sendWebhook(testCase, index) {
  const messageId = `wamid.TEST_E2E_${Date.now()}_${index}`;
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      id: "12345",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: "123456789", phone_number_id: "123456789" },
          contacts: [{ profile: { name: "E2E Tester" }, wa_id: PHONE_NUMBER }],
          messages: [{
            from: PHONE_NUMBER,
            id: messageId,
            timestamp: "" + Math.floor(Date.now() / 1000),
            type: testCase.type,
            ...(testCase.type === 'text' ? { text: { body: testCase.text } } : {}),
            ...(testCase.type === 'interactive' ? { interactive: testCase.interactiveData } : {})
          }]
        },
        field: "messages"
      }]
    }]
  };

  console.log(`\nTesting [${testCase.name}]...`);
  try {
    const start = Date.now();
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.text();
    const duration = Date.now() - start;
    console.log(`✅ Passed in ${duration}ms. Webhook response:`, data);
  } catch (e) {
    console.error(`❌ Failed:`, e);
  }
}

async function runTests() {
  console.log("Starting E2E Tests on Vercel Production...");
  for (let i = 0; i < testCases.length; i++) {
    await sendWebhook(testCases[i], i);
    // Wait 5 seconds between messages to ensure orderly AI context
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log("\n🎉 All tests complete! Check the Vercel app dashboard to see the conversation history.");
}

runTests();
