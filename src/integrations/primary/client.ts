// Primary Supabase project — owns all app data (auth, profiles, products, quotations, invites).
// This is intentionally separate from the Lovable Cloud client (src/integrations/supabase/client.ts),
// which is used ONLY to invoke the extract-quotation edge function.
import { createClient } from "@supabase/supabase-js";

const PRIMARY_SUPABASE_URL = "https://jlegawdatnsfqvuzlpky.supabase.co";
const PRIMARY_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsZWdhd2RhdG5zZnF2dXpscGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjQ4MjAsImV4cCI6MjA5NDcwMDgyMH0.vPAV4Y-BO5tH_6ie7gV9jDI_AOZgvTkPejoybEEjbYY";

const memoryStore = new Map<string, string>();
const safeStorage = {
  getItem: (key: string) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? memoryStore.get(key) ?? null;
    } catch {
      return memoryStore.get(key) ?? null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      memoryStore.set(key, value);
    }
  },
  removeItem: (key: string) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      memoryStore.delete(key);
    }
  },
};

// Untyped client: the auto-generated Database types live in the Lovable Cloud project
// and don't describe this primary project's schema. Keep it loose to avoid type breakage.
export const supabase = createClient<any, any, any>(
  PRIMARY_SUPABASE_URL,
  PRIMARY_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: safeStorage,
      storageKey: "sb-primary-auth",
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
