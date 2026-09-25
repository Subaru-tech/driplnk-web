import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getMyFreelanceProvider, getFreelancerProfileById } from "@/driplnk-web-backend/db/queries";
import { ApplyForm } from "@/components/freelance/apply-form";
import { Section } from "@/components/marketing/section";

export const metadata: Metadata = {
  title: "Apply as a 3D & CAD Specialist — DripLnk",
  description:
    "Join DripLnk's vetted specialist network. Get hired for precision functional 3D printing, parametric CAD, and electronics enclosures.",
};

export const dynamic = "force-dynamic";

export default async function FreelanceApplyPage() {
  const user = await getUnifiedUser();

  let existingProfile = null;
  let existingProvider = null;
  if (user) {
    const { data: provider } = await getMyFreelanceProvider();
    if (provider) {
      existingProvider = provider;
      const { data: profile } = await getFreelancerProfileById(provider.id);
      existingProfile = profile;
    }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-line bg-surface/50 py-12 sm:py-16">
        <div className="mx-auto max-w-content px-6 lg:px-12">
          <div className="flex flex-col gap-4 max-w-2xl">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-accent-muted px-3 py-1 font-mono text-xs font-medium text-accent">
              <Sparkles className="size-3.5" />
              Specialist Onboarding
            </span>
            <h1 className="font-display text-3xl font-bold text-fg sm:text-4xl">
              {existingProfile ? "Edit your specialist profile" : "Become a DripLink Specialist"}
            </h1>
            <p className="text-base leading-relaxed text-muted">
              Connect with hardware creators, robotics builders, and product teams. You control your
              rates, review project briefs before accepting, and deliver print-ready CAD files.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Form */}
      <Section tone="canvas" className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <ApplyForm
            existingProfile={existingProfile}
            existingStatus={existingProvider?.status ?? null}
            adminNotes={existingProvider?.admin_notes ?? null}
            initialName={user?.name ?? undefined}
            initialEmail={user?.email ?? undefined}
            isSignedIn={Boolean(user)}
          />
        </div>
      </Section>
    </div>
  );
}
