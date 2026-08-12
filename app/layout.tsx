import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Sourcing Group — Rentabiliteitsrapport",
  description:
    "Onderbouwd rendementsrapport voor Spaans vastgoed. Elke uitkomst herleidbaar, elke aanname zichtbaar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
