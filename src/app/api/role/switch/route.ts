import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { fetchUserRoles, hasRole, type UserRole } from '@/lib/security/roles';
import { ROLE_DASHBOARDS } from '@/config/routes';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const desiredRole: UserRole | undefined = body?.role;

    if (!desiredRole) {
      return NextResponse.json({ error: 'INVALID_ROLE' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      },
    );

    // Get both session and user for verification
    const [
      { data: { session } },
      { data: { user } }
    ] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser()
    ]);

    // Only proceed if we have a verified user
    if (!session?.user?.id || !user?.id || session.user.id !== user.id) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Fetch roles via centralized helper and validate requested role is allowed
    const roles = await fetchUserRoles(session.user.id, { accessToken: session.access_token });
    if (!hasRole(roles, desiredRole)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // Set cookie
    const dashboard = ROLE_DASHBOARDS[desiredRole] || ROLE_DASHBOARDS.viewer;
    const res = NextResponse.json({ ok: true, role: desiredRole, dashboard });
    res.cookies.set({
      name: 'active-role',
      value: desiredRole,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: 'INTERNAL', message: msg }, { status: 500 });
  }
}
