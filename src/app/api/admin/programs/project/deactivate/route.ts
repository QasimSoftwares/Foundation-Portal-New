// src/app/api/admin/programs/project/deactivate/route.ts
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
      logger.warn("[Programs] Project deactivate without session", { sessionError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin");
    if (rbacError || !isAdmin) {
      logger.warn("[Programs] Project deactivate forbidden", { userId, rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({} as any));
    const project_id = String(body?.project_id || "").trim();
    if (!project_id) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("deactivate_project", {
      p_project_id: project_id,
      p_user_id: userId,
    });

    if (error) {
      logger.error("[Programs] deactivate_project RPC error", { error });
      return NextResponse.json({ error: "Failed to deactivate project" }, { status: 500 });
    }

    if (!data || data.status !== "success") {
      return NextResponse.json({ error: data?.message || "Failed to deactivate project" }, { status: 400 });
    }

    return NextResponse.json({ project_id: data.project_id, status: data.status });
  } catch (err) {
    logger.error("[Programs] Project deactivate unexpected error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
