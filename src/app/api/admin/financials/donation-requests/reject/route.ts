// src/app/api/admin/financials/donation-requests/reject/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
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

    // RBAC: admin only
    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin");
    if (rbacError || !isAdmin) {
      logger.warn("[Financials] Reject donation request forbidden", { userId, rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({} as any));
    const donation_request_id = String(body?.donation_request_id || "").trim();
    const reason = typeof body?.reason === "string" ? body.reason : "";

    if (!donation_request_id) {
      return NextResponse.json({ error: "donation_request_id is required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("reject_donation_request", {
      p_donation_request_id: donation_request_id,
      p_reason: reason,
    });

    if (error) {
      logger.error("[Financials] reject_donation_request RPC error", { error });
      return NextResponse.json({ error: error.message || "Failed to reject donation request" }, { status: 400 });
    }

    return NextResponse.json({ status: "rejected", donation_request: data });
  } catch (err) {
    logger.error("[Financials] Reject donation request unexpected error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
