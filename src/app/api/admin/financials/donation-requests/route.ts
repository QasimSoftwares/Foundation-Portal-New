// src/app/api/admin/financials/donation-requests/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
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
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      logger.warn("[Financials] List donation requests without session", { sessionError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // RBAC: admin only
    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin");
    if (rbacError || !isAdmin) {
      logger.warn("[Financials] List donation requests forbidden", { userId, rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get both pending requests and total count in parallel
    const [
      { data: requests, error: requestsError },
      { data: totalCount, error: countError }
    ] = await Promise.all([
      supabase.rpc("list_pending_donation_requests"),
      supabase.rpc("count_total_donation_requests")
    ]);

    if (requestsError) {
      logger.error("[Financials] List donation requests DB error", { error: requestsError });
      return NextResponse.json({ error: "Failed to fetch donation requests" }, { status: 500 });
    }

    if (countError) {
      logger.error("[Financials] Count donation requests DB error", { error: countError });
      // Don't fail the whole request if count fails, just log it
    }

    return NextResponse.json({ 
      status: "success", 
      requests: requests || [],
      total_requests: totalCount || 0
    });
  } catch (err) {
    logger.error("[Financials] List donation requests unexpected error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
