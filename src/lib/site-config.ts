export const siteConfig = {
  github: "https://github.com/swarooppatilx/heimdall",
  author: {
    name: "@swarooppatilx",
    twitter: "https://x.com/swarooppatilx",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION_CODE ?? "",
  },
} as const;
