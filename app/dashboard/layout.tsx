import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/dashboard/account-menu";
import { CreditChip } from "@/components/dashboard/credit-chip";
import { DashboardShell, SIDEBAR_COOKIE } from "@/components/dashboard/dashboard-shell";
import { getProfile, getSellerProfile, getUnifiedUser, isClerkConfigured } from "@/driplnk-web-backend";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Never prerender or cache anything under /dashboard. Without this, the pages
 * that happen not to read cookies (because Supabase isn't configured yet) get
 * statically prerendered at build time — and would keep being served from that
 * static output once it is.
 */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getUnifiedUser();

  /* Spec §2 — authenticated routes redirect to /login without a session.
     While auth is unconfigured there is no session to check and no data to
     protect, so the shell renders with a "backend not connected" notice
     instead of bouncing every visitor to a login form that cannot work. Once
     the env vars are set, this is a hard guard. */
  const isAuthConfigured = isClerkConfigured || isSupabaseConfigured;
  if (isAuthConfigured && !user) redirect("/login");

  /* No role bounce here, on purpose.
     A seller is also a customer: they buy models, order prints and keep a
     library like anyone else. Sending them to /seller the moment they open a
     creator page would lock them out of their own library. The seller area is
     the restricted one (it needs a storefront); this side is for everybody.
     Role only decides where login LANDS you — see `app/(auth)/actions.ts`. */

  const [{ data: profile }, { data: seller }, cookieStore] = await Promise.all([
    getProfile(),
    getSellerProfile(),
    cookies(),
  ]);

  return (
    <DashboardShell
      defaultCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      creditChip={<CreditChip balance={profile?.credits_balance ?? null} />}
      accountMenu={
        <AccountMenu
          email={user?.email ?? null}
          name={profile?.full_name ?? user?.name ?? null}
          avatarUrl={profile?.avatar_url ?? user?.avatarUrl ?? null}
          isSeller={Boolean(seller)}
          isAdmin={profile?.role === "admin"}
        />
      }
    >
      {children}
    </DashboardShell>
  );
}
