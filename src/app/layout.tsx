import type { Metadata } from "next";
import { Instrument_Serif, Inter, Space_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

// next/font downloads these at build time and serves them from this app; the browser never calls Google.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono", display: "swap" });
// Accent font. The owner wants Boujee Regular Italic, which is not on Google Fonts: once its licensed file is at
// src/app/fonts/, replace this with next/font/local using the same variable name (DECISIONS.md 2026-10-29).
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RealityCompiler",
  description: "Check a product plan for gaps before any code exists.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark h-full antialiased ${inter.variable} ${spaceMono.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
