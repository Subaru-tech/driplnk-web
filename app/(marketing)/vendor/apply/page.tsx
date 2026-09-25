import type { Metadata } from "next";
import { Sparkles, Printer } from "lucide-react";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { getMyVendorProvider } from "@/driplnk-web-backend/actions/vendor";
import { VendorApplyForm } from "@/components/vendor/apply-form";
import { Section } from "@/components/marketing/section";

export const metadata: Metadata = {
  title: "Apply as a Print Vendor — DripLnk Mart",
  description:
    "Join the DripLnk Mart multi-vendor print farm network. Fulfill precision 3D printing orders for CAD models, electronics enclosures, and hardware prototypes.",
};

export const dynamic = "force-dynamic";

export default async function VendorApplyPage() {
  const user = await getUnifiedUser();
  const { provider, profile } = user ? await getMyVendorProvider() : { provider: null, profile: null };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-line bg-surface/50 py-12 sm:py-16">
        <div className="mx-auto max-w-content px-6 lg:px-12">
          <div className="flex flex-col gap-4 max-w-2xl">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-accent-muted px-3 py-1 font-mono text-xs font-medium text-accent">
              <Printer className="size-3.5" />
              Manufacturing Network
            </span>
            <h1 className="font-display text-3xl font-bold text-fg sm:text-4xl">
              {provider?.status === "pending"
                ? "Vendor Application Status"
                : provider?.status === "approved"
                ? "Vendor Farm Profile"
                : "Become a Manufacturing Partner"}
            </h1>
            <p className="text-base leading-relaxed text-muted">
              {provider?.status === "pending" || provider?.status === "approved"
                ? "Manage your DripLnk Mart manufacturing hub credentials and verified machine capabilities."
                : "Receive qualified manufacturing orders matched to your equipment, materials, and capacity."}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Form */}
      <Section tone="canvas" className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <VendorApplyForm
            existingStatus={provider?.status ?? null}
            adminNotes={provider?.admin_notes ?? null}
            existingProfile={profile}
            isSignedIn={Boolean(user)}
            initialEmail={user?.email ?? undefined}
            initialName={user?.name ?? undefined}
          />
        </div>
      </Section>
    </div>
  );
}
