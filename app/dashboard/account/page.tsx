import type { Metadata } from "next";
import { BackendNotice } from "@/components/dashboard/backend-notice";
import { DangerZone } from "@/components/dashboard/danger-zone";
import { PasswordSection } from "@/components/dashboard/password-section";
import { ProfileSection } from "@/components/dashboard/profile-section";
import { SessionsSection } from "@/components/dashboard/sessions-section";
import { getClerkSessions, getProfile, getUnifiedUser } from "@/driplnk-web-backend";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const [user, profileResult] = await Promise.all([getUnifiedUser(), getProfile()]);
  const profile = profileResult.data;

  /* Real sessions only exist for Clerk accounts — Supabase's SDK has no
     "list my sessions" call, so those users see the honest empty state. */
  const sessions = user?.source === "clerk" ? await getClerkSessions() : [];

  const email = user?.email ?? "";
  const name = profile?.full_name ?? user?.name ?? "";
  const avatarUrl = profile?.avatar_url ?? user?.avatarUrl ?? null;
  const authSource = user?.source ?? "supabase";

  return (
    <div className="flex flex-col gap-6">
      {profileResult.backendReady ? null : <BackendNotice />}

      <ProfileSection
        initialName={name}
        initialEmail={email}
        avatarUrl={avatarUrl}
        authSource={authSource}
      />

      <PasswordSection email={email} authSource={authSource} />

      <SessionsSection sessions={sessions} provider={authSource} />

      <DangerZone email={email} />
    </div>
  );
}
