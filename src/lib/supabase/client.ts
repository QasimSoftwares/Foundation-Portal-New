import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a singleton instance of the Supabase client
let supabaseInstance: SupabaseClient | null = null;

function createSupabaseClientInstance() {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        debug: false, // Disable debug logs in production
      },
      global: {
        headers: {
          'X-Client-Info': 'foundation-portal'
        }
      }
    });
  }
  return supabaseInstance;
}

// Get the singleton instance
const supabase = createSupabaseClientInstance();

export { supabase };

// For backward compatibility
const createClient = () => supabase;

export default createClient;
