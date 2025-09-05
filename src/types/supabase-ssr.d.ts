// Type definitions for @supabase/ssr
declare module '@supabase/ssr' {
  import { SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';
  import { CookieOptions } from '@supabase/ssr';
  import { NextRequest, NextResponse } from 'next/server';

  export function createServerClient<Database = any, SchemaName extends string & keyof Database = 'public' extends keyof Database ? 'public' : string & keyof Database>(
    supabaseUrl: string,
    supabaseKey: string,
    options: {
      cookies: {
        get(name: string): string | undefined;
        set(name: string, value: string, options: CookieOptions): void;
        remove(name: string, options: CookieOptions): void;
      };
      cookieOptions?: CookieOptions;
      isSingleton?: boolean;
      options?: SupabaseClientOptions<SchemaName>;
    }
  ): SupabaseClient<Database, SchemaName>;

  export interface CookieOptions {
    name: string;
    lifetime?: number;
    domain?: string;
    path?: string;
    sameSite?: 'lax' | 'strict' | 'none';
    secure?: boolean;
    httpOnly?: boolean;
  }

  export interface CookieMethods {
    get(name: string): string | undefined;
    set(name: string, value: string, options: CookieOptions): void;
    remove(name: string, options: CookieOptions): void;
  }

  export function createMiddlewareClient(
    request: NextRequest,
    response: NextResponse
  ): {
    supabase: SupabaseClient;
    response: NextResponse;
  };
}
