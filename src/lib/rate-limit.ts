/**
 * In-Memory Sliding Window Rate Limiter
 * 
 * NOTE: In serverless environments (like Vercel), this memory state resets 
 * when the function spins down (cold starts). However, it is highly effective 
 * at stopping active, immediate burst-spam attacks without needing a Redis database.
 */

interface RateLimitData {
  count: number;
  resetTime: number;
}

// Global map to hold rate limit data across invocations while the lambda is warm
const rateLimitMap = new Map<string, RateLimitData>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 30; // High limit to allow humans, block bots

export function checkRateLimit(phone: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const userData = rateLimitMap.get(phone);

  // If new user or their window expired, reset their count
  if (!userData || now > userData.resetTime) {
    rateLimitMap.set(phone, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  // Increment count
  userData.count += 1;
  rateLimitMap.set(phone, userData);

  if (userData.count > MAX_MESSAGES_PER_WINDOW) {
    return { 
      allowed: false, 
      retryAfter: Math.ceil((userData.resetTime - now) / 1000) 
    };
  }

  return { allowed: true };
}
