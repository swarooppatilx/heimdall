import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
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
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-black text-zinc-100">{children}</body>
    </html>
  );
}
