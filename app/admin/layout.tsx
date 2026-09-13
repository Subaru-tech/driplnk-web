import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/dashboard/account-menu";
import { DashboardShell, SIDEBAR_COOKIE } from "@/components/dashboard/dashboard-shell";
import { StatusPill } from "@/components/ui/status-pill";
import { getProfile, getSellerProfile, getUnifiedUser, isClerkConfigured } from "@/driplnk-web-backend";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getUnifiedUser();

  const isAuthConfigured = isClerkConfigured || isSupabaseConfigured;
  if (isAuthConfigured && !user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: seller }, cookieStore] = await Promise.all([
    getProfile(),
    getSellerProfile(),
    cookies(),
  ]);

  // Role gate: redirect non-admin accounts to creator dashboard
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <DashboardShell
      defaultCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      area="admin"
      creditChip={<StatusPill tone="danger">Admin</StatusPill>}
      accountMenu={
        <AccountMenu
          email={user?.email ?? null}
          name={profile?.full_name ?? user?.name ?? null}
          avatarUrl={profile?.avatar_url ?? user?.avatarUrl ?? null}
          isSeller={Boolean(seller)}
          isAdmin={true}
        />
      }
    >
      {children}
    </DashboardShell>
  );
}
