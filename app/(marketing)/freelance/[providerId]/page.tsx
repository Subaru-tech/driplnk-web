import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getFreelancerProfileById } from "@/driplnk-web-backend/db/queries";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { FreelancerProfileView } from "@/components/freelance/freelancer-profile-view";
import { Section } from "@/components/marketing/section";

type Props = {
  params: Promise<{ providerId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { providerId } = await params;
  const { data: profile } = await getFreelancerProfileById(providerId);

  if (!profile) {
    return {
      title: "Specialist Not Found — DripLnk",
    };
  }

  return {
    title: `${profile.display_name} — 3D & CAD Specialist on DripLnk`,
    description:
      profile.bio?.slice(0, 160) ||
      `Hire ${profile.display_name} for custom 3D models, parametric CAD parts, and enclosures on DripLnk.`,
  };
}

export default async function FreelancerDetailPage(props: Props) {
  const { providerId } = await props.params;
  const [{ data: profile }, user] = await Promise.all([
    getFreelancerProfileById(providerId),
    getUnifiedUser(),
  ]);

  if (!profile) {
    notFound();
  }

  const isSelf = Boolean(user && user.id === profile.user_id);
  const isLoggedIn = Boolean(user);

  return (
    <div className="flex flex-col">
      {/* Back Navigation Bar */}
      <div className="border-b border-line bg-surface/40 py-4">
        <div className="mx-auto max-w-content px-6 lg:px-12">
          <Link
            href="/freelance"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-fg"
          >
            <ChevronLeft className="size-4" />
            <span>Back to All Specialists</span>
          </Link>
        </div>
      </div>

      {/* Main Profile View */}
      <Section tone="canvas" className="py-10 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <FreelancerProfileView
            profile={profile}
            currentUserId={user?.id}
            isSelf={isSelf}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </Section>
    </div>
  );
}
