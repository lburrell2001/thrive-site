// src/lib/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Don’t throw at import-time — it breaks route compilation.
// Throw only when someone actually tries to use the client.
function assertEnv() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (project root) and restart dev server."
    );
  }
}

export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      assertEnv();
      const client = createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: { persistSession: false },
      });
      // @ts-expect-error proxy passthrough
      return client[prop];
    },
  }
) as ReturnType<typeof createClient>;
