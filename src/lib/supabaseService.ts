// src/lib/supabaseService.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Don’t throw at import-time — only when actually used
function assertEnv() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service env vars. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local (project root) and restart dev server."
    );
  }
}

export const supabaseService = new Proxy(
  {},
  {
    get(_target, prop) {
      assertEnv();

      const client = createClient<Database>(supabaseUrl!, serviceRoleKey!, {
        auth: { persistSession: false },
      });

      // @ts-expect-error proxy passthrough
      return client[prop];
    },
  }
) as ReturnType<typeof createClient<Database>>;
