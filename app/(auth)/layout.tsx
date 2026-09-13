import Link from "next/link";
import { Wordmark } from "@/components/marketing/wordmark";

/* Spec §4.1 — centred card, vertically centred in the viewport, logo above. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <Link href="/" aria-label="DripLnk home">
        <Wordmark />
      </Link>
      {children}
    </main>
  );
}
