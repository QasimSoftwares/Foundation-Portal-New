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
    },
  });
}

// Server client for server components and API routes
export async function createServerClient() {
  const cookieStore = await cookies();
  
  return createServerComponent<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            // In Next.js 14+, cookies are set via the response headers
            // The actual cookie setting should be handled by the response object
            // in the API route or server component
            // We'll just return the cookie data to be set by the response
            return { name, value, ...options };
          } catch (error) {
            console.error('Error setting cookie:', error);
            return null;
          }
        },
        remove(name: string, options: any) {
          try {
            // Return cookie removal data to be set by the response
            return { 
              name, 
              value: '', 
              ...options, 
              path: '/',
              maxAge: 0,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              httpOnly: true
            };
          } catch (error) {
            console.error('Error removing cookie:', error);
            return null;
          }
        },
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

