/**
 * Root Layout — Verbatim App
 * ===========================
 * The skeleton of the entire app. Every page renders inside this.
 * Sets up fonts, metadata, background, and the dark theme.
 */

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Geist fonts — loaded locally so there's no external network request
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// metadata for SEO — every page inherits this unless overridden
export const metadata: Metadata = {
  title: "Verbatim — Video & Audio Transcription",
  description:
    "Upload videos or record audio and get accurate transcripts powered by Groq AI. Fast, reliable, and developer-friendly.",
  keywords: ["video transcription", "audio transcription", "AI", "Groq", "speech to text", "Verbatim"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-white text-gray-900`}
      >
        {/* background gradient layer — sits behind everything */}
        <div className="fixed inset-0 -z-10">
          {/* primary radial gradient — soft rose glow at the top */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(244,63,94,0.05)_0%,_transparent_50%)]" />
          {/* secondary gradient — adds depth at the bottom */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(251,113,133,0.04)_0%,_transparent_50%)]" />
          {/* noise texture overlay — super subtle, adds that premium grain */}
          <div className="absolute inset-0 opacity-[0.015]"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")" }}
          />
        </div>

        <main className="relative">{children}</main>
      </body>
    </html>
  );
}
