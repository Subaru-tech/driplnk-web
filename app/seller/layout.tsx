import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/dashboard/account-menu";
import { DashboardShell, SIDEBAR_COOKIE } from "@/components/dashboard/dashboard-shell";
import { getProfile, getSellerProfile, getUnifiedUser, isClerkConfigured } from "@/driplnk-web-backend";
import { isSupabaseConfigured } from "@/lib/supabase";
import { StartSelling } from "@/components/seller/start-selling";
import { StatusPill } from "@/components/ui/status-pill";

/** Same reasoning as the creator dashboard: never prerender, never cache. */
export const dynamic = "force-dynamic";

/**
 * The seller half of the product. Same shell as /dashboard, different doors.
 *
 * There is no role gate here any more, because there is nothing to gate: an
 * account without a storefront gets offered one. That's the whole onboarding —
 * arriving at /seller IS the intent to sell, so asking at signup was asking
 * three screens too early.
 */
export default async function SellerLayout({ children }: LayoutProps<"/seller">) {
  const user = await getUnifiedUser();

  const isAuthConfigured = isClerkConfigured || isSupabaseConfigured;
  if (isAuthConfigured && !user) redirect("/login");

  const [{ data: profile }, { data: seller, backendReady }, cookieStore] = await Promise.all([
    getProfile(),
    getSellerProfile(),
    cookies(),
  ]);

  return (
    <DashboardShell
      defaultCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      area="seller"
      creditChip={
        seller ? (
          <StatusPill tone={seller.payout_status === "verified" ? "accent" : "warning"}>
            {seller.studio_name}
          </StatusPill>
        ) : null
      }
      accountMenu={
        <AccountMenu
          email={user?.email ?? null}
          name={
            seller?.studio_name ??
            profile?.full_name ??
            user?.name ??
            null
          }
          avatarUrl={profile?.avatar_url ?? user?.avatarUrl ?? null}
          isSeller={Boolean(seller)}
          isAdmin={profile?.role === "admin"}
        />
      }
    >
      {/* No storefront yet: the whole area is the sign-up for one. Rendered
          inside the shell so it doesn't feel like being bounced somewhere.
          `backendReady` matters: a failed query must not offer onboarding to
          someone who already has a storefront. */}
      {seller || !backendReady ? children : <StartSelling />}
    </DashboardShell>
  );
}
