import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const allowedTypes = new Set(['donor','volunteer','member']);

export async function POST(request: NextRequest) {
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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: response.headers });
    }

    const body = await request.json().catch(() => ({}));
    const type = (body?.type || '').toString().toLowerCase();
    const notes = body?.notes ? String(body.notes) : null;
    if (!allowedTypes.has(type)) {
      return NextResponse.json({ error: 'Invalid request type' }, { status: 400, headers: response.headers });
    }

    const { data: requestId, error } = await supabase.rpc('submit_role_request', {
      p_user_id: session.user.id,
      p_type: type,
      p_notes: notes,
    });

    if (error) {
      const message = error.message.includes('request_already_pending') || error.message.includes('pending')
        ? 'You already have a pending request'
        : 'Failed to submit request';
      return NextResponse.json({ error: message }, { status: 400, headers: response.headers });
    }

    return NextResponse.json({ success: true, requestId }, { status: 200, headers: response.headers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500, headers: response.headers });
  }
}
