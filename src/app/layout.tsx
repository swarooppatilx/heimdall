import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import Script from "next/script";
import { JsonLd } from "@/components/json-ld";
import { Footer } from "@/components/layout/footer";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/lib/site";
import "./globals.css";
import { cn } from "@/lib/utils";

// Geist carries the interface, Geist Mono the timestamps (tabular figures line
// up down the list), Outfit only the wordmark and page headings.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: siteConfig.themeColor.dark },
    { media: "(prefers-color-scheme: light)", color: siteConfig.themeColor.light },
  ],
};

const url = siteConfig.url;

export const metadata: Metadata = {
  metadataBase: new URL(url),
  applicationName: "heimdall",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    title: "heimdall",
    capable: true,
    statusBarStyle: "default",
  },
  verification: { google: siteConfig.verification.google },
  title: {
    default: "heimdall — fresh tech jobs",
    template: "%s — heimdall",
  },
  description:
    "fresh, verified tech job opportunities from official company career pages. no stale listings, no ghost jobs.",
  openGraph: {
    title: "heimdall — fresh tech jobs",
    description: "fresh, verified tech job opportunities from official company career pages.",
    type: "website",
    siteName: "heimdall",
    url: `${url}/`,
    locale: "en_US",
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    site: siteConfig.author.twitter.replace("https://x.com/", "@"),
    creator: siteConfig.author.twitter.replace("https://x.com/", "@"),
    title: "heimdall — fresh tech jobs",
    description: "fresh, verified tech job opportunities from official company career pages.",
    images: ["/twitter-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "heimdall",
    url,
    description: "fresh, verified tech job opportunities from official company career pages.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${url}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased font-sans",
        geist.variable,
        geistMono.variable,
        outfit.variable,
      )}
      suppressHydrationWarning
    >
      <head>
        <JsonLd data={jsonLd} />
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={`{"token": "${process.env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN}", "spa": true}`}
          strategy="afterInteractive"
        />
      </head>
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
        <Footer />
      </body>
    </html>
  );
}
