// src/app/api/admin/programs/categories/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
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
    // Require a session (authenticated users). RLS will filter non-admins to active rows only.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      logger.warn("[Programs] Categories list without session", { sessionError });
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data, error } = await supabase.rpc("list_donation_categories");
    if (error) {
      logger.error("[Programs] list_donation_categories RPC error", { error });
      return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }

    return NextResponse.json({ items: Array.isArray(data) ? data : [] });
  } catch (error) {
    logger.error("[Programs] Unexpected error in categories endpoint", { error: error instanceof Error ? error : new Error(String(error)) });
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
