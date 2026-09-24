export const siteConfig = {
  // Never derived from the request Host header: the edge cache keys by path,
  // so one spoofed Host would cache pages pointing canonical URLs at it.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://heimdall.daenerys.workers.dev",
  github: "https://github.com/swarooppatilx/heimdall",
  author: {
    name: "@swarooppatilx",
    twitter: "https://x.com/swarooppatilx",
  },
  // Mirrors --background in globals.css; meta tags and the manifest can't read
  // CSS variables.
  themeColor: {
    light: "#fbfaf8",
    dark: "#090807",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION_CODE ?? "",
  },
} as const;
