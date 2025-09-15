// src/app/api/donors/metrics/route.ts

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
          response.cookies.set(name, '', options);
        },
      },
    }
  );

  try {
    // 1. Validate session and get user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      logger.warn("Metrics endpoint called without a valid session.", { sessionError });
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const user = session.user;

    // 2. Perform RBAC check: Only admins can access this.
    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin", { p_user_id: user.id });

    if (rbacError || !isAdmin) {
      logger.warn(`User ${user.id} attempted to access donor metrics without admin privileges.`, { rbacError });
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // 3. Call the RPC to get total donors
    const { data: totalDonors, error: rpcError } = await supabase.rpc("get_total_donors");

    if (rpcError) {
      logger.error("Error calling get_total_donors RPC", { error: rpcError });
      return new NextResponse(JSON.stringify({ error: "Internal Server Error", details: rpcError.message }), { status: 500 });
    }

    // 4. Return the data
    logger.info(`Successfully fetched donor metrics for admin ${user.id}.`);
    return NextResponse.json({ totalDonors });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    logger.error('An unexpected error occurred in the donor metrics endpoint', { error: error instanceof Error ? error : new Error(String(error)) });
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
