import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

// ─── Type system ───────────────────────────────────────────────────────
// Geist Sans          → body, UI labels, table data. Modern grotesque
//                       with refined personality. NOT Inter.
// Bricolage Grotesque → display + headings. Variable axis (wdth+opsz)
//                       gives bold, geometric, slightly soft titles —
//                       contemporary, confident, never default.
// Geist Mono          → tabular numerics (amounts, IDs). Never body.
// ─────────────────────────────────────────────────────────────────────

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  // Variable font — weight omitted to pull the full axis. We tune
  // weight + opsz + wdth per-heading in globals.css via
  // font-variation-settings.
  axes: ["opsz", "wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GrowwStacks OS",
  description:
    "Internal CRM + project management for the GrowwStacks team.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
