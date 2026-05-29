import type { Metadata } from "next";
import {
  JetBrains_Mono,
  Plus_Jakarta_Sans,
  Space_Grotesk,
} from "next/font/google";

import "./globals.css";

// ─── Type system per the GrowwStacks OS v3 spec ────────────────────────
// Space Grotesk     → display + headings (h1–h4, page titles, card titles,
//                     KPI values), letter-spacing -0.02em
// Plus Jakarta Sans → body, UI labels, buttons, table cells,
//                     letter-spacing -0.01em
// JetBrains Mono    → numerics, IDs, amounts, references; tabular figures
// ───────────────────────────────────────────────────────────────────────

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      className={`${jakarta.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
