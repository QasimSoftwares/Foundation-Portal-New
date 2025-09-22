// src/app/api/admin/dashboard-metrics/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

export const dynamic = 'force-dynamic';

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
          response.cookies.set(name, '', options);
        },
      },
    }
  );

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      logger.warn("[admin-dashboard-metrics] Unauthorized access attempt.", { error: userError || new Error('No user found') });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin");
    if (rbacError || !isAdmin) {
      logger.warn(`[admin-dashboard-metrics] Forbidden access for user ${user.id}`, { rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // In Task 3, we will create this consolidated RPC.
    // For now, we assume it exists and returns all metrics.
    const { data, error: rpcError } = await supabase.rpc("get_admin_dashboard_metrics");

    if (rpcError) {
      logger.error("[admin-dashboard-metrics] RPC error", { rpcError });
      return NextResponse.json({ error: "Internal Server Error", details: rpcError.message }, { status: 500 });
    }

    // The RPC returns a single object with snake_case keys.
    // We transform it into a flat JSON object with camelCase keys for the frontend.
    const metrics = {
      totalDonors: data.total_donors ?? 0,
      totalDonations: data.total_donations ?? 0,
      totalVolunteers: data.total_volunteers ?? 0,
      totalMembers: data.total_members ?? 0,
    };

    const response = NextResponse.json(metrics);
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return response;

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("[admin-dashboard-metrics] Unexpected error", { error: err });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
