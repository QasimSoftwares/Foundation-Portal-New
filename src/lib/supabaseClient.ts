import { createClient as createClientComponent } from '@supabase/supabase-js';
import { createServerClient as createServerComponent } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

type SupabaseClient = ReturnType<typeof createClientComponent<Database>>;

// Environment variables should be prefixed with NEXT_PUBLIC_ for client-side usage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables');
}

// Client for client components
export function createClient() {
  return createClientComponent<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

// Server client for server components and API routes
export function createServerClient() {
  // In Next.js 14+, we'll use the cookies API directly in our route handlers
  // This client will be used in server components and API routes
  
  return createServerComponent<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Required cookies object with get/set/remove methods
      cookies: {
        get(name: string) {
          // This will be handled by the framework
          return undefined;
        },
        set(name: string, value: string, options: any) {
          // This will be handled by the framework
          return { name, value, ...options };
        },
        remove(name: string, options: any = {}) {
          // This will be handled by the framework
          return { 
            name, 
            value: '', 
            ...options, 
            maxAge: 0,
            path: '/',
            sameSite: 'lax' as const,
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true
          };
        },
      },
      // These options are passed to the underlying Supabase client
      options: {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: false,
          autoRefreshToken: true,
          persistSession: true,
        },
      },
      // Cookie options
      cookieOptions: {
        name: 'sb-auth-token',
        lifetime: 60 * 60 * 24 * 7, // 7 days
        domain: '',
        path: '/',
        sameSite: 'lax',
      },
    }
  );
}

// Admin client for server-side admin operations
export function createAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  }
  return createClientComponent<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Default exports for backward compatibility
export const supabaseClient = createClient();
export const supabaseAdmin = createAdminClient();

export type { User } from '@supabase/supabase-js';

