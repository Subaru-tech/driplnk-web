"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Plus,
  Trash2,
  Link as LinkIcon,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  Save,
  UploadCloud,
  FileCheck,
  MapPin,
  User,
  Mail,
  Briefcase,
  Layers,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { applyFreelancer, uploadFreelanceFile } from "@/driplnk-web-backend/actions/freelance";
import type { FreelancerProfile, RateType, ProviderStatus } from "@/lib/types";
import { ProfileCompleteness } from "@/components/trust/profile-completeness";
import { cn } from "@/lib/cn";

const DRAFT_STORAGE_KEY = "driplnk_freelance_apply_draft_v1";

const DEFAULT_SKILLS = ["SolidWorks", "Fusion 360", "CAD"];

const SUGGESTED_SKILLS = [
  "SolidWorks",
  "Fusion 360",
  "CAD",
  "FreeCAD",
  "Inventor",
  "Onshape",
  "Rhino / Grasshopper",
  "Blender",
  "ZBrush",
  "DfAM",
  "Snap-fit Geometry",
  "Tolerance ±0.05mm",
  "Planetary Gears",
  "Threaded Inserts",
  "Reverse Engineering",
];

const EXPERIENCE_OPTIONS = [
  "Less than 1 year",
  "1–2 years",
  "3–5 years",
  "5–10 years",
  "10+ years",
];

const SPECIALIZATION_OPTIONS = [
  "Enclosures & IoT",
  "Mechanism & Gear Design",
  "Robotics & Drones",
  "Functional Prototyping",
  "Reverse Engineering",
  "DfAM & 3D Printing",
  "Sheet Metal & CNC",
];

const AVAILABILITY_OPTIONS = [
  "Full-time (30+ hrs / week)",
  "Part-time (15–30 hrs / week)",
  "Project-based (< 15 hrs / week)",
];

const STEPS = [
  { id: 1, number: "01", title: "Personal", desc: "Identity & contact" },
  { id: 2, number: "02", title: "Expertise", desc: "CAD discipline & bio" },
  { id: 3, number: "03", title: "Portfolio", desc: "Projects & CAD links" },
  { id: 4, number: "04", title: "Work", desc: "Rates & availability" },
  { id: 5, number: "05", title: "Verification", desc: "Identity & agreements" },
] as const;

type DraftData = {
  name?: string;
  email?: string;
  location?: string;
  professionalTitle?: string;
  skills?: string[];
  experience?: string;
  bio?: string;
  portfolioUrl?: string;
  linkedinUrl?: string;
  uploadedFiles?: { name: string; path: string }[];
  specializations?: string[];
  hourlyRate?: string;
  availability?: string;
  identityContact?: string;
  savedAt?: string;
};

