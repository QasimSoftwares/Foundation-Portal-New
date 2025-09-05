import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import { NextResponse, type NextRequest } from 'next/server';

export const createMiddlewareClient = (request: NextRequest) => {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(cookieName: string, value: string, options: CookieOptions) {
          // Only set in response, not in request
          const { name, ...restOptions } = options;
          response.cookies.set({
            name: cookieName,
            value,
            path: '/',
            ...restOptions,
          });
        },
        remove(cookieName: string, options: CookieOptions) {
          // Only set in response, not in request
          const { name, ...restOptions } = options;
          response.cookies.set({
            name: cookieName,
            value: '',
            expires: new Date(0),
            path: '/',
            ...restOptions,
          });
        },
      },
    }
  );

  return { supabase, response };
};
