// src/app/api/admin/financials/donors/search/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });

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
          response.cookies.set(name, "", options);
        },
      },
    }
  );

  try {
    // Auth session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      logger.warn("[Financials] Donor search without session", { sessionError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Admin only
    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin");
    if (rbacError || !isAdmin) {
      logger.warn("[Financials] Donor search forbidden", { userId, rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    // Call the dedicated search RPC
    const { data: results, error: searchError } = await supabase
      .rpc('search_donors_by_admin', { p_query: q });

    if (searchError) {
      logger.error('[Financials] Donor search RPC error', { error: searchError });
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    return NextResponse.json({ results: results || [] });
  } catch (err) {
    logger.error("[Financials] Donor search unexpected error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
