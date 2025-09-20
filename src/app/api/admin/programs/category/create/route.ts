// src/app/api/admin/programs/category/create/route.ts
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
    // Auth session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      logger.warn("[Programs] Category create without session", { sessionError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // RBAC: admin only
    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin", { p_user_id: userId });
    if (rbacError || !isAdmin) {
      logger.warn("[Programs] Category create forbidden", { userId, rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({} as any));
    const name = String(body?.name || "").trim();
    const description = typeof body?.description === "string" ? body.description : null;

    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    // RPC-first insert
    const { data, error } = await supabase.rpc("create_donation_category", {
      p_name: name,
      p_description: description,
      p_user_id: userId,
    });

    if (error) {
      logger.error("[Programs] create_donation_category RPC error", { error });
      return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
    }

    // data is JSONB { status, donation_category_id, ... }
    if (!data || data.status !== "success") {
      return NextResponse.json({ error: data?.message || "Failed to create category" }, { status: 400 });
    }

    // Return the id for now; later we can fetch full record via list RPC
    return NextResponse.json({ donation_category_id: data.donation_category_id, status: data.status });
  } catch (err) {
    logger.error("[Programs] Category create unexpected error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
