import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { fetchUserRoles, type UserRole } from '@/lib/security/roles';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const raw = cookieStore.get(name)?.value;
            if (raw && raw.startsWith('base64-')) {
              try {
                return Buffer.from(raw.slice(7), 'base64').toString('utf-8');
              } catch {
                return raw;
              }
            }
            return raw;
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

    const roles: UserRole[] = await fetchUserRoles(user.id, { accessToken: session.access_token });
    return NextResponse.json({ roles }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: 'INTERNAL', message: msg }, { status: 500 });
  }
}
