// src/app/api/admin/financials/donation-requests/create/route.ts
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
      logger.warn("[Financials] Create donation request without session", { sessionError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // RBAC: admin only
    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin", { p_user_id: userId });
    if (rbacError || !isAdmin) {
      logger.warn("[Financials] Create donation request forbidden", { userId, rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({} as any));

    const donor_number = String(body?.donor_number || "").trim();
    const amount = Number(body?.amount);
    const currency = String(body?.currency || "PKR");
    const category_name = String(body?.category_name || "").trim();
    const project_name = String(body?.project_name || "").trim();
    const mode_of_payment = String(body?.mode_of_payment || "");
    const donation_type = String(body?.donation_type || "");
    const donation_date = String(body?.donation_date || "");
    const transaction_id = String(body?.transaction_id || "").trim() || null;

    if (!donor_number || !category_name || !project_name || !mode_of_payment || !donation_type || !donation_date || !Number.isFinite(amount)) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("create_donation_request", {
      p_donor_number: donor_number,
      p_amount: amount,
      p_currency: currency,
      p_category_name: category_name,
      p_project_name: project_name,
      p_mode_of_payment: mode_of_payment,
      p_donation_type: donation_type,
      p_donation_date: donation_date,
      p_transaction_id: transaction_id,
    });

    if (error) {
      logger.error("[Financials] create_donation_request RPC error", { error });
      return NextResponse.json({ error: "Failed to create donation request" }, { status: 500 });
    }

    return NextResponse.json({ status: "success", donation_request: data });
  } catch (err) {
    logger.error("[Financials] Create donation request unexpected error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
