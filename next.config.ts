import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Starts local bindings for `next dev`; OpenNext documents it as fire-and-forget.
void initOpenNextCloudflareForDev();

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"]),
  "https://static.cloudflareinsights.com",
].join(" ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-XSS-Protection", value: "0" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`,
  },
];

const nextConfig: NextConfig = {
  // Internal links are checked against the app's routes at build time.
  typedRoutes: true,
  headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  rewrites() {
    return [
      {
        source: "/.well-known/security.txt",
        destination: "/security.txt",
      },
    ];
  },
};

export default nextConfig;
