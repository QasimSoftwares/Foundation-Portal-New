import { Database } from '../types/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  interface SupabaseClient<Database = any> {
    rpc<T = any>(
      fn: string,
      params?: Record<string, any>,
      options?: {
        count?: 'exact' | 'planned' | 'estimated';
        head?: boolean;
      } & Record<string, any>
    ): Promise<{ data: T; error: Error | null }>;
  }
}

declare module '@/lib/supabase-server' {
  export * from '@supabase/supabase-js';
  export { Database } from '../types/supabase';
  
  export function createClient(): SupabaseClient<Database>;
  export function createServerClient(): SupabaseClient<Database>;
  export function createAdminClient(): SupabaseClient<Database>;
  
  export const supabaseClient: SupabaseClient<Database>;
  export const supabaseAdmin: SupabaseClient<Database>;
}
