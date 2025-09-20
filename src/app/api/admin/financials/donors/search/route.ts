// src/app/api/admin/financials/donors/search/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

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
      logger.warn("[Financials] Donor search without session", { sessionError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Admin only
    const { data: isAdmin, error: rbacError } = await supabase.rpc("is_admin", { p_user_id: userId });
    if (rbacError || !isAdmin) {
      logger.warn("[Financials] Donor search forbidden", { userId, rbacError });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const ilike = `%${q}%`;
    const possibleUuid = /^[0-9a-fA-F-]{16,}$/i.test(q);

    // Step 1: find matching profiles by name or phone
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone_number, address")
      .or(`full_name.ilike.${ilike},phone_number.ilike.${ilike}`)
      .limit(20);

    if (profilesError) {
      logger.error("[Financials] Donor search profiles error", { profilesError });
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    const profileUserIds = (profiles || []).map((p) => p.user_id);

    // Step 2: find donors by donor_number or id or profile user matches
    let donorsQuery = supabase
      .from("donors")
      .select("donor_id, user_id, donor_number")
      .limit(20);

    // apply filters
    donorsQuery = donorsQuery.or(
      [
        `donor_number.ilike.${ilike}`,
        possibleUuid ? `donor_id.eq.${q}` : undefined,
        profileUserIds.length ? `user_id.in.(${profileUserIds.join(",")})` : undefined,
      ]
        .filter(Boolean)
        .join(",")
    );

    const { data: donors, error: donorsError } = await donorsQuery;
    if (donorsError) {
      logger.error("[Financials] Donor search donors error", { donorsError });
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    // Build result set joining profiles data
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    const results = (donors || []).map((d) => {
      const prof = profileMap.get(d.user_id);
      return {
        donor_id: d.donor_id,
        donor_number: d.donor_number,
        full_name: prof?.full_name || null,
        phone_number: prof?.phone_number || null,
        address: prof?.address || null,
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    logger.error("[Financials] Donor search unexpected error", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
