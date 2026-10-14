import type { Metadata } from "next";
import { Suspense } from "react";
import { Bricolage_Grotesque, Geist, Geist_Mono, Permanent_Marker } from "next/font/google";
import { ScarDefs } from "@/components/scars/art";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const marker = Permanent_Marker({
  variable: "--font-permanent-marker",
  subsets: ["latin"],
  weight: "400",
});

const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Grudge",
  description: "Chogs prank other Chogs onchain. Scars stick to the token, and so do the beefs.",
  openGraph: { siteName: "Grudge", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${marker.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ScarDefs />
        <Providers>
          <Suspense fallback={<div className="h-16 border-b-2 border-ink" />}>
            <SiteHeader />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
