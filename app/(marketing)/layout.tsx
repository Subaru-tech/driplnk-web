import { CookieConsentBanner } from "@/components/marketing/cookie-consent";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <CookieConsentBanner />
    </>
  );
}
