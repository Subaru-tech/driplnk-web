import { ReceiptIndianRupee } from "lucide-react";
import type { Metadata } from "next";
import { BackendNotice } from "@/components/dashboard/backend-notice";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getSales } from "@/driplnk-web-backend/db/queries";

export const metadata: Metadata = { title: "Sales" };

export default async function SalesPage() {
  const { data: sales, backendReady } = await getSales();

  return (
    <div className="flex flex-col gap-6">
      {backendReady ? null : <BackendNotice />}

      <Card>
        {sales.length === 0 ? (
          <EmptyState icon={ReceiptIndianRupee} size="lg" message="No sales yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th scope="col" className="py-2 font-medium">Date</th>
                <th scope="col" className="py-2 text-right font-medium">Gross</th>
                <th scope="col" className="py-2 text-right font-medium">Fee</th>
                <th scope="col" className="py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-line last:border-b-0">
                  <td className="py-3 text-muted">{formatDateTime(sale.created_at)}</td>
                  <td className="py-3 text-right font-mono text-fg">
                    {formatCurrency(sale.gross_inr)}
                  </td>
                  <td className="py-3 text-right font-mono text-muted">
                    −{formatCurrency(sale.platform_fee_inr)}
                  </td>
                  <td className="py-3 text-right font-mono text-fg">
                    {formatCurrency(sale.net_inr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
