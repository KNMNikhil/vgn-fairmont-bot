const fs = require('fs');
const { execSync } = require('child_process');

const envContent = fs.readFileSync('.env.local', 'utf8');
const lines = envContent.split('\n');

for (const line of lines) {
  // skip empty lines or comments
  if (!line || line.trim().startsWith('#')) continue;
  
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    
    // remove inline comments (e.g. "value # comment")
    // Note: If value contains # inside quotes this would break, but for our simple .env it's fine
    if (val.includes(' #')) {
      val = val.split(' #')[0].trim();
    }
    
    console.log(`Removing ${key}...`);
    try {
      execSync(`npx vercel env rm ${key} production -y`, { stdio: 'pipe' });
    } catch (err) {}

    console.log(`Pushing ${key}...`);
    try {
      execSync(`printf "%s" "${val.replace(/"/g, '\\"')}" | npx vercel env add ${key} production`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`Failed to push ${key}`);
    }
  }
}
