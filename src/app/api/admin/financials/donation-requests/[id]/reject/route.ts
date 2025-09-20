// src/app/api/admin/financials/donation-requests/[id]/reject/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
      logger.warn("[Financials] Reject donation request without session", { sessionError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: reqId } = await context.params;

    // RBAC: admin only
    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin", { p_user_id: userId });
    if (rbacError || !isAdmin) {
      logger.warn("[Financials] Reject donation request forbidden", { userId, rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({} as any));
    const reason = String(body?.reason || "");

    const { data, error } = await supabase.rpc("reject_donation_request", {
      p_donation_request_id: reqId,
      p_reason: reason,
    });

    if (error) {
      logger.error("[Financials] reject_donation_request RPC error", { error, reqId });
      return NextResponse.json({ error: error.message || "Failed to reject donation request" }, { status: 400 });
    }

    return NextResponse.json({ status: "success", donation_request: data });
  } catch (err) {
    logger.error("[Financials] Reject donation request unexpected error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
