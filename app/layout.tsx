import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Inter via next/font (DESIGN_SPEC.md §2): the font is fetched and
 * self-hosted at build time rather than requested from Google at runtime,
 * which is what removes the flash of unstyled text and keeps the render
 * server-side. Exposed as a CSS variable so globals.css's --font-sans -
 * the single place the family is chosen - can point at it.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Sourcing Group — Rentabiliteitsrapport",
  description:
    "Onderbouwd rendementsrapport voor Spaans vastgoed. Elke uitkomst herleidbaar, elke aanname zichtbaar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
