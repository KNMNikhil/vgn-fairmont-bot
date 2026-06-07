const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const lines = envContent.split('\n');

for (const line of lines) {
  if (!line || line.trim().startsWith('#')) continue;
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.includes(' #')) val = val.split(' #')[0].trim();
    console.log(`Key: [${key}]`);
    console.log(`Val: [${val}]`);
  }
}
