// src/app/api/admin/volunteers/metrics/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
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
      logger.warn("Volunteer metrics called without a valid session.", { sessionError });
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const user = session.user;

    // Only admins can view full metrics in the admin endpoint
    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin");
    if (rbacError || !isAdmin) {
      logger.warn(`User ${user.id} attempted to access volunteer metrics without admin privileges.`, { rbacError });
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // Fetch counts via RPCs (SECURITY INVOKER, RLS-safe)
    const [{ data: totalVolunteers, error: totalErr },
           { data: pendingRows, error: pendingErr },
           { data: approvedRows, error: approvedErr },
           { data: rejectedRows, error: rejectedErr }] = await Promise.all([
      supabase.rpc("get_total_volunteers"),
      supabase.rpc("get_pending_volunteer_requests"),
      supabase.rpc("get_approved_volunteers"),
      supabase.rpc("get_rejected_volunteers"),
    ]);

    if (totalErr || pendingErr || approvedErr || rejectedErr) {
      logger.error("Volunteer metrics RPC error", { totalErr, pendingErr, approvedErr, rejectedErr });
      return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }

    const metrics = {
      totalVolunteers: Number(totalVolunteers ?? 0),
      pendingVolunteerRequests: Array.isArray(pendingRows) ? pendingRows.length : 0,
      approvedVolunteers: Array.isArray(approvedRows) ? approvedRows.length : 0,
      rejectedVolunteers: Array.isArray(rejectedRows) ? rejectedRows.length : 0,
    };

    logger.info(`Successfully fetched volunteer metrics for admin ${user.id}.`);
    return NextResponse.json(metrics);
  } catch (error) {
    logger.error("Unexpected error in volunteer metrics endpoint", { error: error instanceof Error ? error : new Error(String(error)) });
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
