const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://uvynrhoecfkjdwncwmeh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2eW5yaG9lY2ZramR3bmN3bWVoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY1MDYwOCwiZXhwIjoyMDk2MjI2NjA4fQ.uNKplzEy_X7P5mmCASkuxjSuPM07nM9px-nA2MnkiMw'
);

async function check() {
  const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(2);
  console.log(JSON.stringify(data, null, 2));
}
check();
