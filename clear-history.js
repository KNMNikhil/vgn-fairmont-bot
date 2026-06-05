const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://uvynrhoecfkjdwncwmeh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2eW5yaG9lY2ZramR3bmN3bWVoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY1MDYwOCwiZXhwIjoyMDk2MjI2NjA4fQ.uNKplzEy_X7P5mmCASkuxjSuPM07nM9px-nA2MnkiMw'
);

async function clear() {
  const { error } = await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Cleared history:", error ? error : "Success");
}
clear();
