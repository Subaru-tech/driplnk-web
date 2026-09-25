import type { Metadata } from "next";
import { Suspense } from "react";
import { BackendNotice } from "@/components/dashboard/backend-notice";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { LedgerTable } from "@/components/dashboard/ledger-table";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { getLedgerPage, getProfile } from "@/driplnk-web-backend/db/queries";

export const metadata: Metadata = { title: "Credits & Billing" };

const PAGE_SIZE = 20;

async function Ledger({ page }: { page: number }) {
  const { data } = await getLedgerPage(page, PAGE_SIZE);

  return (
    <LedgerTable
      entries={data.entries}
      page={page}
      pageSize={PAGE_SIZE}
      total={data.total}
    />
  );
}

function LedgerSkeleton() {
  return (
    <SkeletonGroup label="Loading transactions" className="flex flex-col gap-2">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </SkeletonGroup>
  );
}

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const params = await searchParams;
  const parsed = Number.parseInt(typeof params.page === "string" ? params.page : "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const profile = await getProfile();

  return (
    <div className="flex flex-col gap-8">
      {profile.backendReady ? null : <BackendNotice />}

      <BalanceCard balance={profile.data?.credits_balance ?? null} />

      <Card className="flex flex-col gap-6 p-0 md:p-0">
        <CardTitle className="px-4 pt-6 md:px-6">Transaction history</CardTitle>
        <div className="pb-6">
          <Suspense key={page} fallback={<LedgerSkeleton />}>
            <Ledger page={page} />
          </Suspense>
        </div>
      </Card>
    </div>
  );
}
