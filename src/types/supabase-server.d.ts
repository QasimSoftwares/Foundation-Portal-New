import { Database } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';

declare module '@/lib/supabase-server' {
  export function createServerClient(): SupabaseClient<Database>;
  
  export interface SupabaseClient<Database = any> {
    rpc<T = any>(
      fn: string,
      params?: Record<string, any>,
      options?: {
        head?: boolean;
        count?: 'exact' | 'planned' | 'estimated';
      }
    ): Promise<{ data: T; error: any }>;
  }
}