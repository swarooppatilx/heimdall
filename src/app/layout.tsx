import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://heimdall.dev"),
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Heimdall",
    url: "https://heimdall.dev",
    description: "Fresh, verified tech job opportunities from official company career pages.",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://heimdall.dev/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" className="h-full antialiased dark">
      <head>
        <JsonLd data={jsonLd} />
      </head>
      <body className="min-h-full flex flex-col bg-black text-zinc-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
