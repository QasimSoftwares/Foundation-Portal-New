// src/app/api/admin/metrics/total-donations/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
  // Mirror pattern from src/app/api/donors/metrics/route.ts
  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
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
      logger.warn("[total-donations] Unauthorized access attempt.", { sessionError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin", { p_user_id: user.id });
    if (rbacError || !isAdmin) {
      logger.warn(`[total-donations] Forbidden for user ${user.id}`, { rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error: rpcError } = await supabase.rpc("get_total_donations");
    if (rpcError) {
      logger.error("[total-donations] RPC error", { rpcError });
      return NextResponse.json({ error: "Internal Server Error", details: rpcError.message }, { status: 500 });
    }

    const total_donations = Number(data ?? 0);
    return NextResponse.json({ total_donations });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("[total-donations] Unexpected error", { error: err });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
