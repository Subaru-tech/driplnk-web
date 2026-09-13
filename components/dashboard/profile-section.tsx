"use client";

import { Upload } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateUserProfile } from "@/driplnk-web-backend/actions/account";
import { getSupabaseBrowserClient } from "@/lib/supabase";

/* Spec §6.5 — profile card. Save stays disabled until something actually
   changes, and the email field says up front that changing it triggers
   re-verification. */

export function ProfileSection({
  initialName,
  initialEmail,
  avatarUrl,
  authSource = "supabase",
}: {
  initialName: string;
  initialEmail: string;
  avatarUrl: string | null;
  authSource?: "clerk" | "supabase";
}) {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);

  const dirty =
    name !== initialName || (authSource !== "clerk" && email !== initialEmail) || avatarFile !== null;

  function onPickAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    setPending(true);
    try {
      let uploadedAvatarUrl = avatarUrl;
      if (avatarFile) {
        // Read avatar as data URL so it works reliably across all auth providers
        uploadedAvatarUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(avatarFile);
        });
      }

      const res = await updateUserProfile({
        fullName: name,
        avatarUrl: uploadedAvatarUrl,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to update profile.");
      }

      if (authSource !== "clerk" && email !== initialEmail) {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const { error } = await supabase.auth.updateUser({ email });
          if (error) throw error;
          toast("success", `Confirmation sent to ${email}. The change applies once you confirm it.`);
        }
      } else {
        toast("success", "Profile updated.");
      }

      setAvatarFile(null);
      router.refresh();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Couldn't save those changes. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card as="section" className="flex flex-col gap-6">
      <CardTitle>Profile</CardTitle>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="size-16 overflow-hidden rounded-full border border-line bg-raised">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar origin is runtime-configured Supabase storage
              <img src={preview} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" aria-hidden="true" />
              {preview ? "Change avatar" : "Upload avatar"}
            </Button>
            <p className="text-xs text-faint">PNG or JPG, up to 2 MB.</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={onPickAvatar}
            className="sr-only"
            aria-label="Upload avatar"
          />
        </div>

        <Field label="Name">
          {({ id, describedBy }) => (
            <Input
              id={id}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Field
          label="Email"
          hint={
            authSource === "clerk"
              ? "Managed by your Google / identity provider account."
              : "Changing your email sends a confirmation link to the new address. It won't take effect until you click it."
          }
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              type="email"
              value={email}
              disabled={authSource === "clerk"}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <Button type="submit" disabled={!dirty} loading={pending} className="self-start">
          Save changes
        </Button>
      </form>
    </Card>
  );
}
