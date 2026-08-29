import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/lib/auth/useAuth";
import { SiteNav } from "./_components/site-nav";
import "./globals.css";

/**
 * Inter via next/font (DESIGN_SPEC.md §2): the font is fetched and
 * self-hosted at build time rather than requested from Google at runtime,
 * which is what removes the flash of unstyled text and keeps the render
 * server-side. Exposed as a CSS variable so globals.css's --font-sans -
 * the single place the family is chosen - can point at it.
 *
 * Inter carries everything that is read rather than looked at: body copy,
 * labels, and - the part that matters most - every figure in the report,
 * where its tabular-nums keep columns aligned (DESIGN_SPEC.md §2). The
 * heading face below does not touch any of that.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Space Grotesk, the Yield & Stone heading face. Same next/font
 * treatment as Inter: self-hosted at build time, exposed as a variable,
 * display:swap - so it costs no runtime request and no layout-blocking
 * fetch.
 *
 * Three weights, not the full family: 500/600/700 is what the heading
 * scale in DESIGN_SPEC.md §2 actually uses (H1-H3 are all semibold, with
 * 500 for the eyebrow labels and 700 available for the wordmark). Asking
 * for the other four weights would roughly double this face's payload
 * for glyphs nothing renders.
 *
 * It is deliberately NOT applied to figures. Space Grotesk has no
 * tabular-nums feature to speak of, and the report's whole numeric
 * discipline rests on Inter's - so the split is "titles and the wordmark
 * versus everything that is data", enforced in globals.css rather than
 * per component.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yield & Stone — Rentabiliteitsrapport",
  description:
    "Onderbouwd rendementsrapport voor Spaans vastgoed. Elke uitkomst herleidbaar, elke aanname zichtbaar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${inter.variable} ${spaceGrotesk.variable}`}>
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
