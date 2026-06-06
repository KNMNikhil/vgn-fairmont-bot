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
      name: "create_ticket",
      description: "Log a maintenance complaint or ticket. Needs description.",
      parameters: { type: "object", properties: { description: { type: "string" } }, required: ["description"] }
    }
  }
];

async function main() {
  try {
    const comp = await openai.chat.completions.create({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'system', content: 'You are a community bot.' }, { role: 'user', content: 'A light is broken in the basement 2 log this complaint and this The gym AC is not working near block b' }],
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
