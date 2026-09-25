/**
 * Automated HTTP Route Crawler and Status Code Verification Suite
 */

interface RouteCheck {
  path: string;
  expectedStatus: number[];
  description: string;
}

const routesToTest: RouteCheck[] = [
  // Public Marketing & Directory Pages (Should return 200)
  { path: "/", expectedStatus: [200], description: "Landing / Hero Page" },
  { path: "/models", expectedStatus: [200], description: "3D Models Marketplace Catalog" },
  { path: "/models/83c8025c-b172-4013-9edb-4f015d95a107", expectedStatus: [200], description: "Model Detail Page (DripLnk MartBot)" },
  { path: "/mart", expectedStatus: [200], description: "3D Printing Mart Quoter" },
  { path: "/freelance", expectedStatus: [200], description: "Freelance Directory" },
  { path: "/freelance/b8686a6c-74d7-432e-9732-995b8cb79256", expectedStatus: [200], description: "Freelancer Profile (Atharva Ramani)" },
  { path: "/vendor/apply", expectedStatus: [200], description: "Vendor Onboarding Portal" },
  { path: "/freelance/apply", expectedStatus: [307], description: "Freelancer Application Portal (Auth Protected)" },
  { path: "/about", expectedStatus: [200], description: "About Page" },
  { path: "/contact", expectedStatus: [200], description: "Contact & Support Page" },
  { path: "/terms", expectedStatus: [200], description: "Terms of Service" },
  { path: "/privacy", expectedStatus: [200], description: "Privacy Policy" },
  { path: "/refund-policy", expectedStatus: [200], description: "Refund & Cancellation Policy" },
  { path: "/cookies", expectedStatus: [200], description: "Cookie Policy" },
  { path: "/partner", expectedStatus: [200], description: "Partner Network Page" },
  { path: "/leaff-os", expectedStatus: [200], description: "Leaff OS Ecosystem Page" },
  { path: "/download", expectedStatus: [200], description: "Desktop App Downloads" },
  { path: "/app", expectedStatus: [308], description: "Mobile App Route (Redirect to /download)" },
  { path: "/robots.txt", expectedStatus: [200], description: "Search Engine Robots Configuration" },
  { path: "/sitemap.xml", expectedStatus: [200], description: "Dynamic XML Sitemap" },

  // Auth Pages
  { path: "/login", expectedStatus: [200], description: "Clerk Login Page" },
  { path: "/signup", expectedStatus: [200], description: "Clerk Signup Page" },

  // Protected Routes (Should redirect or block when unauthenticated)
  { path: "/dashboard", expectedStatus: [307, 308, 401, 403], description: "Protected Buyer Dashboard" },
  { path: "/admin", expectedStatus: [307, 308, 401, 403], description: "Protected Admin Panel" },
  { path: "/seller", expectedStatus: [307, 308, 401, 403], description: "Protected Seller Dashboard" },
];

async function main() {
  console.log("================================================================================");
  console.log("🌐 EXECUTING HTTP ROUTE CRAWLER & STATUS CODE AUDIT");
  console.log("================================================================================\n");

  const baseUrl = "http://localhost:3000";
  let passed = 0;
  let failed = 0;

  for (const route of routesToTest) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${baseUrl}${route.path}`, {
        redirect: "manual", // Do not follow redirects so we can verify 307 on protected paths
      });
      const duration = Date.now() - t0;
      const ok = route.expectedStatus.includes(res.status);
      const icon = ok ? "✅" : "❌";
      console.log(
        `  ${icon} [HTTP ${res.status}] ${route.path.padEnd(52)} (${duration}ms) — ${route.description}`
      );
      if (ok) {
        passed++;
      } else {
        failed++;
        console.error(`     ↳ MISMATCH: Expected [${route.expectedStatus.join(",")}], got ${res.status}`);
      }
    } catch (err) {
      failed++;
      console.error(`  ❌ [FAILED] ${route.path} - ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\n================================================================================");
  console.log(`Route Crawl Summary: ${passed} Passed, ${failed} Failed out of ${routesToTest.length} Routes`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
