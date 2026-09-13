import type { Metadata } from "next";
import { CreatorUploadWizard } from "@/components/dashboard/creator-upload-wizard";

export const metadata: Metadata = {
  title: "Upload 3D Model — Creator Studio | DripLnk",
  description:
    "Upload, validate, and publish CAD and 3D mesh models into the DripLnk 3D Model Marketplace.",
};

export default function ModelUploadPage() {
  return <CreatorUploadWizard />;
}
