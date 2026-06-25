/**
 * Verbatim — Landing Page
 * ========================
 * This is the first thing people see. It needs to look insane.
 * Hero section with the brand, a clear CTA that sends them to /upload,
 * and a few feature cards to build trust.
 */

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* hero section — full viewport centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 md:py-24">
        {/* brand + tagline */}
        <div className="text-center mb-12 animate-fade-in">
          {/* glowing accent dot above the title */}
          <div className="flex justify-center mb-6">
            <div className="w-2 h-2 rounded-full bg-rose-400 glow-rose" />
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-5">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-pink-500 to-rose-400">
              Verbatim
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 max-w-lg mx-auto text-balance leading-relaxed">
            Upload your video or audio. Get an accurate transcript
            in seconds — powered by Groq AI.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Link
              href="/upload"
              className="group relative px-7 py-3.5 rounded-xl font-semibold text-white
                bg-gradient-to-r from-rose-500 to-pink-600
                hover:from-rose-400 hover:to-pink-500
                transition-all duration-300
                hover:shadow-xl hover:shadow-rose-500/20
                active:scale-[0.97]"
            >
              <span className="flex items-center gap-2">
                Get Started
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </Link>

            <a
              href="https://github.com/Jeet-Srivastava/Verbatim"
              target="_blank"
              rel="noopener noreferrer"
              className="px-7 py-3.5 rounded-xl font-medium text-gray-500
                border border-gray-200 hover:border-gray-300
                hover:text-gray-900 hover:bg-gray-50
                transition-all duration-200"
            >
              View Source
            </a>
          </div>
        </div>

        {/* feature cards — three column grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl animate-fade-in stagger"
          style={{ animationDelay: "200ms" }}
        >
          <FeatureCard
            icon="⚡"
            title="Lightning Fast"
            description="Groq inference engine — transcripts ready in seconds, not minutes."
          />
          <FeatureCard
            icon="🎯"
            title="High Accuracy"
            description="State-of-the-art Whisper models fine-tuned for production quality."
          />
          <FeatureCard
            icon="🎙️"
            title="Upload or Record"
            description="Drag & drop files or record directly from your microphone."
          />
        </div>

        {/* footer text */}
        <p className="mt-16 text-xs text-gray-400 animate-fade-in stagger" style={{ animationDelay: "400ms" }}>
          Built with Next.js, FastAPI & Groq — by Jeet Srivastava
        </p>
      </div>
    </div>
  );
}

// small helper component — keeps the page file clean
function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="glass rounded-xl p-5 text-center hover:border-rose-200
      transition-all duration-300 group hover:ring-glow-rose">
      <div className="text-2xl mb-2.5 group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
