import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/utils/logger';

// GET handler to fetch the user's profile
export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set(name, value, options),
        remove: (name, options) => cookieStore.set(name, '', options),
      },
    }
  );

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase.rpc('get_user_profile');

    if (error) {
      throw error;
    }

    return NextResponse.json(profile);
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Profile fetch error:', { error: errorObj });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST handler to update the user's profile
export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set(name, value, options),
        remove: (name, options) => cookieStore.set(name, '', options),
      },
    }
  );

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profileData = await request.json();
    const { error } = await supabase.rpc('update_user_profile', { ...profileData });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Profile updated successfully.' });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Profile update error:', { error: errorObj });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
