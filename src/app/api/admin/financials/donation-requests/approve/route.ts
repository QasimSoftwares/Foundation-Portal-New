// src/app/api/admin/financials/donation-requests/approve/route.ts
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
      logger.warn("[Financials] Approve donation request without session", { sessionError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // RBAC: admin only
    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin", { p_user_id: userId });
    if (rbacError || !isAdmin) {
      logger.warn("[Financials] Approve donation request forbidden", { userId, rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({} as any));
    const donation_request_id = String(body?.donation_request_id || "").trim();

    if (!donation_request_id) {
      return NextResponse.json({ error: "donation_request_id is required" }, { status: 400 });
    }

    // Delegate to atomic approval route to generate/upload receipt and update receipt_pdf_path
    const approveUrl = new URL("/api/admin/donations/approve", request.url);
    const forwardHeaders = new Headers({ "Content-Type": "application/json" });
    const csrf = request.headers.get("x-csrf-token");
    if (csrf) forwardHeaders.set("x-csrf-token", csrf);
    const cookie = request.headers.get("cookie");
    if (cookie) forwardHeaders.set("cookie", cookie);

    const res = await fetch(approveUrl, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify({ donation_request_id }),
    });

    const json = await res.json().catch(() => ({ status: "error", message: "Invalid response" }));
    if (!res.ok || json?.status !== "success") {
      logger.error("[Financials] Atomic approval failed", { donation_request_id, status: res.status, json });
      return NextResponse.json(json ?? { error: "Approval failed" }, { status: res.status || 500 });
    }

    return NextResponse.json(json, { status: 200 });
  } catch (err) {
    logger.error("[Financials] Approve donation request unexpected error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
