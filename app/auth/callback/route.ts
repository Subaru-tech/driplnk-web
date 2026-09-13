import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase";

/**
 * Only same-origin, absolute paths are safe redirect targets. Anything else —
 * `//evil.com`, `https://evil.com`, protocol-relative URLs, control characters —
 * is an open redirect that hands a phishing page our own origin as the referrer
 * right after the user authenticated.
 */
function safeRedirectPath(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && !/[\r\n]/.test(next)) {
    return next;
  }
  return "/dashboard";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error || errorDescription) {
    const message = encodeURIComponent(errorDescription || error || "Google sign-in was canceled or failed.");
    return NextResponse.redirect(`${origin}/login?error=${message}`);
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Can be safely ignored if middleware/proxy refreshes tokens
          }
        },
      },
    });

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      // Always redirect against OUR origin. `x-forwarded-host` is a header the
      // client controls and must never decide where a logged-in user lands.
      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/login?error=Missing%20auth%20code`);
}
