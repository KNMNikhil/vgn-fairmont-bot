
async function testWebhook() {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "12345",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "123456789",
                phone_number_id: "123456789"
              },
              contacts: [
                {
                  profile: {
                    name: "Test User"
                  },
                  wa_id: "919677197402"
                }
              ],
              messages: [
                {
                  from: "919677197402",
                  id: "wamid.HBgLOTE5Njc3MTk3NDAyFQIAEhgUM0ZBNkExMjYwRTBEMDFEN0M5NjYA",
                  timestamp: "1717835154",
                  text: {
                    body: "hi"
                  },
                  type: "text"
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };

  const res = await fetch("http://localhost:3001/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log("Response:", res.status, text);
}

testWebhook();
