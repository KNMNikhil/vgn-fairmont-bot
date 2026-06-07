import { createClient, SupabaseClient } from "@supabase/supabase-js";

function validateSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !url.startsWith("https://")) {
    throw new Error(
      `[Supabase] NEXT_PUBLIC_SUPABASE_URL is missing or invalid. Got: "${url}"`
    );
  }
  if (!key || key.length < 20) {
    throw new Error(
      `[Supabase] SUPABASE_SERVICE_ROLE_KEY is missing or too short.`
    );
  }
  return { url, key };
}

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const { url, key } = validateSupabaseEnv();
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSupabase() as any)[prop];
  },
});
