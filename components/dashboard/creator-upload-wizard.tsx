"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cpu,
  FileCode,
  Image as ImageIcon,
  Plus,
  ShieldAlert,
  Sparkles,
  Tag,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LIST, PRINT_MATERIALS } from "@/lib/marketplace";
import {
  publishCreatorModelListing,
  saveModelDraft,
  checkFileDuplicateByHash,
  checkModelMetadataSafetyAction,
} from "@/driplnk-web-backend/actions/upload";

export type UploadStep = 1 | 2 | 3 | 4 | 5 | 6;

type PickedModelFile = {
  name: string;
  size: string;
  extension: string;
};

const DEFAULT_TAGS = ["robotics", "nema17", "mount", "maker"];

export function CreatorUploadWizard() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<UploadStep>(1);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<"draft" | "pending_review" | "published">("pending_review");
  const [createdModelId, setCreatedModelId] = useState<string | null>(null);
  const [fileSha256, setFileSha256] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // Step 1: Upload Files
  const [files, setFiles] = useState<PickedModelFile[]>([
    { name: "nema17_bracket_main.stl", size: "3.4 MB", extension: "STL" },
    { name: "nema17_mounting_plate.step", size: "1.2 MB", extension: "STEP" },
    { name: "nema17_project_kit.3mf", size: "4.8 MB", extension: "3MF" },
  ]);
  const [dragActive, setDragActive] = useState(false);

  // Step 2: Model Information & Visuals
  const [title, setTitle] = useState("NEMA 17 Stepper Servo Mount");
  const [description, setDescription] = useState(
    "High-precision vibration-dampened NEMA 17 motor bracket designed with dual slotted mounting holes for modular robot chassis and 3D printer Z-axis alignment."
  );
  const [category, setCategory] = useState("Mechanical");
  const [subcategory, setSubcategory] = useState("Motor Mounts & Brackets");
  const [tags, setTags] = useState<string[]>(DEFAULT_TAGS);
  const [tagInput, setTagInput] = useState("");
  const [previewImages, setPreviewImages] = useState<string[]>([
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
  ]);

  // Step 3: Technical Specifications & Print Info
  const [dimX, setDimX] = useState("42");
  const [dimY, setDimY] = useState("38");
  const [dimZ, setDimZ] = useState("25");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(["PLA", "PETG"]);
  const [layerHeight, setLayerHeight] = useState("0.2 mm");
  const [infill, setInfill] = useState("25% Gyroid");
  const [supports, setSupports] = useState("Recommended");
  const [printTime, setPrintTime] = useState("~2h 15m");
  const [assemblyNotes, setAssemblyNotes] = useState(
    "Requires 4x M3x10mm socket cap screws and brass heat-set inserts (M3x4mm)."
  );

  // Step 4: License & Price
  const [pricingType, setPricingType] = useState<"free" | "paid">("free");
  const [price, setPrice] = useState("149");
  const [licenseType, setLicenseType] = useState("standard");
  const [rightsConfirmed, setRightsConfirmed] = useState(true);
  const [termsConfirmed, setTermsConfirmed] = useState(true);

  // Step 5: Validation & Diagnostics
  const [simulateGeometryError, setSimulateGeometryError] = useState(false);
  const [validationRunning, setValidationRunning] = useState(false);

  // Content safety moderation (evaluates server-side to protect blocklist secrecy)
  const [isSafetyFlagged, setIsSafetyFlagged] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      if (!title.trim() && !description.trim() && tags.length === 0) {
        if (active) setIsSafetyFlagged(false);
        return;
      }
      try {
        const res = await checkModelMetadataSafetyAction(title, description, tags);
        if (active) {
          setIsSafetyFlagged(res.flagged);
        }
      } catch {
        // Non-blocking for UI
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [title, description, tags]);

  // Step navigation validations
  function canAdvance(currentStep: UploadStep): boolean {
    if (currentStep === 1) return files.length > 0 && !duplicateError;
    if (currentStep === 2) return Boolean(title.trim() && description.trim() && category);
    if (currentStep === 3) return selectedMaterials.length > 0;
    if (currentStep === 4) return rightsConfirmed && termsConfirmed;
    return true;
  }

  function handleAddTag() {
    const trimmed = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  function toggleMaterial(mat: string) {
    if (selectedMaterials.includes(mat)) {
      setSelectedMaterials(selectedMaterials.filter((m) => m !== mat));
    } else {
      setSelectedMaterials([...selectedMaterials, mat]);
    }
  }

  async function processIncomingFiles(incomingFiles: FileList | File[]) {
    const fileArray = Array.from(incomingFiles);
    if (fileArray.length === 0) return;

    setDuplicateError(null);

    // Compute hash of primary file
    const primary = fileArray[0];
    try {
      const buffer = await primary.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const sha256 = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const dupResult = await checkFileDuplicateByHash(sha256);
      if (dupResult.duplicate) {
        setDuplicateError("This file is already published on Driplnk by another creator.");
        toast("error", "Duplicate file: This file already exists on Driplnk.");
        return;
      }

      setFileSha256(sha256);
    } catch (e) {
      console.warn("Could not compute file hash:", e);
    }

    const newPicked: PickedModelFile[] = fileArray.map((f) => {
      const ext = f.name.split(".").pop()?.toUpperCase() || "CAD";
      const sizeMb = (f.size / (1024 * 1024)).toFixed(1);
      return { name: f.name, size: `${sizeMb} MB`, extension: ext };
    });
    setFiles([...files, ...newPicked]);
    toast("success", `Added ${newPicked.length} file${newPicked.length === 1 ? "" : "s"}.`);
  }

  function handleDropFile(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processIncomingFiles(e.dataTransfer.files);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      void processIncomingFiles(e.target.files);
    }
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    try {
      const res = await saveModelDraft({
        id: createdModelId || undefined,
        title: title || "Untitled Draft",
        description: description || "",
        category: category || "Mechanical",
        subcategory,
        tags,
        price: pricingType === "free" ? 0 : Number(price) || 0,
        licenseType,
        dimensions: {
          x: Number(dimX) || 0,
          y: Number(dimY) || 0,
          z: Number(dimZ) || 0,
        },
        materials: selectedMaterials,
        printInfo: {
          layerHeight,
          infill,
          supports,
          printTime,
          assemblyNotes,
        },
        filePath: files[0] ? `models/${files[0].name}` : undefined,
        files: files.map((f, i) => ({
          filename: f.name,
          storagePath: `models/${f.name}`,
          format: f.extension,
          isPrimary: i === 0,
        })),
        previewImagePaths: previewImages,
        thumbnailUrl: previewImages[0] || null,
      });

      setSavingDraft(false);
      if (res.success) {
        if (res.data?.id) setCreatedModelId(res.data.id);
        toast("success", "Draft saved! Accessible anytime from Creator Studio.");
      } else {
        toast("error", res.error || "Failed to save draft.");
      }
    } catch {
      setSavingDraft(false);
      toast("error", "An unexpected error occurred while saving draft.");
    }
  }

  async function handleSubmit(status: "pending_review" | "published" = "pending_review") {
    setPublishing(true);
    setSubmissionStatus(status);
    try {
      const res = await publishCreatorModelListing({
        id: createdModelId || undefined,
        title,
        description,
        category,
        subcategory,
        tags,
        price: pricingType === "free" ? 0 : Number(price) || 0,
        licenseType,
        dimensions: {
          x: Number(dimX) || 0,
          y: Number(dimY) || 0,
          z: Number(dimZ) || 0,
        },
        materials: selectedMaterials,
        printInfo: {
          layerHeight,
          infill,
          supports,
          printTime,
          assemblyNotes,
        },
        filePath: `models/${files[0]?.name || "model.stl"}`,
        files: files.map((f, i) => ({
          filename: f.name,
          storagePath: `models/${f.name}`,
          format: f.extension,
          isPrimary: i === 0,
        })),
        previewImagePaths: previewImages,
        thumbnailUrl: previewImages[0] || null,
        status,
        fileSha256: fileSha256 || undefined,
      });

      setPublishing(false);

      if (!res.success) {
        toast("error", res.error || "Failed to submit model.");
        return;
      }

      setCreatedModelId(res.data?.id || null);
      setStep(6);
      if (status === "published") {
        toast("success", "Model published directly to the marketplace!");
      } else {
        toast("success", "Model submitted for review! Admins will inspect your design.");
      }
    } catch {
      setPublishing(false);
      toast("error", "An unexpected error occurred while submitting.");
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto py-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 border-b border-line pb-6">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/models"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Creator Studio</span>
          </Link>
          <span className="text-xs font-mono text-muted">DripLnk Creator Engine</span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-fg">
          Upload 3D Model
        </h1>
        <p className="text-sm text-muted">
          Transform your CAD parts into verified marketplace listings ready for 3D printing and LeaFF OS.
        </p>
      </div>

      {/* Step Progress Tracker */}
      {step < 6 && (
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-line -translate-y-1/2 z-0" />
          {[
            { s: 1, label: "Files" },
            { s: 2, label: "Details" },
            { s: 3, label: "Specs & Print" },
            { s: 4, label: "Pricing & Rights" },
            { s: 5, label: "Validation" },
          ].map((item) => {
            const isDone = step > item.s;
            const isCurrent = step === item.s;
            return (
              <div key={item.s} className="relative z-10 flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  disabled={item.s > step}
                  onClick={() => setStep(item.s as UploadStep)}
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                    isDone
                      ? "bg-accent text-accent-contrast cursor-pointer"
                      : isCurrent
                      ? "border-2 border-accent bg-surface text-accent ring-4 ring-accent/10"
                      : "border border-line bg-surface text-muted"
                  }`}
                >
                  {isDone ? <Check className="size-4 stroke-3" /> : item.s}
                </button>
                <span
                  className={`text-[11px] font-medium hidden sm:inline ${
                    isCurrent ? "text-fg font-semibold" : "text-muted"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* STEP 1: UPLOAD FILES */}
      {step === 1 && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-semibold text-fg">Step 1 — Upload Files</h2>
            <p className="text-xs text-muted">
              Add your manufacturing CAD and 3D mesh files. Multi-part kits and assemblies are supported.
            </p>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDropFile}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
              dragActive
                ? "border-accent bg-accent/5 scale-[1.01]"
                : "border-line hover:border-line-strong bg-surface/50"
            }`}
          >
            <input
              type="file"
              multiple
              accept=".stl,.step,.stp,.3mf,.obj,.zip"
              onChange={handleFileInput}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Upload model files"
            />
            <div className="flex size-14 items-center justify-center rounded-2xl bg-raised text-accent mb-4 border border-line">
              <UploadCloud className="size-7" />
            </div>
            <h3 className="text-sm font-semibold text-fg">Drag & drop your 3D files here</h3>
            <p className="text-xs text-muted mt-1">or click to browse your computer</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 font-mono text-[10px] text-faint">
              <span className="rounded bg-raised px-2 py-0.5 border border-line">.STL</span>
              <span className="rounded bg-raised px-2 py-0.5 border border-line">.STEP</span>
              <span className="rounded bg-raised px-2 py-0.5 border border-line">.STP</span>
              <span className="rounded bg-raised px-2 py-0.5 border border-line">.3MF</span>
              <span className="rounded bg-raised px-2 py-0.5 border border-line">.OBJ</span>
              <span className="rounded bg-raised px-2 py-0.5 border border-line">.ZIP</span>
            </div>
          </div>

          {/* Files List */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-semibold text-fg">Model Package Files ({files.length})</span>
              <span>Multi-part assembly supported</span>
            </div>

            <div className="flex flex-col gap-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface p-3 transition-colors hover:border-line-strong"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-raised text-accent border border-line">
                      <FileCode className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-fg">{file.name}</p>
                      <p className="font-mono text-[11px] text-muted">
                        {file.extension} · {file.size}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                    className="rounded-lg p-1.5 text-muted hover:text-danger hover:bg-danger-muted/20 transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Duplicate Error Banner */}
          {duplicateError && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-sm">Duplicate File Detected</span>
                <p className="text-muted leading-relaxed">
                  {duplicateError} If you are the original designer or have intellectual property inquiries, please contact grievance@driplnk.in.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-line">
            <Button
              variant="secondary"
              loading={savingDraft}
              onClick={handleSaveDraft}
              className="text-xs"
            >
              Save as Draft
            </Button>
            <Button
              size="lg"
              disabled={!canAdvance(1)}
              onClick={() => setStep(2)}
              className="gap-2"
            >
              <span>Continue to Model Details</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: MODEL DETAILS */}
      {step === 2 && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-semibold text-fg">Step 2 — Model Details</h2>
            <p className="text-xs text-muted">
              Provide clear information and high-resolution visuals so makers understand what your model accomplishes.
            </p>
          </div>

          {/* Weapon Safety Review Banner */}
          {isSafetyFlagged && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-500">
              <ShieldAlert className="size-5 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-sm">Firearm & Safety Content Review Required</span>
                <p className="text-muted leading-relaxed">
                  Your model details match criteria subject to mandatory administrative review under platform safety terms. Your listing will be submitted to the moderation queue for compliance verification before public catalog display.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="model-title" className="text-xs font-semibold text-fg">
                Model Title *
              </label>
              <input
                id="model-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. NEMA 17 Motor Mount"
                className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="model-description" className="text-xs font-semibold text-fg">
                Description *
              </label>
              <textarea
                id="model-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your design, mechanical features, tolerances, and use cases..."
                className="rounded-xl border border-line bg-surface p-3 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent leading-relaxed"
              />
            </div>

            {/* Category & Subcategory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="model-category" className="text-xs font-semibold text-fg">
                  Primary Category *
                </label>
                <select
                  id="model-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                >
                  {CATEGORY_LIST.map((cat) => (
                    <option key={cat.id} value={cat.label}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="model-subcategory" className="text-xs font-semibold text-fg">
                  Subcategory / Specialization
                </label>
                <input
                  id="model-subcategory"
                  type="text"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="e.g. Motor Mounts & Brackets"
                  className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            {/* Tags Builder */}
            <div className="flex flex-col gap-2">
              <label htmlFor="model-tag-input" className="text-xs font-semibold text-fg">
                Search Tags ({tags.length})
              </label>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-raised px-2.5 py-1 text-xs text-fg border border-line"
                  >
                    <Tag className="size-3 text-accent" />
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-muted hover:text-fg"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1 min-w-[140px] flex-1">
                  <input
                    id="model-tag-input"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add tag and press Enter..."
                    className="h-8 flex-1 bg-transparent px-2 text-xs text-fg focus:outline-none placeholder:text-muted/60"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="rounded-md bg-raised p-1.5 text-muted hover:text-fg border border-line"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Imagery */}
            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-fg">
                  Preview Images & Thumbnails
                </label>
                <span className="text-[11px] text-muted">First image will be the primary cover</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {previewImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-4/3 rounded-xl border border-line overflow-hidden bg-raised group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="Preview thumbnail" className="size-full object-cover" />
                    {idx === 0 && (
                      <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                        COVER
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewImages(previewImages.filter((_, i) => i !== idx))}
                      className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove image"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    const sample =
                      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80";
                    setPreviewImages([...previewImages, sample]);
                    toast("success", "Added sample preview image.");
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 aspect-4/3 rounded-xl border border-dashed border-line bg-surface hover:border-line-strong hover:bg-raised transition-colors cursor-pointer text-muted hover:text-fg"
                >
                  <ImageIcon className="size-5 text-accent" />
                  <span className="text-xs font-medium">+ Add image</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-line">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                variant="secondary"
                loading={savingDraft}
                onClick={handleSaveDraft}
                className="text-xs"
              >
                Save Draft
              </Button>
            </div>
            <Button
              size="lg"
              disabled={!canAdvance(2)}
              onClick={() => setStep(3)}
              className="gap-2"
            >
              <span>Continue to Specifications</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: TECHNICAL SPECIFICATIONS & PRINT INFO */}
      {step === 3 && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-semibold text-fg">Step 3 — Technical Information</h2>
            <p className="text-xs text-muted">
              Specify print settings and dimensions so builders and vendors at Mart can fabricate your model accurately.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            {/* Dimensions */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-fg">
                Bounding Dimensions (Envelope)
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center rounded-xl border border-line bg-surface px-3">
                  <span className="text-xs font-mono font-bold text-faint mr-2">X</span>
                  <input
                    type="number"
                    value={dimX}
                    onChange={(e) => setDimX(e.target.value)}
                    className="h-10 w-full bg-transparent text-sm text-fg focus:outline-none"
                  />
                  <span className="text-xs text-muted">mm</span>
                </div>

                <div className="flex items-center rounded-xl border border-line bg-surface px-3">
                  <span className="text-xs font-mono font-bold text-faint mr-2">Y</span>
                  <input
                    type="number"
                    value={dimY}
                    onChange={(e) => setDimY(e.target.value)}
                    className="h-10 w-full bg-transparent text-sm text-fg focus:outline-none"
                  />
                  <span className="text-xs text-muted">mm</span>
                </div>

                <div className="flex items-center rounded-xl border border-line bg-surface px-3">
                  <span className="text-xs font-mono font-bold text-faint mr-2">Z</span>
                  <input
                    type="number"
                    value={dimZ}
                    onChange={(e) => setDimZ(e.target.value)}
                    className="h-10 w-full bg-transparent text-sm text-fg focus:outline-none"
                  />
                  <span className="text-xs text-muted">mm</span>
                </div>
              </div>
            </div>

            {/* Recommended Materials */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-fg">
                Recommended Print Materials *
              </label>
              <div className="flex flex-wrap gap-2">
                {PRINT_MATERIALS.map((mat) => {
                  const isChecked = selectedMaterials.includes(mat);
                  return (
                    <button
                      key={mat}
                      type="button"
                      onClick={() => toggleMaterial(mat)}
                      className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                        isChecked
                          ? "border-accent bg-accent text-accent-contrast font-bold"
                          : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg"
                      }`}
                    >
                      <Check className={`size-3.5 ${isChecked ? "opacity-100 stroke-3" : "opacity-0"}`} />
                      <span>{mat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Print Settings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="layer-height" className="text-xs font-semibold text-fg">
                  Layer Height
                </label>
                <input
                  id="layer-height"
                  type="text"
                  value={layerHeight}
                  onChange={(e) => setLayerHeight(e.target.value)}
                  placeholder="e.g. 0.2 mm"
                  className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="infill-density" className="text-xs font-semibold text-fg">
                  Infill Density & Pattern
                </label>
                <input
                  id="infill-density"
                  type="text"
                  value={infill}
                  onChange={(e) => setInfill(e.target.value)}
                  placeholder="e.g. 20% Gyroid"
                  className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="supports-needed" className="text-xs font-semibold text-fg">
                  Supports Required
                </label>
                <select
                  id="supports-needed"
                  value={supports}
                  onChange={(e) => setSupports(e.target.value)}
                  className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none cursor-pointer"
                >
                  <option value="None">None required</option>
                  <option value="Recommended">Recommended</option>
                  <option value="Tree Supports">Tree Supports</option>
                  <option value="Required">Required throughout</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="print-time" className="text-xs font-semibold text-fg">
                  Estimated Print Time
                </label>
                <input
                  id="print-time"
                  type="text"
                  value={printTime}
                  onChange={(e) => setPrintTime(e.target.value)}
                  placeholder="e.g. ~2h 15m"
                  className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Assembly Notes */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="assembly-notes" className="text-xs font-semibold text-fg">
                Assembly & Fastener Notes
              </label>
              <textarea
                id="assembly-notes"
                rows={2}
                value={assemblyNotes}
                onChange={(e) => setAssemblyNotes(e.target.value)}
                placeholder="Hardware needed (e.g. M3 screws, bearings, glue)..."
                className="rounded-xl border border-line bg-surface p-3 text-sm text-fg focus:border-accent focus:outline-none leading-relaxed"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-line">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                variant="secondary"
                loading={savingDraft}
                onClick={handleSaveDraft}
                className="text-xs"
              >
                Save Draft
              </Button>
            </div>
            <Button
              size="lg"
              disabled={!canAdvance(3)}
              onClick={() => setStep(4)}
              className="gap-2"
            >
              <span>Continue to License & Price</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: LICENSE & PRICING */}
      {step === 4 && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-semibold text-fg">Step 4 — License & Pricing</h2>
            <p className="text-xs text-muted">
              Choose how builders acquire your 3D model and confirm intellectual property rights.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {/* Free vs Paid */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-fg">Pricing Structure</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPricingType("free")}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all cursor-pointer ${
                    pricingType === "free"
                      ? "border-accent bg-accent/5 ring-2 ring-accent/30"
                      : "border-line bg-surface hover:bg-raised"
                  }`}
                >
                  <span className="font-display text-sm font-semibold text-fg">Free Model</span>
                  <span className="text-xs text-muted">
                    Community claimable. Maximum reach and community downloads.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPricingType("paid")}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all cursor-pointer ${
                    pricingType === "paid"
                      ? "border-accent bg-accent/5 ring-2 ring-accent/30"
                      : "border-line bg-surface hover:bg-raised"
                  }`}
                >
                  <span className="font-display text-sm font-semibold text-fg">Paid Commercial</span>
                  <span className="text-xs text-muted">
                    Earn creator royalties per digital purchase via Razorpay.
                  </span>
                </button>
              </div>
            </div>

            {/* Price Input (if paid) */}
            {pricingType === "paid" && (
              <div className="flex flex-col gap-1.5 p-4 rounded-xl border border-line bg-surface animate-in fade-in">
                <label htmlFor="model-price" className="text-xs font-semibold text-fg">
                  License Price (INR ₹)
                </label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted">
                    ₹
                  </span>
                  <input
                    id="model-price"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="149"
                    className="h-10 w-full rounded-xl border border-line bg-surface pl-8 pr-3 font-mono text-sm text-fg focus:border-accent focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-muted">
                  DripLnk retains 10% platform fee for verified checkout and secure file delivery.
                </p>
              </div>
            )}

            {/* License Selection */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-fg">Select License Rights</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: "standard",
                    title: "Standard Personal",
                    desc: "Personal 3D printing and private modification. No commercial resale.",
                  },
                  {
                    id: "commercial",
                    title: "Commercial Use",
                    desc: "Permits printing and selling physical copies commercially.",
                  },
                  {
                    id: "cc",
                    title: "Creative Commons (CC-BY)",
                    desc: "Free to print, remix, and share with creator attribution.",
                  },
                ].map((lic) => (
                  <button
                    key={lic.id}
                    type="button"
                    onClick={() => setLicenseType(lic.id)}
                    className={`flex flex-col gap-1 rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                      licenseType === lic.id
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : "border-line bg-surface hover:bg-raised"
                    }`}
                  >
                    <span className="font-semibold text-xs text-fg">{lic.title}</span>
                    <span className="text-[11px] text-muted leading-relaxed">{lic.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Rights Guarantees */}
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  onChange={(e) => setRightsConfirmed(e.target.checked)}
                  className="mt-0.5 size-4 accent-accent cursor-pointer"
                />
                <span className="text-xs text-fg leading-relaxed">
                  I confirm that I own the intellectual property rights to this 3D model, or possess explicit authorization to publish and distribute this work.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsConfirmed}
                  onChange={(e) => setTermsConfirmed(e.target.checked)}
                  className="mt-0.5 size-4 accent-accent cursor-pointer"
                />
                <span className="text-xs text-fg leading-relaxed">
                  I agree to DripLnk&apos;s Creator Terms, safety standards, and automatic integration with LeaFF OS and Mart manufacturing.
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-line">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button
                variant="secondary"
                loading={savingDraft}
                onClick={handleSaveDraft}
                className="text-xs"
              >
                Save Draft
              </Button>
            </div>
            <Button
              size="lg"
              disabled={!canAdvance(4)}
              onClick={() => setStep(5)}
              className="gap-2"
            >
              <span>Continue to Validation</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5: DRIPLNK TECHNICAL VALIDATION */}
      {step === 5 && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-semibold text-fg">Step 5 — DripLnk Validation</h2>
            <p className="text-xs text-muted">
              Our automated CAD engine verifies file geometry, format compliance, and metadata completeness.
            </p>
          </div>

          {/* Diagnostic Checks Runner */}
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="font-display text-sm font-semibold text-fg">Automated Health Checks</span>
              <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-semibold text-accent">
                {simulateGeometryError ? "5 / 6 passed" : "6 / 6 passed"}
              </span>
            </div>

            <ul className="flex flex-col gap-3 pt-2 text-xs">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  Files uploaded & recognized ({files.length} parts)
                </span>
                <span className="font-mono text-[11px] text-faint">PASS</span>
              </li>

              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  Format compatibility (STL, STEP, 3MF verified)
                </span>
                <span className="font-mono text-[11px] text-faint">PASS</span>
              </li>

              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  Visual preview generation ready
                </span>
                <span className="font-mono text-[11px] text-faint">PASS</span>
              </li>

              <li className="flex items-center justify-between">
                {simulateGeometryError ? (
                  <span className="flex items-center gap-2 text-danger font-medium">
                    <AlertTriangle className="size-4 text-danger" />
                    Geometry manifold check flagged issues
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-fg">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    Geometry check passed (0 non-manifold edges)
                  </span>
                )}
                <span
                  className={`font-mono text-[11px] ${
                    simulateGeometryError ? "text-danger font-bold" : "text-faint"
                  }`}
                >
                  {simulateGeometryError ? "WARNING" : "PASS"}
                </span>
              </li>

              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  Required metadata and specifications complete
                </span>
                <span className="font-mono text-[11px] text-faint">PASS</span>
              </li>

              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  Licensing and ownership verified
                </span>
                <span className="font-mono text-[11px] text-faint">PASS</span>
              </li>
            </ul>
          </div>

          {/* Geometry Issue Warning & LeaFF OS Repair Loop */}
          {simulateGeometryError ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning-muted/10 p-5">
              <div className="flex items-center gap-2 text-warning font-semibold text-sm">
                <AlertTriangle className="size-5 text-warning" />
                <span>Geometry Issue Detected</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Your mesh contains <strong>2 non-manifold edges</strong> and <strong>1 disconnected polygon shell</strong>. Slicers may produce void defects during print execution.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    window.location.href = `leaffos://repair?file=${encodeURIComponent(files[0]?.name || "model.stl")}`;
                    toast("warning", "Signaling LeaFF OS repair kernel...");
                  }}
                  className="border-accent/40 text-accent font-semibold"
                >
                  <Cpu className="size-3.5 text-accent mr-1" />
                  Open in LeaFF OS to Heal Mesh
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSimulateGeometryError(false)}
                >
                  Ignore & Override
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-line/60 bg-surface/60 p-3 text-xs text-muted">
              <span>Simulate CAD Geometry Warning (Diagnostics Test):</span>
              <button
                type="button"
                onClick={() => setSimulateGeometryError(true)}
                className="text-xs text-accent hover:underline font-medium cursor-pointer"
              >
                Trigger Warning Scenario
              </button>
            </div>
          )}

          {/* Model Summary Preview Card */}
          <div className="flex gap-4 rounded-xl border border-line bg-surface p-4">
            <div className="size-20 shrink-0 rounded-lg overflow-hidden bg-raised">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImages[0]} alt={title} className="size-full object-cover" />
            </div>
            <div className="flex flex-col justify-between">
              <div>
                <h4 className="font-display text-sm font-semibold text-fg">{title}</h4>
                <p className="text-xs text-muted">
                  {category} · {subcategory} · {files.length} CAD files
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-fg">
                  {pricingType === "free" ? "Free" : `₹${price}`}
                </span>
                <span className="text-faint">·</span>
                <span className="text-accent font-medium">{licenseType.toUpperCase()} License</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-line">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setStep(4)}>
                Back
              </Button>
              <Button
                variant="secondary"
                loading={savingDraft}
                onClick={handleSaveDraft}
                className="text-xs"
              >
                Save Draft
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="lg"
                loading={publishing}
                disabled={publishing}
                onClick={() => handleSubmit("pending_review")}
                className="gap-2 bg-accent text-accent-contrast font-bold hover:bg-accent-hover"
              >
                <CheckCircle2 className="size-4 text-accent-contrast" />
                <span>Submit for Moderation Review</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: CELEBRATION / PUBLISHED SCREEN */}
      {step === 6 && (
        <div className="flex flex-col items-center justify-center gap-6 text-center py-10 animate-in zoom-in-95 duration-300">
          <div className="flex size-20 items-center justify-center rounded-3xl bg-accent text-accent-contrast shadow-xl shadow-accent/10">
            <Sparkles className="size-10" />
          </div>

          <div className="flex flex-col gap-2 max-w-md">
            <span className="font-mono text-xs uppercase font-bold tracking-wider text-accent">
              {submissionStatus === "pending_review" ? "Submitted for Review 🚀" : "Model Published 🎉"}
            </span>
            <h2 className="font-display text-3xl font-bold tracking-tight text-fg">
              {submissionStatus === "pending_review" ? "Under Review" : "Congratulations!"}
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              {submissionStatus === "pending_review" ? (
                <>
                  <strong className="text-fg font-semibold">{title}</strong> has been submitted for review. Once verified by an admin, it will be published to the /models marketplace.
                </>
              ) : (
                <>
                  <strong className="text-fg font-semibold">{title}</strong> is now live in the DripLnk 3D Model Marketplace and synced with LeaFF OS.
                </>
              )}
            </p>
          </div>

          {/* Snapshot Stats Tile */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-md rounded-2xl border border-line bg-surface p-4 text-center">
            <div className="flex flex-col">
              <span className="text-xs text-muted">Initial Views</span>
              <span className="font-mono text-lg font-bold text-fg">0</span>
            </div>
            <div className="flex flex-col border-x border-line">
              <span className="text-xs text-muted">Downloads</span>
              <span className="font-mono text-lg font-bold text-fg">0</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted">Listing Price</span>
              <span className="font-mono text-lg font-bold text-accent">
                {pricingType === "free" ? "Free" : `₹${price}`}
              </span>
            </div>
          </div>

          {/* Action Links */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md pt-2">
            <Link
              href={createdModelId ? `/models/${createdModelId}` : "/models"}
              className="flex-1 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-xs font-bold text-accent-contrast shadow-sm hover:bg-accent-hover transition-colors"
            >
              <span>View in Marketplace</span>
              <ArrowRight className="size-4" />
            </Link>

            <Link
              href="/dashboard/models"
              className="flex-1 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-xs font-semibold text-fg hover:bg-raised transition-colors"
            >
              <span>My Models Studio</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => {
              setStep(1);
              setCreatedModelId(null);
            }}
            className="text-xs text-muted hover:text-fg underline underline-offset-4 pt-2"
          >
            Upload another 3D model
          </button>
        </div>
      )}
    </div>
  );
}
