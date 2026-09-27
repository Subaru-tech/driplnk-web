import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Separate dist dir for production build/start (NEXT_DIST_DIR=.next-prod
     npm run build && NEXT_DIST_DIR=.next-prod npx next start -p 3100) so a
     prod build never clobbers the running `next dev` server's .next again. */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  /* Allow LAN and localhost origins in development for assets/HMR/scripts */
  allowedDevOrigins: [
    "192.168.0.203",
    "192.168.*.*",
    "10.*.*.*",
    "localhost",
  ],

  /* Suppress the "X-Powered-By: Next.js" header — no reason to advertise the
     framework to scanners. */
  poweredByHeader: false,

  async redirects() {
    return [
      {
        /* App merged into Download page (surfacing both LeaFF OS desktop and mobile companion). */
        source: "/app",
        destination: "/download",
        permanent: true,
      },
      {
        source: "/partner-with-us",
        destination: "/partner",
        permanent: true,
      },
      {
        source: "/partners",
        destination: "/partner",
        permanent: true,
      },
      {
        source: "/quote",
        destination: "/mart",
        permanent: true,
      },
      {
        source: "/get-a-quote",
        destination: "/mart",
        permanent: true,
      },
      {
        source: "/print-quotes",
        destination: "/mart",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          /* Clickjacking protection — prevent the site from being embedded in
             iframes on other domains. */
          { key: "X-Frame-Options", value: "DENY" },
          /* Stops browsers from MIME-sniffing a response away from the declared
             Content-Type, which can prevent drive-by downloads. */
          { key: "X-Content-Type-Options", value: "nosniff" },
          /* Send the full URL as the Referer only for same-origin requests;
             only the origin for cross-origin. */
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          /* Disable browser features the app never uses. */
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
