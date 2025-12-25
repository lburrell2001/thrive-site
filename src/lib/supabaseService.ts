// src/lib/supabaseService.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertEnv() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service env vars. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local (project root) and restart dev server."
    );
  }
}

// Create the typed client only when used
function getClient(): SupabaseClient<Database> {
  assertEnv();
  return createClient<Database>(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false },
  });
}

// Proxy keeps your “don’t throw at import-time” behavior
export const supabaseService: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getClient();
    // @ts-expect-error dynamic proxy passthrough
    return client[prop];
  },
});
