"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  FileCheck,
  FileCode,
  Gauge,
  Layers,
  MapPin,
  PackageCheck,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck,
  UserCheck,
  Wrench,
  Zap,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/cn";

type PartnerTrack = "both" | "print" | "freelance";

export function PartnerPortal() {
  const [activeTrack, setActiveTrack] = useState<PartnerTrack>("both");

  // Track 1: Print Vendor State
  const [printForm, setPrintForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    city: "",
    country: "",
    technologies: [] as string[],
    machineCount: "1-3",
    materials: [] as string[],
    buildVolume: "256x256x256 mm",
    monthlyCapacity: "50-200 parts",
    experienceYears: "2+",
    toleranceAgreement: false,
  });
  const [printSubmitted, setPrintSubmitted] = useState(false);
  const [printRefNumber, setPrintRefNumber] = useState("");

  // Track 2: Freelancer State
  const [freelanceForm, setFreelanceForm] = useState({
    fullName: "",
    handle: "",
    title: "",
    category: "mechanical",
    rate: "$45/hr",
    turnaround: "24-48 hours",
    software: ["LeaFF OS", "SolidWorks"] as string[],
    bio: "",
  });
  const [freelanceSubmitted, setFreelanceSubmitted] = useState(false);
  const [publishedHandle, setPublishedHandle] = useState("");

  const handlePrintTechToggle = (tech: string) => {
    setPrintForm((prev) => ({
      ...prev,
      technologies: prev.technologies.includes(tech)
        ? prev.technologies.filter((t) => t !== tech)
        : [...prev.technologies, tech],
    }));
  };

  const handlePrintMaterialToggle = (mat: string) => {
    setPrintForm((prev) => ({
      ...prev,
      materials: prev.materials.includes(mat)
        ? prev.materials.filter((m) => m !== mat)
        : [...prev.materials, mat],
    }));
  };

  const handleFreelanceSoftwareToggle = (soft: string) => {
    setFreelanceForm((prev) => ({
      ...prev,
      software: prev.software.includes(soft)
        ? prev.software.filter((s) => s !== soft)
        : [...prev.software, soft],
    }));
  };

  const handlePrintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const randomRef = `DL-PRT-${Math.floor(1000 + Math.random() * 9000)}`;
    setPrintRefNumber(randomRef);
    setPrintSubmitted(true);
  };

  const handleFreelanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle = freelanceForm.handle.startsWith("@")
      ? freelanceForm.handle
      : `@${freelanceForm.handle || "cad_specialist"}`;
    setPublishedHandle(cleanHandle);
    setFreelanceSubmitted(true);
  };

  return (
    <div className="flex flex-col gap-16">
      {/* Track Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTrack("both")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTrack === "both"
                ? "bg-accent text-accent-contrast shadow"
                : "bg-surface text-muted hover:text-fg hover:bg-raised"
            )}
          >
            All Tracks (Overview)
          </button>
          <button
            type="button"
            onClick={() => setActiveTrack("print")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTrack === "print"
                ? "bg-accent text-accent-contrast shadow"
                : "bg-surface text-muted hover:text-fg hover:bg-raised"
            )}
          >
            <Printer className="size-4" />
            I Want to Print (Vendors)
          </button>
          <button
            type="button"
            onClick={() => setActiveTrack("freelance")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTrack === "freelance"
                ? "bg-accent text-accent-contrast shadow"
                : "bg-surface text-muted hover:text-fg hover:bg-raised"
            )}
          >
            <Sparkles className="size-4" />
            I Want to Freelance (Designers)
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted">
            Two distinct paths with tailored onboarding
          </span>
        </div>
      </div>

      {/* Dual Pathway Split Cards */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Track 1: I want to print */}
        <div
          className={cn(
            "relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-b from-surface to-canvas p-6 transition-all duration-300 sm:p-8",
            activeTrack === "print"
              ? "border-accent-2/60 ring-2 ring-accent-2/40 shadow-xl"
              : "border-line hover:border-border-strong"
          )}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-brass/10 blur-3xl"
          />

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl border border-line bg-void text-accent">
                  <Printer className="size-6" />
                </div>
                <div>
                  <span className="tech-label text-faint">TRACK 01 • MANUFACTURING</span>
                  <h2 className="font-display text-2xl font-semibold text-fg">
                    I Want to Print
                  </h2>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning-muted px-2.5 py-1 font-mono text-xs font-medium text-warning">
                <ShieldAlert className="size-3.5" />
                Manual Review
              </span>
            </div>

            <p className="text-sm leading-relaxed text-muted sm:text-base">
              Apply to become an approved manufacturing vendor in the DripLnk Mart decentralized
              fulfillment network. Receive pre-sliced jobs directly from LeaFF OS and creator
              orders, with guaranteed weekly payouts.
            </p>

            <div className="space-y-3 rounded-xl border border-line bg-void/70 p-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-line/40 pb-2">
                <span className="text-muted">Approval Process:</span>
                <span className="font-semibold text-warning">Manual Engineering Review</span>
              </div>
              <div className="flex items-center justify-between border-b border-line/40 pb-2">
                <span className="text-muted">Turnaround SLA:</span>
                <span className="text-fg">48 business hours</span>
              </div>
              <div className="flex items-center justify-between border-b border-line/40 pb-2">
                <span className="text-muted">Quality Benchmark:</span>
                <span className="text-fg">±0.05 mm calibration test coupon</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Fulfillment Model:</span>
                <span className="text-accent-2">Pre-paid labels + Sliced G-code</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-muted">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-accent-2" />
                <span>Zero customer service overhead: DripLnk manages buyer support & logistics</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-accent-2" />
                <span>Automated weekly payouts directly into your domestic bank account</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-accent-2" />
                <span>Fair pricing matrix based on machine hours, material mass, and energy</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8">
            <button
              type="button"
              onClick={() => {
                setActiveTrack("print");
                const formEl = document.getElementById("print-application-section");
                formEl?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-5 text-sm font-medium text-accent-contrast transition-all hover:bg-accent-hover"
            >
              <Printer className="size-4" />
              Apply as Print Vendor (Manual Review)
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Track 2: I want to freelance */}
        <div
          className={cn(
            "relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-b from-surface to-canvas p-6 transition-all duration-300 sm:p-8",
            activeTrack === "freelance"
              ? "border-accent-2/60 ring-2 ring-accent-2/40 shadow-xl"
              : "border-line hover:border-border-strong"
          )}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-accent-2/10 blur-3xl"
          />

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl border border-line bg-void text-accent-2">
                  <Sparkles className="size-6" />
                </div>
                <div>
                  <span className="tech-label text-faint">TRACK 02 • CAD & DESIGN</span>
                  <h2 className="font-display text-2xl font-semibold text-fg">
                    I Want to Freelance
                  </h2>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-2/40 bg-accent-2-muted px-2.5 py-1 font-mono text-xs font-medium text-accent-2">
                <Zap className="size-3.5" />
                Self-Serve • Auto-Live
              </span>
            </div>

            <p className="text-sm leading-relaxed text-muted sm:text-base">
              Offer your parametric CAD, enclosure design, reverse engineering, and 3D modeling
              services to creators and industrial clients. Create your profile self-serve and go live
              immediately in the public Freelance directory.
            </p>

            <div className="space-y-3 rounded-xl border border-line bg-void/70 p-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-line/40 pb-2">
                <span className="text-muted">Onboarding Mode:</span>
                <span className="font-semibold text-accent-2">Self-Serve Profile Creation</span>
              </div>
              <div className="flex items-center justify-between border-b border-line/40 pb-2">
                <span className="text-muted">Directory Visibility:</span>
                <span className="text-fg">Instant (Auto-Live on Save)</span>
              </div>
              <div className="flex items-center justify-between border-b border-line/40 pb-2">
                <span className="text-muted">Payment Protection:</span>
                <span className="text-fg">Milestone-backed Escrow</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Ecosystem Handoff:</span>
                <span className="text-accent-2">Direct sync to LeaFF OS & Mart</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-muted">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-accent-2" />
                <span>Keep 92% of project milestone earnings with transparent platform fees</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-accent-2" />
                <span>Direct client chat with 3D model viewport & revision tracking</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-accent-2" />
                <span>One-click part dispatch: clients can send your CAD model straight to Mart printers</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-8">
            <button
              type="button"
              onClick={() => {
                setActiveTrack("freelance");
                const formEl = document.getElementById("freelance-onboarding-section");
                formEl?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-5 text-sm font-medium text-accent-contrast transition-all hover:bg-accent-hover"
            >
              <Zap className="size-4" />
              Create Profile (Go Live Instantly)
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* TRACK 1 INTERACTIVE FORM: PRINT VENDOR APPLICATION (MANUAL REVIEW) */}
      {(activeTrack === "both" || activeTrack === "print") && (
        <section id="print-application-section" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-warning-muted px-3 py-1 font-mono text-xs font-medium text-warning">
                Path 1: Print Vendor Application
              </span>
              <span className="font-mono text-xs text-muted">Manual Engineering Review</span>
            </div>
            <h3 className="font-display text-2xl font-semibold text-fg">
              Apply to join the Mart Print Farm Network
            </h3>
            <p className="max-w-2xl text-sm text-muted">
              Every Mart print vendor is individually reviewed to ensure customer parts arrive with
              verified tolerances, clean layer adhesion, and pristine surface finishes.
            </p>
          </div>

          {printSubmitted ? (
            <Card className="flex flex-col items-center gap-6 border-accent-2/40 bg-gradient-to-b from-surface to-canvas p-8 text-center sm:p-12">
              <div className="flex size-16 items-center justify-center rounded-full bg-accent-2-muted text-accent-2">
                <ShieldCheck className="size-8" />
              </div>
              <div className="flex max-w-lg flex-col gap-2">
                <span className="font-mono text-xs font-medium text-accent-2">
                  APPLICATION RECEIVED • REFERENCE {printRefNumber}
                </span>
                <h4 className="font-display text-2xl font-semibold text-fg">
                  Your workshop is in the manual review queue.
                </h4>
                <p className="text-sm leading-relaxed text-muted">
                  Thank you, <strong className="text-fg">{printForm.contactName || "Partner"}</strong>.
                  Our additive manufacturing engineers will inspect your machine profile for{" "}
                  <strong className="text-fg">{printForm.businessName || "your workshop"}</strong> and
                  email the standard calibration coupon files to{" "}
                  <strong className="text-fg">{printForm.email || "your email"}</strong> within 48 business hours.
                </p>
              </div>

              <div className="grid w-full max-w-md gap-3 rounded-xl border border-line bg-void/60 p-4 text-left font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Review SLA:</span>
                  <span className="text-fg">Within 48 Business Hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Next Step:</span>
                  <span className="text-accent-2">Print & measure ±0.05mm test coupon</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Dispatch Region:</span>
                  <span className="text-fg">{printForm.city || "Local Hub"}, {printForm.country || "Domestic"}</span>
                </div>
              </div>

              <div className="flex gap-4">
                <ButtonLink href="/mart" variant="secondary" size="md">
                  Explore Mart Network
                </ButtonLink>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setPrintSubmitted(false)}
                >
                  Edit Application
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="border-line bg-surface/60 p-6 sm:p-8">
              <form onSubmit={handlePrintSubmit} className="flex flex-col gap-8">
                {/* Section A: Workshop Info */}
                <div className="flex flex-col gap-4">
                  <span className="tech-label text-faint">STEP 1 • WORKSHOP & LOCATION</span>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-fg">
                        Workshop / Farm Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Apex Additive Labs"
                        value={printForm.businessName}
                        onChange={(e) =>
                          setPrintForm({ ...printForm, businessName: e.target.value })
                        }
                        className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-fg">
                        Contact Person Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Maya Chen"
                        value={printForm.contactName}
                        onChange={(e) =>
                          setPrintForm({ ...printForm, contactName: e.target.value })
                        }
                        className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-fg">
                        Business Email *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="partner@yourfarm.com"
                        value={printForm.email}
                        onChange={(e) =>
                          setPrintForm({ ...printForm, email: e.target.value })
                        }
                        className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-fg">City *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Bengaluru"
                          value={printForm.city}
                          onChange={(e) =>
                            setPrintForm({ ...printForm, city: e.target.value })
                          }
                          className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-fg">Country *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. India"
                          value={printForm.country}
                          onChange={(e) =>
                            setPrintForm({ ...printForm, country: e.target.value })
                          }
                          className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section B: Equipment & Fleet */}
                <div className="flex flex-col gap-4 border-t border-line/60 pt-6">
                  <span className="tech-label text-faint">STEP 2 • PRINT FLEET & HARDWARE</span>
                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-medium text-fg">
                      Printing Technologies Available (Select all that apply)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "FDM / FFF (Extrusion)",
                        "SLA / MSLA (Resin)",
                        "SLS (Selective Laser Sintering)",
                        "Metal PBF (Powder Bed)",
                      ].map((tech) => (
                        <button
                          key={tech}
                          type="button"
                          onClick={() => handlePrintTechToggle(tech)}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                            printForm.technologies.includes(tech)
                              ? "border-accent bg-accent text-accent-contrast"
                              : "border-line bg-void text-muted hover:text-fg hover:bg-raised"
                          )}
                        >
                          {tech}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-fg">Active Machine Count</label>
                      <select
                        value={printForm.machineCount}
                        onChange={(e) =>
                          setPrintForm({ ...printForm, machineCount: e.target.value })
                        }
                        className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg focus:border-accent focus:outline-none"
                      >
                        <option value="1-3">1 to 3 machines</option>
                        <option value="4-10">4 to 10 machines</option>
                        <option value="11-25">11 to 25 machines</option>
                        <option value="25+">25+ industrial machines</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-fg">Max Build Volume</label>
                      <input
                        type="text"
                        placeholder="e.g. 350x350x350 mm"
                        value={printForm.buildVolume}
                        onChange={(e) =>
                          setPrintForm({ ...printForm, buildVolume: e.target.value })
                        }
                        className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg focus:border-accent focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-fg">Monthly Capacity</label>
                      <select
                        value={printForm.monthlyCapacity}
                        onChange={(e) =>
                          setPrintForm({ ...printForm, monthlyCapacity: e.target.value })
                        }
                        className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg focus:border-accent focus:outline-none"
                      >
                        <option value="20-50 parts">20–50 parts/mo</option>
                        <option value="50-200 parts">50–200 parts/mo</option>
                        <option value="200-1000 parts">200–1,000 parts/mo</option>
                        <option value="1000+ parts">1,000+ parts/mo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section C: Materials Supported */}
                <div className="flex flex-col gap-4 border-t border-line/60 pt-6">
                  <span className="tech-label text-faint">STEP 3 • SUPPORTED MATERIALS</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "PLA / PLA+",
                      "PETG",
                      "ABS / ASA",
                      "TPU 95A / Flexibles",
                      "Nylon (PA12-CF / GF)",
                      "Polycarbonate (PC)",
                      "Tough Engineering Resin",
                      "High-Temp / PEEK",
                    ].map((mat) => (
                      <button
                        key={mat}
                        type="button"
                        onClick={() => handlePrintMaterialToggle(mat)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                          printForm.materials.includes(mat)
                            ? "border-accent-2 bg-accent-2-muted text-accent-2"
                            : "border-line bg-void text-muted hover:text-fg hover:bg-raised"
                        )}
                      >
                        {mat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section D: Tolerance Commitment & Manual Review Agreement */}
                <div className="flex flex-col gap-4 border-t border-line/60 pt-6">
                  <div className="flex items-start gap-3 rounded-xl border border-line bg-void p-4">
                    <input
                      type="checkbox"
                      id="toleranceCheck"
                      required
                      checked={printForm.toleranceAgreement}
                      onChange={(e) =>
                        setPrintForm({ ...printForm, toleranceAgreement: e.target.checked })
                      }
                      className="mt-1 size-4 rounded border-line-control text-accent focus:ring-accent"
                    />
                    <label htmlFor="toleranceCheck" className="text-xs leading-relaxed text-muted">
                      <strong className="text-fg">
                        I agree to the DripLnk Mart Quality Benchmark (±0.05 mm tolerance)
                      </strong>
                      . I understand that my workshop will be placed in a manual review queue, and
                      I will print and measure the standardized test coupon before accepting paid
                      production dispatches.
                    </label>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" size="lg">
                    <ShieldCheck className="size-4" />
                    Submit Application for Manual Review
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </section>
      )}

      {/* TRACK 2 INTERACTIVE FORM: FREELANCER ONBOARDING (SELF-SERVE, AUTO-LIVE) */}
      {(activeTrack === "both" || activeTrack === "freelance") && (
        <section id="freelance-onboarding-section" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent-2-muted px-3 py-1 font-mono text-xs font-medium text-accent-2">
                Path 2: Freelancer Onboarding
              </span>
              <span className="font-mono text-xs text-muted">Self-Serve • Auto-Live</span>
            </div>
            <h3 className="font-display text-2xl font-semibold text-fg">
              Create Your Public Freelancer Profile
            </h3>
            <p className="max-w-2xl text-sm text-muted">
              Fill out your CAD specialties, hourly rates, and software stack. Your profile will be
              published automatically to the live DripLnk Freelance directory without waitlists.
            </p>
          </div>

          {freelanceSubmitted ? (
            <Card className="flex flex-col items-center gap-6 border-accent-2/40 bg-gradient-to-b from-surface to-canvas p-8 text-center sm:p-12">
              <div className="flex size-16 items-center justify-center rounded-full bg-accent-2-muted text-accent-2">
                <Sparkles className="size-8" />
              </div>
              <div className="flex max-w-lg flex-col gap-2">
                <span className="font-mono text-xs font-medium text-accent-2">
                  PROFILE PUBLISHED • AUTO-LIVE ACTIVATED
                </span>
                <h4 className="font-display text-2xl font-semibold text-fg">
                  You are now live in the Freelance Directory!
                </h4>
                <p className="text-sm leading-relaxed text-muted">
                  Welcome aboard, <strong className="text-fg">{freelanceForm.fullName || "Specialist"}</strong> (
                  <strong className="text-fg">{publishedHandle}</strong>). Your profile is now visible to
                  buyers looking for {freelanceForm.category} CAD modeling and mechanical engineering.
                </p>
              </div>

              {/* Profile Card Preview */}
              <div className="w-full max-w-md rounded-xl border border-line bg-void p-5 text-left shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-display font-semibold text-fg">
                      {freelanceForm.fullName || "Jane Doe"}
                    </h5>
                    <p className="font-mono text-xs text-muted">{publishedHandle}</p>
                  </div>
                  <span className="rounded bg-accent-2-muted px-2 py-0.5 font-mono text-[11px] font-medium text-accent-2">
                    Auto-Live
                  </span>
                </div>
                <p className="mt-2 text-xs text-fg">
                  {freelanceForm.title || "Senior Mechanical Engineer"}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {freelanceForm.software.map((s) => (
                    <span
                      key={s}
                      className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] text-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs font-mono">
                  <span className="text-muted">Rate: <strong className="text-fg">{freelanceForm.rate}</strong></span>
                  <span className="text-muted">Turnaround: <strong className="text-fg">{freelanceForm.turnaround}</strong></span>
                </div>
              </div>

              <div className="flex gap-4">
                <ButtonLink href="/freelance" size="md">
                  View in Freelance Directory
                  <ArrowRight className="size-4" />
                </ButtonLink>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setFreelanceSubmitted(false)}
                >
                  Edit Profile Details
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="border-line bg-surface/60 p-6 sm:p-8">
              <form onSubmit={handleFreelanceSubmit} className="flex flex-col gap-8">
                {/* Identity */}
                <div className="flex flex-col gap-4">
                  <span className="tech-label text-faint">STEP 1 • IDENTITY & SPECIALTY</span>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-fg">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Marcus Thorne"
                        value={freelanceForm.fullName}
                        onChange={(e) =>
                          setFreelanceForm({ ...freelanceForm, fullName: e.target.value })
                        }
                        className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg focus:border-accent focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-fg">Public Handle *</label>
                      <input
                        type="text"
                        required
                        placeholder="@marcus_cad"
                        value={freelanceForm.handle}
                        onChange={(e) =>
                          setFreelanceForm({ ...freelanceForm, handle: e.target.value })
                        }
                        className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg focus:border-accent focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-xs font-medium text-fg">Professional Headline *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Lead Roboticist & Parametric Enclosure Designer"
                        value={freelanceForm.title}
                        onChange={(e) =>
                          setFreelanceForm({ ...freelanceForm, title: e.target.value })
                        }
                        className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg focus:border-accent focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-fg">Primary Category</label>
                      <select
                        value={freelanceForm.category}
                        onChange={(e) =>
                          setFreelanceForm({ ...freelanceForm, category: e.target.value })
                        }
                        className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg focus:border-accent focus:outline-none"
                      >
                        <option value="mechanical">Mechanical CAD & Kinematics</option>
                        <option value="enclosures">Enclosures & Electronics Prototyping</option>
                        <option value="organic">Organic Modeling & Sculpting</option>
                        <option value="dfam">Design for Additive (DfAM)</option>
                        <option value="reverse">Reverse Engineering & Scan-to-CAD</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-fg">Starting Rate</label>
                        <input
                          type="text"
                          placeholder="e.g. $45/hr"
                          value={freelanceForm.rate}
                          onChange={(e) =>
                            setFreelanceForm({ ...freelanceForm, rate: e.target.value })
                          }
                          className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-fg">Turnaround</label>
                        <input
                          type="text"
                          placeholder="e.g. 24–48 hours"
                          value={freelanceForm.turnaround}
                          onChange={(e) =>
                            setFreelanceForm({ ...freelanceForm, turnaround: e.target.value })
                          }
                          className="h-10 rounded-[var(--radius-control)] border border-line-control bg-void px-3 text-sm text-fg focus:border-accent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Software Stack */}
                <div className="flex flex-col gap-4 border-t border-line/60 pt-6">
                  <span className="tech-label text-faint">STEP 2 • CAD SOFTWARE PROFICIENCY</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "LeaFF OS",
                      "SolidWorks",
                      "Fusion 360",
                      "Rhino 3D",
                      "Blender",
                      "ZBrush",
                      "Geomagic Design X",
                      "nTop",
                      "FreeCAD",
                      "Siemens NX",
                    ].map((soft) => (
                      <button
                        key={soft}
                        type="button"
                        onClick={() => handleFreelanceSoftwareToggle(soft)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                          freelanceForm.software.includes(soft)
                            ? "border-accent bg-accent text-accent-contrast"
                            : "border-line bg-void text-muted hover:text-fg hover:bg-raised"
                        )}
                      >
                        {soft}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bio */}
                <div className="flex flex-col gap-2 border-t border-line/60 pt-6">
                  <label className="text-xs font-medium text-fg">
                    Brief Bio & Manufacturing Experience
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Tell prospective buyers about your engineering background, favorite materials, and types of assemblies you build..."
                    value={freelanceForm.bio}
                    onChange={(e) =>
                      setFreelanceForm({ ...freelanceForm, bio: e.target.value })
                    }
                    className="rounded-[var(--radius-control)] border border-line-control bg-void p-3 text-sm text-fg focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" size="lg">
                    <Sparkles className="size-4" />
                    Publish Profile (Go Live Instantly)
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </section>
      )}

      {/* COMPARISON TABLE */}
      <section className="flex flex-col gap-6 border-t border-line pt-12">
        <div className="flex flex-col gap-2">
          <span className="tech-label text-faint">AT A GLANCE</span>
          <h3 className="font-display text-2xl font-semibold text-fg">
            Comparing Both Partnership Tracks
          </h3>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-surface font-mono uppercase tracking-wider text-faint">
                <tr>
                  <th className="px-5 py-3 font-semibold">Feature / Requirement</th>
                  <th className="px-5 py-3 font-semibold text-warning">Track 1: I Want to Print</th>
                  <th className="px-5 py-3 font-semibold text-accent-2">Track 2: I Want to Freelance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 font-mono">
                <tr>
                  <td className="px-5 py-3 font-sans font-medium text-fg">Onboarding Gate</td>
                  <td className="px-5 py-3 text-warning">Manual Engineering Review</td>
                  <td className="px-5 py-3 text-accent-2">Self-Serve Profile Creation</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-sans font-medium text-fg">Time to Go Live</td>
                  <td className="px-5 py-3 text-muted">~48 hours (after test coupon sign-off)</td>
                  <td className="px-5 py-3 text-fg">Instant (Immediate directory index)</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-sans font-medium text-fg">Core Deliverable</td>
                  <td className="px-5 py-3 text-muted">Physical manufactured 3D parts</td>
                  <td className="px-5 py-3 text-fg">Parametric CAD files (STEP, STL, 3MF)</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-sans font-medium text-fg">Payout Mechanism</td>
                  <td className="px-5 py-3 text-muted">Direct automated weekly bank settlement</td>
                  <td className="px-5 py-3 text-fg">Milestone-backed escrow releases</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-sans font-medium text-fg">Shipping & Logistics</td>
                  <td className="px-5 py-3 text-muted">Pre-paid tracked labels provided by DripLnk</td>
                  <td className="px-5 py-3 text-fg">Digital delivery via DripLnk Cloud / LeaFF OS</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="tech-label text-faint">FREQUENTLY ASKED QUESTIONS</span>
          <h3 className="font-display text-2xl font-semibold text-fg">
            Partnership Questions
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="flex flex-col gap-2 border-line">
            <h4 className="font-display text-base font-semibold text-fg">
              Can I partner as both a print vendor and a freelance designer?
            </h4>
            <p className="text-xs leading-relaxed text-muted">
              Yes! Many engineering studios design custom mechanical parts for clients and also
              operate in-house print farms. You can create your freelance profile instantly and
              separately submit your print farm for manual verification.
            </p>
          </Card>

          <Card className="flex flex-col gap-2 border-line">
            <h4 className="font-display text-base font-semibold text-fg">
              Why do print vendors require manual review while freelancers are self-serve?
            </h4>
            <p className="text-xs leading-relaxed text-muted">
              Print vendors take automated orders dispatched directly from Mart with money-back
              guarantees on physical tolerances (±0.05mm). Freelancers deliver digital CAD files that
              clients review and approve through milestone escrow before funds release.
            </p>
          </Card>

          <Card className="flex flex-col gap-2 border-line">
            <h4 className="font-display text-base font-semibold text-fg">
              How do print vendors receive slicing settings and jobs?
            </h4>
            <p className="text-xs leading-relaxed text-muted">
              When an order matches your fleet and material stock, you receive pre-configured G-code
              and slicing profiles tuned to your specific machine. You also get an automated,
              pre-paid shipping label.
            </p>
          </Card>

          <Card className="flex flex-col gap-2 border-line">
            <h4 className="font-display text-base font-semibold text-fg">
              What are the platform fees for freelancers?
            </h4>
            <p className="text-xs leading-relaxed text-muted">
              DripLnk takes an 8% platform fee on milestone escrow payouts, which covers payment
              processing, client escrow protection, in-browser 3D model streaming, and cloud storage.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
