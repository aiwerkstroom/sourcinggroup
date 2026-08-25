import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth/useAuth";
import { SiteNav } from "./_components/site-nav";
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
      <head>
        {/*
         * Zonder JavaScript flipt niets ooit data-fade naar "in"
         * (globals.css), en dan blijven de gefadede secties van de
         * homepage permanent op opacity 0 staan - een lege pagina, niet
         * een pagina zonder animatie. Deze regel zet ze meteen in hun
         * eindtoestand.
         *
         * In <head> en niet in <body>: de stijl moet gelden vóór de
         * eerste paint, anders is er alsnog een moment waarop de inhoud
         * onzichtbaar is.
         */}
        <noscript>
          <style>{`[data-fade]{opacity:1;transform:none;transition:none}`}</style>
        </noscript>
      </head>
      <body>
        {/*
         * process.env.TSG_AUTH_STORE, read here rather than inside
         * useAuth.tsx: this file is a Server Component, so it reads env
         * fresh per request; useAuth.tsx ships to the browser, where
         * Next.js inlines any non-NEXT_PUBLIC_ process.env access to
         * `undefined` once, at build time (lib/auth/auth-client.ts's
         * resolveAuthBackend() explains why that distinction matters).
         * Unset in every real deploy - only the Playwright golden tests
         * that drive a real sign-up (middleware.test.ts,
         * app/rapport/nieuw/pand/__tests__/page.test.ts) set it, on the
         * `next start` server they spawn themselves.
         */}
        <AuthProvider authStoreOverride={process.env.TSG_AUTH_STORE}>
          {/*
           * Site-wide, so /zoeken finally has an entry point that is not
           * "know the URL". SiteNav removes itself on the print routes -
           * they are what the PDF pipeline renders, and a nav bar has no
           * business in a customer's PDF (see its own docstring).
           */}
          <SiteNav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
