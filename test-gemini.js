require('dotenv').config({path: '.env.local'});
const OpenAI = require('openai');
const openai = new OpenAI({
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  apiKey: process.env.GEMINI_API_KEY
});
async function main() {
  const comp = await openai.chat.completions.create({
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: "I need a plumber" }],
    tools: [
      {
        type: "function",
        function: {
          name: "get_local_services",
          description: "Get a list of trusted local service vendors.",
          parameters: {
            type: "object",
            properties: {
              category: { type: "string" }
            }
          }
        }
      }
    ]
  });
  console.log(JSON.stringify(comp.choices[0].message, null, 2));
}
main();
