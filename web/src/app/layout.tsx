import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono, Permanent_Marker } from "next/font/google";
import { ScarDefs } from "@/components/scars/art";
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

export const metadata: Metadata = {
  title: "Grudge",
  description: "Chogs prank other Chogs onchain. Scars stick to the token, and so do the beefs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${marker.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ScarDefs />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
