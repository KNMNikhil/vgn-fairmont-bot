const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const keyMatch = env.match(/GEMINI_API_KEY=(.+)/);
const key = keyMatch ? keyMatch[1].trim() : '';
const OpenAI = require('openai');
const openai = new OpenAI({
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  apiKey: key
});

const tools = [
  {
    type: "function",
    function: {
      name: "get_latest_notices",
      description: "Fetch the latest community announcements and notices.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_active_polls",
      description: "Fetch all active community polls that residents can vote on.",
      parameters: { type: "object", properties: {} }
    }
  }
];

async function main() {
  try {
    const comp = await openai.chat.completions.create({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'system', content: 'You are a community bot. 1. If unknown say "I am not aware of this." 11. NEVER output JSON.' }, { role: 'user', content: 'test and chekc whether the api call is happening and is the ai model working.' }],
      tools: tools,
      tool_choice: "auto"
    });
    
    const message = comp.choices[0]?.message;
    console.log("RAW MESSAGE:", JSON.stringify(message, null, 2));
    
  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
main();
