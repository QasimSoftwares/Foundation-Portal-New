import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

type MiddlewareHandler = (req: NextRequest) => Promise<NextResponse> | NextResponse;

export function createMiddlewareClient() {
  const cookieStore = require('next/headers').cookies();
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle cookie setting error in middleware
            console.error('Error setting cookie:', error);
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.error('Error removing cookie:', error);
          }
        },
      },
    }
  );
}

export function withAuth(handler: MiddlewareHandler, requiredRole?: string): MiddlewareHandler {
  return async (req: NextRequest) => {
    try {
      const supabase = createMiddlewareClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        return NextResponse.redirect(new URL('/auth/signin', req.url));
      }
      
      if (requiredRole) {
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single<{ role: string }>();
          
        if (userError || userData?.role !== requiredRole) {
          return NextResponse.redirect(new URL('/unauthorized', req.url));
        }
      }
      
      return handler(req);
    } catch (error) {
      console.error('Auth error:', error);
      return NextResponse.redirect(new URL('/auth/error', req.url));
    }
  };
}

export function requireAdmin(handler: MiddlewareHandler): MiddlewareHandler {
  return withAuth(handler, 'admin');
}

export function requirePermission(permission: string) {
  return function(handler: MiddlewareHandler): MiddlewareHandler {
    return async (req: NextRequest) => {
      try {
        const supabase = createMiddlewareClient();
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          return NextResponse.redirect(new URL('/auth/signin', req.url));
        }
        
        // Check if user has the required permission
        const { data: hasPermission, error: permError } = await supabase.rpc('has_permission', {
          user_id: session.user.id,
          permission_name: permission
        });
        
        if (permError || !hasPermission) {
          return NextResponse.redirect(new URL('/unauthorized', req.url));
        }
        
        return handler(req);
      } catch (error) {
        console.error('Permission check error:', error);
        return NextResponse.redirect(new URL('/auth/error', req.url));
      }
    };
  };
}
