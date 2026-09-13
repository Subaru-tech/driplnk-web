"use client";

import { useState, useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Coins,
  FileCode,
  Gauge,
  Layers,
  Loader2,
  Package,
  Printer,
  Scale,
  ShieldCheck,
  Sparkles,
  Truck,
  Upload,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { calculateMeshQuotes, createMartOrderAction } from "@/driplnk-web-backend/actions/mart";
import type { VendorQuoteItem } from "@/lib/types";

interface MaterialOption {
  id: string;
  name: string;
  type: string;
  tolerance: string;
  density: number; // g/cm3
  tag: string;
}

const MATERIALS: MaterialOption[] = [
  {
    id: "pla",
    name: "PLA+ High Speed",
    type: "FDM / FFF",
    tolerance: "±0.08 mm",
    density: 1.24,
    tag: "Prototyping & Fit Checks",
  },
  {
    id: "petg",
    name: "PETG Technical",
    type: "FDM / FFF",
    tolerance: "±0.08 mm",
    density: 1.27,
    tag: "Waterproof & Chemical Safe",
  },
  {
    id: "abs",
    name: "ABS / ASA Engineered",
    type: "FDM / FFF",
    tolerance: "±0.05 mm",
    density: 1.05,
    tag: "High Temp & Outdoor UV",
  },
  {
    id: "resin",
    name: "Tough Engineering Resin",
    type: "SLA / MSLA",
    tolerance: "±0.025 mm",
    density: 1.18,
    tag: "Ultra-Fine Surface & Teeth",
  },
  {
    id: "nylon-cf",
    name: "Nylon PA12 Carbon Fiber",
    type: "Industrial FDM",
    tolerance: "±0.05 mm",
    density: 1.15,
    tag: "Metal Replacement Rigidity",
  },
];

interface MartQuoteCalculatorProps {
  isSignedIn?: boolean;
}

export function MartQuoteCalculator({ isSignedIn = false }: MartQuoteCalculatorProps) {
  const router = useRouter();
  const fileInputId = useId();

  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("pla");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("cube_sample_20mm.stl");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [quoteRequestId, setQuoteRequestId] = useState<string | null>(null);

  // Mesh computation results
  const [volumeCm3, setVolumeCm3] = useState<number>(8.0);
  const [weightG, setWeightG] = useState<number>(9.92);
  const [vendorQuotes, setVendorQuotes] = useState<VendorQuoteItem[]>([]);
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);

  const [isWeighing, setIsWeighing] = useState<boolean>(false);
  const [orderingProviderId, setOrderingProviderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const selectedMaterial =
    MATERIALS.find((m) => m.id === selectedMaterialId) ?? MATERIALS[0];

  const handleFileUpload = async (file: File, materialId: string = selectedMaterialId) => {
    setUploadedFile(file);
    setFileName(file.name);
    setIsWeighing(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("material", materialId);

    try {
      const res = await calculateMeshQuotes(formData);
      if (!res.success || !res.data) {
        setErrorMessage(res.error || "Failed to analyze CAD file.");
      } else {
        setVolumeCm3(res.data.volumeCm3);
        setWeightG(res.data.weightG);
        setFilePath(res.data.filePath);
        setQuoteRequestId(res.data.quoteRequestId);
        setVendorQuotes(res.data.quotes);
        setHasCalculated(true);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected upload error occurred.");
    } finally {
      setIsWeighing(false);
    }
  };

  const handleMaterialChange = async (matId: string) => {
    setSelectedMaterialId(matId);
    if (uploadedFile) {
      await handleFileUpload(uploadedFile, matId);
    } else {
      // Recompute for default sample part
      const density = MATERIALS.find((m) => m.id === matId)?.density ?? 1.24;
      const newWeight = Math.round(volumeCm3 * density * 100) / 100;
      setWeightG(newWeight);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  const { isSignedIn: clerkSignedIn } = useUser();
  const effectiveSignedIn = isSignedIn || Boolean(clerkSignedIn);

  const handlePlaceOrder = async (quote: VendorQuoteItem) => {
    if (!effectiveSignedIn) {
      router.push(`/login?redirect=${encodeURIComponent("/mart")}`);
      return;
    }

    setOrderingProviderId(quote.provider_id);
    setErrorMessage(null);

    try {
      const res = await createMartOrderAction({
        quoteRequestId,
        filePath: filePath || `mart-quotes/sample-${fileName}`,
        providerId: quote.provider_id,
        material: quote.material,
        price: quote.price,
        weightG,
      });

      if (!res.success || !res.orderId) {
        setErrorMessage(res.error || "Failed to place order.");
      } else {
        router.push("/dashboard/mart-orders");
        return;
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "An error occurred while creating order.");
    } finally {
      setOrderingProviderId(null);
    }
  };

  return (
    <div id="quote-estimator" className="flex flex-col gap-10">
      {/* Heading */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-medium tracking-wider text-accent uppercase">
          AUTOMATIC GEOMETRIC QUOTE ENGINE
        </span>
        <h2 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
          Multi-Vendor Print Price Comparison
        </h2>
        <p className="max-w-2xl text-sm text-muted sm:text-base leading-relaxed">
          Upload any 3D model (.STL) to calculate exact volume, part mass, and guaranteed upfront
          pricing from vetted regional print hubs. No hidden fees, verified tolerances, and tracked fulfillment.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-[var(--radius-control)] border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Upload & Material Selection (7 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          {/* File Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-[var(--radius-card)] border-2 border-dashed p-8 text-center transition-all",
              isDragOver
                ? "border-accent bg-accent-muted/20"
                : "border-line bg-surface/40 hover:border-line-control hover:bg-surface/70"
            )}
          >
            <input
              type="file"
              id={fileInputId}
              accept=".stl"
              onChange={handleFileInput}
              className="sr-only"
            />
            <div className="flex size-14 items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface text-accent">
              <Upload className="size-6" />
            </div>

            <div className="mt-4 flex flex-col gap-1">
              <label
                htmlFor={fileInputId}
                className="cursor-pointer font-display text-base font-semibold text-fg hover:underline"
              >
                Upload your STL 3D model
              </label>
              <p className="text-xs text-muted">
                Drag and drop binary or ASCII STL (Up to 150 MB)
              </p>
            </div>

            {/* Current Loaded File Details */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs">
              <FileCode className="size-3.5 text-accent" />
              <span className="font-medium text-fg">{fileName}</span>
              {uploadedFile && (
                <span className="text-muted">
                  ({(uploadedFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>

            {isWeighing && (
              <div className="mt-4 flex items-center gap-2 rounded-full bg-accent-muted px-4 py-1.5 font-mono text-xs text-accent">
                <Loader2 className="size-4 animate-spin" />
                <span>Parsing mesh geometry & calculating volume...</span>
              </div>
            )}
          </div>

          {/* Material Selection */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                Select Manufacturing Material
              </label>
              <span className="font-mono text-xs text-muted">
                Tolerance: <strong className="text-fg">{selectedMaterial.tolerance}</strong>
              </span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {MATERIALS.map((mat) => {
                const isSelected = selectedMaterialId === mat.id;
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => handleMaterialChange(mat.id)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-[var(--radius-control)] border p-3.5 text-left transition-all min-h-[56px]",
                      isSelected
                        ? "border-accent bg-accent-muted/20 ring-1 ring-accent"
                        : "border-line bg-surface hover:border-line-hover"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-display text-sm font-semibold text-fg">
                        {mat.name}
                      </span>
                      <span className="font-mono text-[10px] text-muted">{mat.type}</span>
                    </div>
                    <span className="text-[11px] text-muted">{mat.tag}</span>
                    <div className="mt-1 flex w-full items-center justify-between font-mono text-[11px] text-faint border-t border-line/40 pt-1.5">
                      <span>Density: {mat.density} g/cm³</span>
                      <span className="text-accent">{mat.tolerance}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Real Sorted Multi-Vendor Quotes (5 cols) */}
        <div className="flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-xl lg:col-span-5 sm:p-8">
          <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
            <div className="flex items-center gap-2">
              <Printer className="size-5 text-accent" />
              <h3 className="font-display text-lg font-semibold text-fg">
                Regional Hub Quotes
              </h3>
            </div>
            <span className="rounded-full bg-accent-muted px-2.5 py-0.5 font-mono text-[11px] text-accent">
              Vetted Farms
            </span>
          </div>

          {/* Part Telemetry Stats */}
          <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-control)] border border-line bg-surface-muted/30 p-3 font-mono text-xs mb-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted uppercase">Mesh Volume</span>
              <span className="font-semibold text-fg">{volumeCm3.toFixed(2)} cm³</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted uppercase">Calculated Weight</span>
              <span className="font-semibold text-fg">{weightG.toFixed(2)} g</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted uppercase">Material</span>
              <span className="font-semibold text-accent uppercase">{selectedMaterial.id}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted uppercase">Dispatch SLA</span>
              <span className="font-semibold text-fg">24–48 hours</span>
            </div>
          </div>

          {/* Sorted Vendor Quotes List */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted mb-1">
              <span>Available Hubs</span>
              <span>Guaranteed Price</span>
            </div>

            {isWeighing ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted">
                <Loader2 className="size-6 animate-spin text-accent" />
                <span className="font-mono text-xs">Querying approved regional print hubs...</span>
              </div>
            ) : vendorQuotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface-muted/20 p-8 text-center">
                <AlertCircle className="size-8 text-amber-400" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-fg">No Hubs Support This Material</p>
                  <p className="text-xs text-muted max-w-xs">
                    No approved print hubs currently support {selectedMaterial.name}. Try selecting
                    PLA or PETG, or apply as a vendor to service this material.
                  </p>
                </div>
              </div>
            ) : (
              vendorQuotes.map((quote, idx) => {
                const isPlacing = orderingProviderId === quote.provider_id;
                return (
                  <div
                    key={quote.provider_id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[var(--radius-control)] border p-4 transition-all",
                      idx === 0
                        ? "border-accent/50 bg-accent-muted/10 ring-1 ring-accent/30"
                        : "border-line bg-surface"
                    )}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-semibold text-fg">
                          {quote.business_name}
                        </span>
                        {idx === 0 && (
                          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-contrast">
                            Best Value
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted">
                        {quote.location || "Regional Hub"} • Fast Dispatch
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-right">
                        <span className="font-mono text-lg font-bold text-fg">
                          ₹{quote.price.toFixed(2)}
                        </span>
                        <span className="block text-[10px] text-muted">All-inclusive</span>
                      </div>

                      <Button
                        size="sm"
                        disabled={isPlacing || isWeighing}
                        onClick={() => handlePlaceOrder(quote)}
                        className="min-h-[44px] min-w-[44px] px-4"
                      >
                        {isPlacing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            Order
                            <ArrowRight className="size-3.5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Guarantees Footer */}
          <div className="mt-8 border-t border-line pt-4 space-y-2 text-[11px] text-muted">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-accent" />
              <span>Reprint Guarantee: If tolerances exceed ±0.08 mm, reprinted free.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Truck className="size-3.5 text-accent" />
              <span>Direct regional delivery. Offline payment coordinated with hub.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
