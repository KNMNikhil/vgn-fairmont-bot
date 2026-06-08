import "dotenv/config";

const phone = "919677197402"; // User's phone number
const token = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

async function testTyping() {
  const payloads = [
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "typing_indicator",
      action: "typing_on"
    },
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      action: "typing_on"
    },
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      sender_action: "typing_on" // Typical for messenger, maybe works here
    }
  ];

  for (const p of payloads) {
    console.log("Testing payload:", p);
    const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(p)
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", data);
  }
}

testTyping();
