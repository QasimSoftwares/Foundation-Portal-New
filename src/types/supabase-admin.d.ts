import { SupabaseClient } from '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  interface SupabaseAuthAdminApi {
    signOut: (userId: string) => Promise<{ error?: Error }>;
  }

  interface SupabaseAuthClient {
    admin?: SupabaseAuthAdminApi;
  }
}

// Export the extended SupabaseClient type
export type SupabaseAdminClient = SupabaseClient & {
  auth: {
    admin?: {
      signOut: (userId: string) => Promise<{ error?: Error }>;
    };
  };
};
