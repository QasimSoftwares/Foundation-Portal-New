// src/app/api/donor/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category_id = searchParams.get('category_id');
  const project_id = searchParams.get('project_id');

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

  const rpcParams: Record<string, string | null> = {};
  if (category_id) rpcParams.p_category_id = category_id;
  if (project_id) rpcParams.p_project_id = project_id;

  const { data, error } = await supabase.rpc('get_donor_donations_summary', rpcParams);
  if (error) {
    return NextResponse.json({ error: 'Failed to load summary', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ summary: data ?? [] });
}
