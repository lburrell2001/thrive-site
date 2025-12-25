// src/lib/supabaseService.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Same idea: don’t throw at import-time
function assertEnv() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service env vars. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and restart."
    );
  }
}

export const supabaseService = new Proxy(
  {},
  {
    get(_target, prop) {
      assertEnv();
      const client = createClient(supabaseUrl!, serviceRoleKey!, {
        auth: { persistSession: false },
      });
      // @ts-expect-error proxy passthrough
      return client[prop];
    },
  }
) as ReturnType<typeof createClient>;
