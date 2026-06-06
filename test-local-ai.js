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
      messages: [{ role: 'user', content: 'Are there any active polls?' }],
      tools: tools,
      tool_choice: "auto"
    });
    
    const message = comp.choices[0]?.message;
    console.log("RAW MESSAGE:", JSON.stringify(message, null, 2));
    
    let toolCallName = "";
    if (message?.tool_calls && message.tool_calls.length > 0) {
      toolCallName = message.tool_calls[0].function.name;
      console.log("EXTRACTED TOOL:", toolCallName);
    } else if (message?.function_call) {
      toolCallName = message.function_call.name;
      console.log("EXTRACTED FUNCTION_CALL:", toolCallName);
    } else {
      console.log("CONTENT:", message?.content || "Sorry, I couldn't generate a response.");
    }
  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
main();
