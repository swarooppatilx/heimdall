import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import Script from "next/script";
import { JsonLd } from "@/components/json-ld";
import { Providers } from "@/components/providers";
import { SITE_URL } from "@/lib/site";
import "./globals.css";
import { cn } from "@/lib/utils";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "heimdall — fresh tech jobs",
    template: "%s | heimdall",
  },
  description:
    "fresh, verified tech job opportunities from official company career pages. no stale listings, no ghost jobs.",
  openGraph: {
    title: "heimdall — fresh tech jobs",
    description: "fresh, verified tech job opportunities from official company career pages.",
    type: "website",
    siteName: "heimdall",
  },
  twitter: {
    card: "summary_large_image",
    title: "heimdall — fresh tech jobs",
    description: "fresh, verified tech job opportunities from official company career pages.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "heimdall",
    url: SITE_URL,
    description: "fresh, verified tech job opportunities from official company career pages.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "font-sans", outfit.variable)}
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
