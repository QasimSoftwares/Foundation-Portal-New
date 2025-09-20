// src/app/api/admin/programs/project/update/route.ts
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
      logger.warn("[Programs] Project update without session", { sessionError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin", { p_user_id: userId });
    if (rbacError || !isAdmin) {
      logger.warn("[Programs] Project update forbidden", { userId, rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({} as any));
    const project_id = String(body?.project_id || "").trim();
    const name = typeof body?.name === 'string' ? body.name.trim() : null;
    const description = typeof body?.description === 'string' ? body.description : null;
    const start_date = body?.start_date ? new Date(body.start_date) : null;
    const end_date = body?.end_date ? new Date(body.end_date) : null;
    const target_amount = typeof body?.target_amount === "number" ? body.target_amount : null;

    if (!project_id) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("update_project", {
      p_project_id: project_id,
      p_name: name,
      p_description: description,
      p_start_date: start_date ? start_date.toISOString().slice(0, 10) : null,
      p_end_date: end_date ? end_date.toISOString().slice(0, 10) : null,
      p_target_amount: target_amount,
      p_user_id: userId,
    });

    if (error) {
      logger.error("[Programs] update_project RPC error", { error });
      return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }

    if (!data || data.status !== "success") {
      return NextResponse.json({ error: data?.message || "Failed to update project" }, { status: 400 });
    }

    return NextResponse.json({ project_id: data.project_id, status: data.status });
  } catch (err) {
    logger.error("[Programs] Project update unexpected error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
