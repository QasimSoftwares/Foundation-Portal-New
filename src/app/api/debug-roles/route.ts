import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
  try {
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

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user roles directly from the database
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (rolesError || !userRoles) {
      return NextResponse.json({
        error: 'Failed to fetch user roles',
        details: rolesError?.message || 'No roles found for user',
        userId: session.user.id,
      }, { status: 400 });
    }

    // Try the RPC function
    const { data: rpcRoles, error: rpcError } = await supabase
      .rpc('get_user_roles', { p_user_id: session.user.id });

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
      },
      user_roles: userRoles,
      rpc_roles: rpcRoles,
      rpc_error: rpcError,
    });

  } catch (error) {
    console.error('Debug roles error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
