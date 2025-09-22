// src/app/api/admin/events/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );

  const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin');
  if (adminErr || !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase.rpc('list_events');
  if (error) {
    return NextResponse.json({ error: 'Failed to load events', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}
