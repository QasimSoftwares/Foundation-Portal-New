// This file is now deprecated. Use supabaseClient.ts instead.
// Re-exporting for backward compatibility

import { createServerClient } from './supabaseClient';

// Export the function instead of creating an instance to avoid duplicate declarations
export { createServerClient };

// This is now handled by supabaseClient.ts
type SupabaseClient = ReturnType<typeof createServerClient>;
declare global {
  // This prevents duplicate global declarations
  // eslint-disable-next-line no-var
  var __SUPABASE_CLIENT__: SupabaseClient | undefined;
}

// Only create the client if it doesn't exist
if (!global.__SUPABASE_CLIENT__) {
  global.__SUPABASE_CLIENT__ = createServerClient();
}

// Export the singleton instance
export const supabase = global.__SUPABASE_CLIENT__;