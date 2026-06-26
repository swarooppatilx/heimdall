import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
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
    default: "Heimdall — Fresh Tech Jobs",
    template: "%s | Heimdall",
  },
  description:
    "Fresh, verified tech job opportunities from official company career pages. No stale listings, no ghost jobs.",
  openGraph: {
    title: "Heimdall — Fresh Tech Jobs",
    description: "Fresh, verified tech job opportunities from official company career pages.",
    type: "website",
    siteName: "Heimdall",
  },
  twitter: {
    card: "summary_large_image",
    title: "Heimdall — Fresh Tech Jobs",
    description: "Fresh, verified tech job opportunities from official company career pages.",
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
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Heimdall",
    url: SITE_URL,
    description: "Fresh, verified tech job opportunities from official company career pages.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" className={cn("h-full", "antialiased", "dark", "font-sans", outfit.variable)}>
      <head>
        <JsonLd data={jsonLd} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
