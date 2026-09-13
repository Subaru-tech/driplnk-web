import type { Metadata } from "next";
import { BackendNotice } from "@/components/dashboard/backend-notice";
import { DangerZone } from "@/components/dashboard/danger-zone";
import { PasswordSection } from "@/components/dashboard/password-section";
import { ProfileSection } from "@/components/dashboard/profile-section";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getProfile, getSellerProfile } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Account" };

export default async function SellerAccountPage() {
  const [user, profile, seller] = await Promise.all([
    getCurrentUser(),
    getProfile(),
    getSellerProfile(),
  ]);

  const email = user?.email ?? "";
  const name =
    profile.data?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <div className="flex flex-col gap-6">
      {profile.backendReady ? null : <BackendNotice />}

      <Card className="flex flex-col gap-2">
        <CardTitle>Storefront</CardTitle>
        <CardDescription>
          {seller.data
            ? `${seller.data.studio_name} — driplnk.in/mart/${seller.data.slug}`
            : "Your storefront details load once the backend is connected."}
        </CardDescription>
      </Card>

      <ProfileSection
        initialName={name}
        initialEmail={email}
        avatarUrl={profile.data?.avatar_url ?? null}
      />

      <PasswordSection email={email} />

      <DangerZone email={email} />
    </div>
  );
}
