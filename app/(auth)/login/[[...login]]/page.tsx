import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your DripLnk account.",
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
