// src/app/api/admin/events/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function POST(request: NextRequest) {
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

  // RBAC: ensure admin
  const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin');
  if (adminErr || !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const {
    event_name,
    location,
    volunteers_required,
    aim_of_event,
    start_date,
    end_date,
    site_status,
  } = body || {};

  if (!event_name || !start_date || !site_status) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('create_event', {
    p_event_name: event_name,
    p_location: location ?? null,
    p_volunteers_required: volunteers_required ?? null,
    p_aim_of_event: aim_of_event ?? null,
    p_start_date: start_date,
    p_end_date: end_date ?? null,
    p_site_status: site_status,
    p_created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to create event', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ event_id: data }, { status: 201 });
}
