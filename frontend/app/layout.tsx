/**
 * Root Layout — Verbatim App
 * ===========================
 * Yeh file puri app ka skeleton hai.
 * Har page isi layout ke andar render hoga.
 * Font, metadata, global styles — sab yaha se control hota hai.
 */

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Geist font load ho raha hai — clean, modern, variable font
// Next.js ka local font loader use kar rahe hain, no external CDN call
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

// SEO metadata — search engines ke liye important hai yeh
// production mein OG tags bhi add karenge
export const metadata: Metadata = {
  title: "Verbatim — Video Transcription System",
  description:
    "Upload videos, get accurate transcripts powered by Groq AI. Fast, reliable, and developer-friendly.",
  keywords: ["video transcription", "AI", "Groq", "speech to text", "Verbatim"],
};

/**
 * RootLayout — sabse top-level wrapper component
 * Iske andar hi saari pages render hongi via {children}
 * Dark mode by default rakha hai — looks premium
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang="en" — accessibility ke liye zaroori hai
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100`}
      >
        {/* 
          Yaha par ek subtle background pattern daal sakte hain later
          Abhi ke liye gradient se kaam chala lete hain 
        */}
        <main className="relative">{children}</main>
      </body>
    </html>
  );
}