export function ApplyForm({
  existingProfile,
  existingStatus,
  adminNotes,
  initialName,
  initialEmail,
  isSignedIn = false,
}: {
  existingProfile?: FreelancerProfile | null;
  existingStatus?: ProviderStatus | null;
  adminNotes?: string | null;
  initialName?: string | null;
  initialEmail?: string | null;
  isSignedIn?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 1. PERSONAL
  const [name, setName] = useState(existingProfile?.display_name || initialName || "");
  const [email, setEmail] = useState(initialEmail || "");
  const [location, setLocation] = useState("");

  // 2. PROFESSIONAL
  const [professionalTitle, setProfessionalTitle] = useState(
    existingProfile?.bio?.match(/Title:\s*([^·\n]+)/)?.[1]?.trim() || ""
  );
  const [skills, setSkills] = useState<string[]>(
    existingProfile?.skills?.length ? existingProfile.skills : DEFAULT_SKILLS
  );
  const [newSkill, setNewSkill] = useState("");
  const [experience, setExperience] = useState("1–2 years");

  // 3. ABOUT
  const [bio, setBio] = useState(existingProfile?.bio || "");

  // 4. PORTFOLIO
  const [portfolioUrl, setPortfolioUrl] = useState(
    existingProfile?.portfolio_urls?.[0] || ""
  );
  const [linkedinUrl, setLinkedinUrl] = useState(
    existingProfile?.portfolio_urls?.[1] || ""
  );
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; path: string }[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // 5. WORK
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState<string>(
    existingProfile?.base_rate ? String(existingProfile.base_rate) : ""
  );
  const [rateType] = useState<RateType>("hourly");
  const [availability, setAvailability] = useState("Part-time (15–30 hrs / week)");

  // 6. VERIFICATION
  const [identityContact, setIdentityContact] = useState("");
  const [agreeOriginalWork, setAgreeOriginalWork] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Stepper state: 01 Personal -> 02 Expertise -> 03 Portfolio -> 04 Work -> 05 Verification
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Status banners
  const [savedDraft, setSavedDraft] = useState<DraftData | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Detect draft on initial client mount if no existing profile
  useEffect(() => {
    if (existingProfile) return;
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as DraftData;
        const timer = setTimeout(() => {
          setSavedDraft(parsed);
        }, 0);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore local storage parsing failures
    }
  }, [existingProfile]);

  function restoreDraft(data: DraftData) {
    if (data.name) setName(data.name);
    if (data.email) setEmail(data.email);
    if (data.location) setLocation(data.location);
    if (data.professionalTitle) setProfessionalTitle(data.professionalTitle);
    if (Array.isArray(data.skills) && data.skills.length) setSkills(data.skills);
    if (data.experience) setExperience(data.experience);
    if (data.bio) setBio(data.bio);
    if (data.portfolioUrl) setPortfolioUrl(data.portfolioUrl);
    if (data.linkedinUrl) setLinkedinUrl(data.linkedinUrl);
    if (Array.isArray(data.uploadedFiles)) setUploadedFiles(data.uploadedFiles);
    if (Array.isArray(data.specializations)) setSpecializations(data.specializations);
    if (data.hourlyRate) setHourlyRate(data.hourlyRate);
    if (data.availability) setAvailability(data.availability);
    if (data.identityContact) setIdentityContact(data.identityContact);
    if (data.savedAt) setDraftSavedAt(data.savedAt);
    setSavedDraft(null);
  }

  // Skill management
  function addSkill(skillToAdd: string) {
    const trimmed = skillToAdd.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    setSkills([...skills, trimmed]);
    setNewSkill("");
  }

  function removeSkill(skillToRemove: string) {
    setSkills(skills.filter((s) => s !== skillToRemove));
  }

  function toggleSpecialization(spec: string) {
    if (specializations.includes(spec)) {
      setSpecializations(specializations.filter((s) => s !== spec));
    } else {
      setSpecializations([...specializations, spec]);
    }
  }

  // Handle Portfolio File Upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!isSignedIn) {
      setErrorMessage(
        "Please sign in or save your draft first to upload files to cloud storage, or include your portfolio link above."
      );
      e.target.value = "";
      return;
    }

    setIsUploadingFile(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "deliverable");

      const res = await uploadFreelanceFile(formData);
      if (!res.success || !res.filePath) {
        setErrorMessage(res.error || "File upload failed.");
        return;
      }

      setUploadedFiles((prev) => [...prev, { name: file.name, path: res.filePath! }]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "File upload encountered an error.");
    } finally {
      setIsUploadingFile(false);
      e.target.value = "";
    }
  }

  function removeUploadedFile(index: number) {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  }

  // Save Draft Action
  function handleSaveDraft() {
    try {
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const draftData = {
        name,
        email,
        location,
        professionalTitle,
        skills,
        experience,
        bio,
        portfolioUrl,
        linkedinUrl,
        uploadedFiles,
        specializations,
        hourlyRate,
        availability,
        identityContact,
        savedAt: now,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
      setDraftSavedAt(now);
      setErrorMessage(null);
    } catch {
      setErrorMessage("Could not save draft to local browser storage.");
    }
  }

  // Step Validation & Navigation
  function validateStep(step: number): boolean {
    setErrorMessage(null);
    if (step === 1) {
      if (!name.trim() || name.trim().length < 2) {
        setErrorMessage("Please enter your full name (minimum 2 characters).");
        return false;
      }
      if (!email.trim() || !email.includes("@")) {
        setErrorMessage("Please enter a valid email address.");
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!professionalTitle.trim()) {
        setErrorMessage("Please enter your professional title (e.g. Parametric CAD Designer).");
        return false;
      }
      if (skills.length === 0) {
        setErrorMessage("Please add at least one CAD or engineering skill.");
        return false;
      }
      return true;
    }
    if (step === 3) {
      return true;
    }
    if (step === 4) {
      const rateNum = Number(hourlyRate);
      if (isNaN(rateNum) || rateNum <= 0) {
        setErrorMessage("Please enter a valid positive hourly rate in ₹ INR.");
        return false;
      }
      return true;
    }
    if (step === 5) {
      if (!identityContact.trim()) {
        setErrorMessage("Please provide identity or contact details (e.g. WhatsApp or Discord handle).");
        return false;
      }
      if (!agreeOriginalWork || !agreeTerms) {
        setErrorMessage("Please check both verification agreements to submit your application.");
        return false;
      }
      return true;
    }
    return true;
  }

  function handleContinue() {
    if (validateStep(currentStep)) {
      if (currentStep < 5) {
        setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5);
        window.scrollTo({ top: 120, behavior: "smooth" });
      }
    }
  }

  function handleBack() {
    setErrorMessage(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5);
      window.scrollTo({ top: 120, behavior: "smooth" });
    }
  }

  // Submit Application Action
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (currentStep < 5) {
      handleContinue();
      return;
    }

    if (!validateStep(5)) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = name.trim();
    const rateNum = Number(hourlyRate);

    if (!isSignedIn) {
      handleSaveDraft();
      setErrorMessage(
        "Please sign in or create an account to submit your application. Your draft has been saved locally."
      );
      setTimeout(() => {
        router.push("/login?redirect=/freelance/apply");
      }, 1500);
      return;
    }

    // Build structured bio and portfolio urls
    const bioHeader = [
      professionalTitle.trim() ? `Title: ${professionalTitle.trim()}` : null,
      experience ? `Experience: ${experience}` : null,
      location.trim() ? `Location: ${location.trim()}` : null,
      availability ? `Availability: ${availability}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const bioSpecializations = specializations.length
      ? `Specializations: ${specializations.join(", ")}`
      : "";

    const bioVerification = identityContact.trim()
      ? `Contact/ID: ${identityContact.trim()}`
      : "";

    const fullBio = [
      bioHeader,
      bio.trim(),
      bioSpecializations,
      bioVerification,
    ]
      .filter(Boolean)
      .join("\n\n");

    const cleanPortfolioUrls = [
      portfolioUrl.trim(),
      linkedinUrl.trim(),
      ...uploadedFiles.map((f) => f.path),
    ].filter((u) => u.startsWith("http://") || u.startsWith("https://") || u.includes("/"));

    const combinedSkills = Array.from(new Set([...skills, ...specializations])).slice(0, 20);

    startTransition(async () => {
      const res = await applyFreelancer({
        displayName: cleanName,
        bio: fullBio,
        skills: combinedSkills,
        portfolioUrls: cleanPortfolioUrls,
        rateType,
        baseRate: rateNum,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to submit application. Please try again.");
        return;
      }

      // Clear draft on successful submission
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Ignore
      }

      setSuccessMessage(
        existingProfile
          ? "Specialist profile updated successfully!"
          : "Application submitted! Your profile is registered and ready for engineering contracts."
      );

      setTimeout(() => {
        router.push("/dashboard/freelancer");
        router.refresh();
      }, 1200);
    });
  }

  const completenessItems = [
    { label: "Basic information", completed: Boolean(name.trim() && email.trim() && location.trim()) },
    { label: "Skills", completed: skills.length > 0 },
    { label: "Portfolio", completed: Boolean(portfolioUrl.trim() || linkedinUrl.trim() || uploadedFiles.length > 0) },
    { label: "Rate", completed: Boolean(hourlyRate.trim() && Number(hourlyRate) > 0) },
    { label: "Verification document", completed: Boolean(identityContact.trim() && agreeTerms && agreeOriginalWork), hint: "Reviewed by DripLnk" },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Reviewer Changes Requested Feedback */}
      {existingStatus === "changes_requested" && adminNotes && (
        <div className="rounded-[var(--radius-control)] border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1.5">
            <AlertCircle className="size-4 shrink-0" />
            <span>Action Required: Changes Requested by Reviewer</span>
          </div>
          <p className="text-sm text-fg leading-relaxed whitespace-pre-line pl-6">
            {adminNotes}
          </p>
        </div>
      )}

      {/* 5-Step Progressive Navigation Stepper */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {STEPS.map((s) => {
            const isActive = currentStep === s.id;
            const isDone =
              (s.id === 1 && Boolean(name.trim() && email.trim())) ||
              (s.id === 2 && Boolean(professionalTitle.trim() && skills.length > 0)) ||
              (s.id === 3 && Boolean(portfolioUrl.trim() || linkedinUrl.trim() || uploadedFiles.length > 0)) ||
              (s.id === 4 && Boolean(hourlyRate.trim() && Number(hourlyRate) > 0)) ||
              (s.id === 5 && Boolean(identityContact.trim() && agreeTerms && agreeOriginalWork));

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setCurrentStep(s.id as 1 | 2 | 3 | 4 | 5);
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-[var(--radius-control)] border p-3 text-left transition-all cursor-pointer",
                  isActive
                    ? "border-accent bg-accent/10 shadow-sm ring-1 ring-accent/30"
                    : isDone
                    ? "border-line bg-surface/80 hover:bg-surface hover:border-line-strong text-fg"
                    : "border-line/60 bg-canvas/60 text-muted hover:border-line hover:text-fg"
                )}
              >
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold transition-colors",
                    isActive
                      ? "bg-accent text-accent-contrast"
                      : isDone
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-surface border border-line text-muted"
                  )}
                >
                  {isDone && !isActive ? "✓" : s.number}
                </div>
                <div className="flex flex-col min-w-0">
                  <span
                    className={cn(
                      "truncate text-xs font-semibold",
                      isActive ? "text-accent" : "text-fg"
                    )}
                  >
                    {s.title}
                  </span>
                  <span className="hidden sm:inline truncate text-[10px] text-muted">
                    {s.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-line/80" />

      {/* Profile Completeness Checklist & Score */}
      <ProfileCompleteness
        items={completenessItems}
        verificationStatus={existingStatus}
      />

      {/* Notifications */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-[var(--radius-control)] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
        >
          <AlertCircle className="size-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {savedDraft && !errorMessage && !successMessage && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[var(--radius-control)] border border-accent/40 bg-accent-muted/20 p-4 text-xs text-accent"
        >
          <div className="flex items-center gap-2">
            <Save className="size-4 shrink-0" />
            <span>A saved draft application from {savedDraft.savedAt || "a previous session"} was found.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => restoreDraft(savedDraft)}
              className="rounded bg-accent px-3 py-1.5 font-semibold text-accent-contrast shadow-sm hover:bg-accent/90 transition-colors cursor-pointer"
            >
              Restore Draft
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(DRAFT_STORAGE_KEY);
                setSavedDraft(null);
              }}
              className="px-2 py-1 text-muted hover:text-fg transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {draftSavedAt && !errorMessage && !successMessage && (
        <div
          role="status"
          className="flex items-center justify-between rounded-[var(--radius-control)] border border-line bg-surface/80 px-4 py-3 text-xs text-muted"
        >
          <div className="flex items-center gap-2">
            <Save className="size-4 text-accent" />
            <span>Draft saved locally at {draftSavedAt}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(DRAFT_STORAGE_KEY);
              setDraftSavedAt(null);
            }}
            className="text-xs text-muted underline hover:text-fg cursor-pointer"
          >
            Clear draft
          </button>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-[var(--radius-control)] border border-accent/40 bg-accent-muted/20 p-4 text-sm text-accent"
        >
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 01. PERSONAL                                                              */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <section
          aria-labelledby="section-personal"
          className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 shadow-sm"
        >
          <div className="border-b border-line pb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-accent uppercase tracking-wider">
                  01
                </span>
                <h2 id="section-personal" className="font-display text-lg font-semibold text-fg">
                  PERSONAL INFORMATION
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted">
                Your contact and identity information for hiring partners.
              </p>
            </div>
            <User className="size-5 text-muted/60" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Name */}
            <div className="flex flex-col gap-2">
              <label htmlFor="personal_name" className="text-sm font-medium text-fg">
                Name <span className="text-accent">*</span>
              </label>
              <div className="relative">
                <input
                  id="personal_name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Arjun Verma"
                  className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label htmlFor="personal_email" className="text-sm font-medium text-fg">
                Email <span className="text-accent">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
                <input
                  id="personal_email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="arjun@example.com"
                  className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-10 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            {/* Location */}
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label htmlFor="personal_location" className="text-sm font-medium text-fg">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
                <input
                  id="personal_location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, State / Country (e.g. Bengaluru, India)"
                  className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-10 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 02. EXPERTISE (Combines Professional & About)                              */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <section
          aria-labelledby="section-expertise"
          className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 shadow-sm"
        >
          <div className="border-b border-line pb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-accent uppercase tracking-wider">
                  02
                </span>
                <h2 id="section-expertise" className="font-display text-lg font-semibold text-fg">
                  EXPERTISE & CAD DISCIPLINE
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted">
                Define your engineering title, software proficiency, years of experience, and design philosophy.
              </p>
            </div>
            <Briefcase className="size-5 text-muted/60" />
          </div>

          {/* Professional Title */}
          <div className="flex flex-col gap-2">
            <label htmlFor="prof_title" className="text-sm font-medium text-fg">
              Professional title <span className="text-accent">*</span>
            </label>
            <input
              id="prof_title"
              type="text"
              required
              value={professionalTitle}
              onChange={(e) => setProfessionalTitle(e.target.value)}
              placeholder="Example: Parametric CAD Designer"
              className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <span className="text-xs text-muted">
              Example: Parametric CAD Designer · Robotics Structural Engineer · DfAM Specialist
            </span>
          </div>

          {/* Skills: [ SolidWorks ] [ Fusion 360 ] [ CAD ] [+] */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-fg">
              Skills <span className="text-accent">*</span>
            </label>

            {/* Active Skill Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-line bg-canvas px-3.5 py-1.5 text-sm font-medium text-fg shadow-xs"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="grid size-5 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg transition-colors cursor-pointer"
                    aria-label={`Remove skill ${skill}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("skill_input_field");
                  el?.focus();
                }}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-full border border-dashed border-accent/40 bg-accent-muted/20 px-3 py-1.5 font-mono text-xs font-semibold text-accent hover:border-accent hover:bg-accent-muted/40 transition-colors cursor-pointer"
                title="Add a skill"
                aria-label="Add skill"
              >
                <Plus className="size-3.5" />
                <span>[+]</span>
              </button>
            </div>

            {/* Inline Add Skill Input with [+] button */}
            <div className="flex gap-2">
              <input
                id="skill_input_field"
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill(newSkill);
                  }
                }}
                placeholder="Type skill name (e.g. FreeCAD, Snap-fits, FEA)..."
                className="h-11 flex-1 rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => addSkill(newSkill)}
                className="inline-flex h-11 min-w-[56px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface px-4 text-sm font-medium text-fg hover:bg-raised transition-colors cursor-pointer"
                aria-label="Add skill"
              >
                <Plus className="size-4" />
                <span>[+]</span>
              </button>
            </div>

            {/* Quick Skill Suggestions */}
            <div className="mt-1 flex flex-col gap-1.5">
              <span className="text-xs text-muted font-mono uppercase tracking-wider">
                Quick Suggestions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_SKILLS.filter((s) => !skills.includes(s)).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => addSkill(suggestion)}
                    className="inline-flex min-h-[36px] items-center rounded-full border border-line/60 bg-canvas/60 px-3 py-1.5 text-xs text-muted hover:border-line-strong hover:text-fg transition-colors cursor-pointer"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Experience Dropdown: [ 1–2 years ▾ ] */}
          <div className="flex flex-col gap-2">
            <label htmlFor="prof_experience" className="text-sm font-medium text-fg">
              Experience <span className="text-accent">*</span>
            </label>
            <div className="relative">
              <select
                id="prof_experience"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="h-11 w-full appearance-none rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
              >
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted font-mono text-xs">
                ▾
              </span>
            </div>
          </div>

          {/* Bio / Introduction */}
          <div className="flex flex-col gap-2 border-t border-line pt-5">
            <label htmlFor="about_bio" className="text-sm font-medium text-fg">
              Bio / introduction
            </label>
            <textarea
              id="about_bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Introduce your background: mechanical design, snap-fits, tolerance engineering (±0.05mm), prototyping for FDM/SLA/SLS, or hardware products you've shipped..."
              className="w-full rounded-[var(--radius-control)] border border-line bg-canvas p-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 03. PORTFOLIO                                                             */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <section
          aria-labelledby="section-portfolio"
          className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 shadow-sm"
        >
          <div className="border-b border-line pb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-accent uppercase tracking-wider">
                  03
                </span>
                <h2 id="section-portfolio" className="font-display text-lg font-semibold text-fg">
                  PORTFOLIO & WORK DEMONSTRATION
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted">
                Demonstrate your craftsmanship with past CAD repositories, files, and render links.
              </p>
            </div>
            <LinkIcon className="size-5 text-muted/60" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Portfolio URL */}
            <div className="flex flex-col gap-2">
              <label htmlFor="portfolio_url" className="text-sm font-medium text-fg">
                Portfolio URL
              </label>
              <div className="relative">
                <LinkIcon className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
                <input
                  id="portfolio_url"
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://grabcad.com/... or https://onshape.com/..."
                  className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-10 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            {/* LinkedIn / Website */}
            <div className="flex flex-col gap-2">
              <label htmlFor="linkedin_url" className="text-sm font-medium text-fg">
                LinkedIn / website
              </label>
              <div className="relative">
                <LinkIcon className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
                <input
                  id="linkedin_url"
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/... or personal domain"
                  className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-10 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          {/* Upload Portfolio Images / Files */}
          <div className="flex flex-col gap-3 border-t border-line pt-5">
            <label className="text-sm font-medium text-fg">
              Upload portfolio images/files
            </label>
            <div className="relative flex flex-col items-center justify-center rounded-[var(--radius-control)] border border-dashed border-line bg-canvas p-6 text-center hover:border-line-strong transition-colors">
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={isUploadingFile}
                accept=".png,.jpg,.jpeg,.webp,.pdf,.stl,.step,.stp,.3mf,.zip"
                className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                aria-label="Upload portfolio images or CAD files"
              />
              <div className="flex flex-col items-center gap-2">
                <UploadCloud className="size-8 text-accent" />
                <span className="text-sm font-medium text-fg">
                  {isUploadingFile ? "Uploading file..." : "Click or drag CAD files / renders here"}
                </span>
                <span className="text-xs text-muted">
                  Supports STL, STEP, 3MF, PNG, JPG, PDF (up to 25 MB)
                </span>
              </div>
            </div>

            {/* Attached Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                <span className="text-xs font-mono uppercase text-muted">Attached portfolio items:</span>
                <div className="flex flex-col gap-1.5">
                  {uploadedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 py-2 text-xs text-fg"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileCheck className="size-4 text-accent shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeUploadedFile(idx)}
                        className="text-muted hover:text-red-400 p-1 cursor-pointer"
                        aria-label={`Remove file ${file.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 04. WORK                                                                  */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <section
          aria-labelledby="section-work"
          className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 shadow-sm"
        >
          <div className="border-b border-line pb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-accent uppercase tracking-wider">
                  04
                </span>
                <h2 id="section-work" className="font-display text-lg font-semibold text-fg">
                  WORK & AVAILABILITY
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted">
                Select your design specializations, hourly compensation, and weekly capacity.
              </p>
            </div>
            <Layers className="size-5 text-muted/60" />
          </div>

          {/* Specializations */}
          <div className="flex flex-col gap-2.5">
            <label className="text-sm font-medium text-fg">Specializations</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATION_OPTIONS.map((spec) => {
                const selected = specializations.includes(spec);
                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => toggleSpecialization(spec)}
                    className={cn(
                      "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
                      selected
                        ? "border-accent bg-accent/15 text-accent font-semibold shadow-sm"
                        : "border-line bg-canvas text-muted hover:text-fg hover:border-line-strong"
                    )}
                  >
                    {selected && <CheckCircle2 className="size-3.5" />}
                    <span>{spec}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 border-t border-line pt-5">
            {/* Hourly Rate */}
            <div className="flex flex-col gap-2">
              <label htmlFor="work_hourly_rate" className="text-sm font-medium text-fg">
                Hourly rate <span className="text-accent">*</span>
              </label>
              <div className="relative">
                <span className="absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-sm text-faint">
                  ₹
                </span>
                <input
                  id="work_hourly_rate"
                  type="number"
                  min="0"
                  step="50"
                  required
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="1200"
                  className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-8 text-sm font-mono text-fg focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <span className="text-xs text-muted">INR per hour for custom CAD engineering</span>
            </div>

            {/* Availability */}
            <div className="flex flex-col gap-2">
              <label htmlFor="work_availability" className="text-sm font-medium text-fg">
                Availability <span className="text-accent">*</span>
              </label>
              <div className="relative">
                <select
                  id="work_availability"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="h-11 w-full appearance-none rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                >
                  {AVAILABILITY_OPTIONS.map((avail) => (
                    <option key={avail} value={avail}>
                      {avail}
                    </option>
                  ))}
                </select>
                <Clock className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 05. VERIFICATION                                                          */}
      {/* ========================================================================= */}
      {currentStep === 5 && (
        <section
          aria-labelledby="section-verification"
          className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8 shadow-sm"
        >
          <div className="border-b border-line pb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-accent uppercase tracking-wider">
                  05
                </span>
                <h2 id="section-verification" className="font-display text-lg font-semibold text-fg">
                  VERIFICATION & AGREEMENTS
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted">
                Identity confirmation and required specialist network agreements.
              </p>
            </div>
            <ShieldCheck className="size-5 text-muted/60" />
          </div>

          {/* Identity / Contact Information */}
          <div className="flex flex-col gap-2">
            <label htmlFor="verif_contact" className="text-sm font-medium text-fg">
              Identity / contact information <span className="text-accent">*</span>
            </label>
            <input
              id="verif_contact"
              type="text"
              required
              value={identityContact}
              onChange={(e) => setIdentityContact(e.target.value)}
              placeholder="WhatsApp / Discord handle / Phone number for coordination"
              className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-canvas px-3.5 text-sm text-fg placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <span className="text-xs text-muted">
              Used by DripLnk operations to verify your specialist badge and dispatch rush briefs.
            </span>
          </div>

          {/* Required Agreements */}
          <div className="flex flex-col gap-3.5 border-t border-line pt-5">
            <span className="text-sm font-medium text-fg">Required agreements</span>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreeOriginalWork}
                onChange={(e) => setAgreeOriginalWork(e.target.checked)}
                className="mt-1 size-4 rounded border-line accent-accent cursor-pointer"
              />
              <span className="text-xs text-muted leading-relaxed">
                I confirm that all portfolio CAD files, renderings, and technical models are my original work or that I possess explicit rights to showcase them commercially.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-1 size-4 rounded border-line accent-accent cursor-pointer"
              />
              <span className="text-xs text-muted leading-relaxed">
                I agree to uphold DripLnk&apos;s Specialist Code of Conduct, respect buyer non-disclosure agreements (NDAs), and deliver manufacturing-ready models meeting specified tolerances.
              </span>
            </label>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* STEPPER CONTROLS                                                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-4 border-t border-line">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-5 font-display text-sm font-semibold text-fg hover:bg-raised transition-colors cursor-pointer"
            >
              ← Back
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveDraft}
            className="inline-flex min-h-[48px] flex-1 sm:flex-initial items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-5 font-display text-sm font-semibold text-fg hover:bg-raised transition-colors cursor-pointer"
          >
            <Save className="size-4 text-muted" />
            <span>Save Draft</span>
          </button>
        </div>

        <div className="w-full sm:w-auto">
          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-8 font-display text-sm font-semibold text-accent-contrast shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-8 font-display text-sm font-semibold text-accent-contrast shadow-lg shadow-accent/20 hover:bg-accent/90 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Submitting Application...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>{existingProfile ? "Update Application" : "Submit Application"}</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
