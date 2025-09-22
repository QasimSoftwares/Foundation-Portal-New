// src/app/api/admin/programs/category/update/route.ts
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
      logger.warn("[Programs] Category update without session", { sessionError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin");
    if (rbacError || !isAdmin) {
      logger.warn("[Programs] Category update forbidden", { userId, rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({} as any));
    const category_id = String(body?.category_id || "").trim();
    const name = typeof body?.name === 'string' ? body.name.trim() : null;
    const description = typeof body?.description === 'string' ? body.description : null;

    if (!category_id) {
      return NextResponse.json({ error: "category_id is required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("update_donation_category", {
      p_category_id: category_id,
      p_name: name,
      p_description: description,
      p_user_id: userId,
    });

    if (error) {
      logger.error("[Programs] update_donation_category RPC error", { error });
      return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
    }

    if (!data || data.status !== "success") {
      return NextResponse.json({ error: data?.message || "Failed to update category" }, { status: 400 });
    }

    return NextResponse.json({ donation_category_id: data.donation_category_id, status: data.status });
  } catch (err) {
    logger.error("[Programs] Category update unexpected error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
