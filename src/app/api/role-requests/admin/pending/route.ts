import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  const response = new NextResponse();
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const cookie = cookieStore.get(name)?.value;
            if (cookie && cookie.startsWith('base64-')) {
              try { return Buffer.from(cookie.slice(7), 'base64').toString('utf-8'); } catch { return cookie; }
            }
            return cookie;
          },
          set(name: string, value: string, options: any) { response.cookies.set({ name, value, ...options }); },
          remove(name: string, options: any) { response.cookies.set({ name, value: '', ...options, maxAge: 0 }); },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: response.headers });

    const { data, error } = await supabase.rpc('get_pending_role_requests');
    if (error) return NextResponse.json({ error: error.message || 'Forbidden' }, { status: 403, headers: response.headers });

    return NextResponse.json({ success: true, requests: data || [] }, { status: 200, headers: response.headers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500, headers: response.headers });
  }
}
