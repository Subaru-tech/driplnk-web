import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your DripLnk account.",
};

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return <SignupForm />;
}
