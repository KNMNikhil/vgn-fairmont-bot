import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));

for (const key in envConfig) {
  const value = envConfig[key];
  console.log(`Removing ${key}...`);
  try {
    execSync(`npx vercel env rm ${key} production -y`, { stdio: 'pipe' });
  } catch (err) {} // ignore if it doesn't exist

  console.log(`Pushing ${key}...`);
  try {
    execSync(`printf "%s" "${value.replace(/"/g, '\\"')}" | npx vercel env add ${key} production`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Failed to push ${key}`);
  }
}
