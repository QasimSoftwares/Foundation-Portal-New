// src/app/api/admin/volunteers/list/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/admin/volunteers/list?status=pending|approved|rejected|all&page=1&pageSize=20
 * Returns a normalized list of volunteer records matching the given status.
 * - pending/rejected are sourced from role_requests (request_type = 'volunteer')
 * - approved is sourced from user_roles where is_volunteer = true
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") || "pending").toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

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
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const user = session.user;

    // Admin-only admin endpoint
    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin", { p_user_id: user.id });
    if (rbacError || !isAdmin) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // Choose RPC based on status; await calls directly to avoid type mismatch
    const results: Array<{ data: any; error: any }> = [];
    if (status === "pending") {
      const r1 = await supabase.rpc("get_pending_volunteer_requests");
      results.push(r1);
    } else if (status === "approved") {
      const r1 = await supabase.rpc("get_approved_volunteers");
      results.push(r1);
    } else if (status === "rejected") {
      const r1 = await supabase.rpc("get_rejected_volunteers");
      results.push(r1);
    } else {
      const r1 = await supabase.rpc("get_pending_volunteer_requests");
      const r2 = await supabase.rpc("get_approved_volunteers");
      const r3 = await supabase.rpc("get_rejected_volunteers");
      results.push(r1, r2, r3);
    }
    const errors = results.map(r => r.error).filter(Boolean);
    if (errors.length > 0) {
      logger.error("Volunteer list RPC error", { errors });
      return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }

    const rows = results.flatMap(r => Array.isArray(r.data) ? r.data : []);

    type Normalized = {
      id: string;
      full_name: string;
      email: string;
      status: 'pending' | 'approved' | 'rejected';
      created_at: string;
      updated_at: string;
    };

    // Normalize shapes
    const normalized: Normalized[] = rows.map((row: any) => {
      if (row.request_id) {
        // From role_requests (pending/rejected)
        return {
          id: String(row.request_id),
          full_name: row.full_name || 'Unknown',
          email: row.email || 'No email',
          status: (row.status || 'pending') as Normalized['status'],
          created_at: row.created_at,
          updated_at: row.updated_at || row.created_at,
        };
      }
      // From user_roles (approved)
      return {
        id: String(row.user_id),
        full_name: row.full_name || 'Unknown',
        email: row.email || 'No email',
        status: 'approved',
        created_at: row.approved_at || new Date().toISOString(),
        updated_at: row.approved_at || new Date().toISOString(),
      };
    });

    // Simple pagination (client-side slicing for now; can move to SQL LIMIT/OFFSET if needed)
    const start = (page - 1) * pageSize;
    const paginated = normalized.slice(start, start + pageSize);

    return NextResponse.json({
      page,
      pageSize,
      total: normalized.length,
      items: paginated,
    });
  } catch (error) {
    logger.error("Unexpected error in volunteer list endpoint", { error: error instanceof Error ? error : new Error(String(error)) });
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
