"use client";

import { useState, useTransition } from "react";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Edit2,
  Lock,
  QrCode,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  saveVendorPayoutDetails,
  type VendorPayoutSummary,
  type SaveVendorPayoutInput,
} from "@/driplnk-web-backend/actions/vendor";

type VendorPayoutCardProps = {
  initialSummary: VendorPayoutSummary;
};

export function VendorPayoutCard({ initialSummary }: VendorPayoutCardProps) {
  const [summary, setSummary] = useState<VendorPayoutSummary>(initialSummary);
  const [isEditing, setIsEditing] = useState<boolean>(!initialSummary.configured);
  const [payoutMethod, setPayoutMethod] = useState<"bank_transfer" | "upi">(
    initialSummary.payoutMethod || "bank_transfer"
  );

  // Form fields
  const [beneficiaryName, setBeneficiaryName] = useState(initialSummary.beneficiaryName || "");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState(initialSummary.ifscCode || "");
  const [upiId, setUpiId] = useState(initialSummary.upiId || "");

  // Status state
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (payoutMethod === "bank_transfer") {
      if (!beneficiaryName.trim()) {
        setFormError("Please enter the account beneficiary name.");
        return;
      }
      if (!accountNumber.trim()) {
        setFormError("Please enter your bank account number.");
        return;
      }
      if (accountNumber.trim() !== confirmAccountNumber.trim()) {
        setFormError("Account numbers do not match. Please verify.");
        return;
      }
      const cleanIfsc = ifscCode.trim().toUpperCase();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
        setFormError("Please enter a valid 11-character Indian IFSC code (e.g., HDFC0001234).");
        return;
      }

      const payload: SaveVendorPayoutInput = {
        payoutMethod: "bank_transfer",
        beneficiaryName: beneficiaryName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: cleanIfsc,
      };

      startTransition(async () => {
        const res = await saveVendorPayoutDetails(payload);
        if (!res.success) {
          setFormError(res.error || "Failed to update payout details.");
        } else {
          setSummary({
            configured: true,
            payoutMethod: "bank_transfer",
            beneficiaryName: payload.beneficiaryName,
            maskedAccount: `•••• •••• •••• ${payload.accountNumber.slice(-4)}`,
            ifscCode: payload.ifscCode,
          });
          setIsEditing(false);
          setAccountNumber("");
          setConfirmAccountNumber("");
          setSuccessMessage("Bank payout details successfully registered.");
        }
      });
    } else {
      const cleanUpi = upiId.trim().toLowerCase();
      if (!cleanUpi || !cleanUpi.includes("@")) {
        setFormError("Please enter a valid UPI ID (e.g. printstudio@okaxis).");
        return;
      }

      const payload: SaveVendorPayoutInput = {
        payoutMethod: "upi",
        upiId: cleanUpi,
      };

      startTransition(async () => {
        const res = await saveVendorPayoutDetails(payload);
        if (!res.success) {
          setFormError(res.error || "Failed to update payout details.");
        } else {
          setSummary({
            configured: true,
            payoutMethod: "upi",
            upiId: cleanUpi,
          });
          setIsEditing(false);
          setSuccessMessage("UPI payout ID successfully registered.");
        }
      });
    }
  }

  return (
    <Card className="flex flex-col gap-6 p-6 sm:p-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-accent-muted text-accent">
            <CreditCard className="size-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-fg">Payout & Settlement Account</h3>
              {summary.configured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-amber-400">
                  <AlertCircle className="size-3" />
                  Setup Required
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              Earnings from completed 3D print orders are disbursed directly to this account.
            </p>
          </div>
        </div>

        {summary.configured && !isEditing && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsEditing(true);
              setSuccessMessage(null);
              setFormError(null);
            }}
            className="self-start sm:self-center min-h-[38px] text-xs gap-1.5"
          >
            <Edit2 className="size-3.5" />
            <span>Update Details</span>
          </Button>
        )}
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs font-medium text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Configured Summary View (Collapsed) */}
      {summary.configured && !isEditing ? (
        <div className="grid gap-4 rounded-xl border border-line bg-canvas/60 p-5 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted">Disbursement Method</span>
            <div className="flex items-center gap-2 font-mono text-sm font-semibold text-fg">
              {summary.payoutMethod === "bank_transfer" ? (
                <>
                  <Building2 className="size-4 text-accent" />
                  <span>Direct Bank Transfer (NEFT/IMPS)</span>
                </>
              ) : (
                <>
                  <QrCode className="size-4 text-accent" />
                  <span>Instant UPI</span>
                </>
              )}
            </div>
          </div>

          {summary.payoutMethod === "bank_transfer" ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted">Account Number</span>
                <span className="font-mono text-sm font-semibold text-fg">{summary.maskedAccount}</span>
                <span className="text-xs text-faint">IFSC: {summary.ifscCode}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted">Beneficiary</span>
                <span className="text-sm font-medium text-fg">{summary.beneficiaryName}</span>
                <span className="text-xs text-faint">Name verified</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted">UPI Virtual ID</span>
              <span className="font-mono text-sm font-semibold text-fg">{summary.upiId}</span>
              <span className="text-xs text-faint">Instant settlement on customer delivery confirmation</span>
            </div>
          )}
        </div>
      ) : (
        /* Form View */
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
              Choose Payout Rail
            </span>
            <div className="grid grid-cols-2 gap-3 max-w-md pt-1">
              <button
                type="button"
                onClick={() => setPayoutMethod("bank_transfer")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-xs font-semibold transition-all ${
                  payoutMethod === "bank_transfer"
                    ? "border-accent bg-accent/10 text-fg shadow-sm"
                    : "border-line bg-canvas text-muted hover:border-line-strong hover:text-fg"
                }`}
              >
                <Building2 className="size-4 text-accent" />
                <span>Bank Account</span>
              </button>
              <button
                type="button"
                onClick={() => setPayoutMethod("upi")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-xs font-semibold transition-all ${
                  payoutMethod === "upi"
                    ? "border-accent bg-accent/10 text-fg shadow-sm"
                    : "border-line bg-canvas text-muted hover:border-line-strong hover:text-fg"
                }`}
              >
                <QrCode className="size-4 text-accent" />
                <span>UPI ID</span>
              </button>
            </div>
          </div>

          {payoutMethod === "bank_transfer" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="beneficiary_name" className="text-xs font-medium text-muted">
                  Beneficiary Name (as in bank passbook) *
                </label>
                <input
                  id="beneficiary_name"
                  type="text"
                  required
                  value={beneficiaryName}
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  placeholder="e.g. Zenith Prototyping LLP or Atharva Ramani"
                  className="h-10 rounded-lg border border-line bg-canvas px-3 text-sm text-fg placeholder:text-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="account_number" className="text-xs font-medium text-muted">
                  Account Number *
                </label>
                <input
                  id="account_number"
                  type="password"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter bank account number"
                  className="h-10 rounded-lg border border-line bg-canvas px-3 font-mono text-sm text-fg placeholder:text-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm_account_number" className="text-xs font-medium text-muted">
                  Confirm Account Number *
                </label>
                <input
                  id="confirm_account_number"
                  type="text"
                  required
                  value={confirmAccountNumber}
                  onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="Re-enter bank account number"
                  className="h-10 rounded-lg border border-line bg-canvas px-3 font-mono text-sm text-fg placeholder:text-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="ifsc_code" className="text-xs font-medium text-muted">
                  Bank IFSC Code *
                </label>
                <input
                  id="ifsc_code"
                  type="text"
                  required
                  maxLength={11}
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFC0001234"
                  className="h-10 max-w-xs rounded-lg border border-line bg-canvas px-3 font-mono text-sm text-fg uppercase placeholder:text-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <span className="text-[0.6875rem] text-faint">11 alphanumeric characters found on cheque or passbook</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-w-md">
              <label htmlFor="upi_id" className="text-xs font-medium text-muted">
                Virtual Payment Address (UPI ID) *
              </label>
              <input
                id="upi_id"
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value.trim().toLowerCase())}
                placeholder="e.g. business@okhdfcbank or 9876543210@paytm"
                className="h-10 rounded-lg border border-line bg-canvas px-3 font-mono text-sm text-fg placeholder:text-faint focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-[0.6875rem] text-faint">Instant payout rail powered by NPCI UPI gateway</span>
            </div>
          )}

          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-400">
              <AlertCircle className="size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isPending} className="min-h-[42px] px-6 text-xs font-semibold gap-2">
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving details...</span>
                </>
              ) : (
                <>
                  <Lock className="size-3.5" />
                  <span>Save Payout Account</span>
                </>
              )}
            </Button>
            {summary.configured && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setFormError(null);
                }}
                className="min-h-[42px] text-xs text-muted hover:text-fg"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}

      {/* Security Footnote */}
      <div className="flex items-center gap-2 border-t border-line/50 pt-3 text-[0.6875rem] text-faint">
        <ShieldCheck className="size-3.5 shrink-0 text-accent" />
        <span>
          Bank & UPI details are stored in an isolated secure partition (<code>vendor_payout_details</code>) protected by owner-only Row-Level Security. Admins reviewing applications cannot view account numbers.
        </span>
      </div>
    </Card>
  );
}
