// src/app/api/admin/members/metrics/route.ts
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
      logger.warn("Member metrics called without a valid session.", { sessionError });
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const user = session.user;

    // Only admins can view full metrics in the admin endpoint
    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin");
    if (rbacError || !isAdmin) {
      logger.warn(`User ${user.id} attempted to access member metrics without admin privileges.`, { rbacError });
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // Fetch counts via RPCs (SECURITY INVOKER, RLS-safe)
    // Note: These RPCs need to be created in the database
    const [
      { data: totalMembers, error: totalErr },
      { data: pendingRequests, error: pendingErr },
      { data: approvedMembers, error: approvedErr },
      { data: rejectedMembers, error: rejectedErr },
    ] = await Promise.all([
      supabase.rpc("count_members"),
      supabase.rpc("count_pending_member_requests"),
      supabase.rpc("count_approved_members"),
      supabase.rpc("count_rejected_member_requests"),
    ]);

    // Check for any errors in the RPC calls
    const errors = [totalErr, pendingErr, approvedErr, rejectedErr].filter(Boolean);
    if (errors.length > 0) {
      logger.error("Error fetching member metrics:", { errors });
      return new NextResponse(
        JSON.stringify({ error: "Failed to fetch member metrics" }),
        { status: 500 }
      );
    }

    // Log successful metric retrieval
    logger.info("Successfully fetched member metrics", {
      totalMembers,
      pendingRequests,
      approvedMembers,
      rejectedMembers,
    });

    // Return the metrics
    return NextResponse.json({
      totalMembers: totalMembers || 0,
      pendingRequests: pendingRequests || 0,
      approvedMembers: approvedMembers || 0,
      rejectedMembers: rejectedMembers || 0,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error("An unknown error occurred");
    logger.error("Unexpected error in member metrics endpoint:", { error: errorObj });
    return new NextResponse(
      JSON.stringify({ error: errorObj.message }),
      { status: 500 }
    );
  }
}
