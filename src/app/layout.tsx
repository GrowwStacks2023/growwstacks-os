import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

// ─── Type system ───────────────────────────────────────────────────────
// Geist Sans → body, UI labels, table data. Refined modern grotesque,
//   distinctive without being loud. NOT Inter.
// Fraunces  → display + headings. A variable serif with an opsz axis we
//   tune for editorial warmth (soft, slightly old-style). Gives the
//   product a voice rather than the default-shadcn shrug.
// Geist Mono → tabular numerics where alignment matters (amounts,
//   IDs). Not used for body copy.
// ─────────────────────────────────────────────────────────────────────

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  // Variable font — weight omitted so Next pulls the full axis. We tune
  // weight + opsz + SOFT per-heading in globals.css via
  // font-variation-settings.
  axes: ["opsz", "SOFT"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
