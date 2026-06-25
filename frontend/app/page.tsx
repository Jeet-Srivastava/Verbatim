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
    <div className="min-h-screen font-sans">
      <Navbar />

      {/* SECTION 1: Hero — takes full viewport minus navbar */}
      <section className="relative flex flex-col items-center justify-center px-4 py-16 md:py-24 min-h-[calc(100vh-3.5rem)]">
        {/* brand + tagline */}
        <div className="text-center mb-12 animate-fade-in flex flex-col items-center">
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
          <div className="flex flex-col sm:flex-row items-center justify-center mt-8">
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

        {/* scroll indicator arrow */}
        <div className="absolute bottom-10 animate-bounce text-rose-300 hover:text-rose-400 transition-colors hidden md:block">
          <a href="#about" aria-label="Scroll down to learn more">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </div>
      </section>

      {/* SECTION 2: About / The Tech */}
      <section id="about" className="py-24 bg-rose-50/50 border-t border-rose-100 flex flex-col items-center px-4">
        <div className="max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Why Verbatim?</h2>
          <p className="text-base md:text-lg text-gray-600 leading-relaxed mb-8">
            In today&apos;s fast-paced digital world, valuable insights are often lost in hours of unstructured audio and video. 
            <strong> Verbatim solves this by transforming your media into actionable, highly accurate text in seconds. </strong> 
            Whether you are a content creator generating subtitles, a journalist reviewing interviews, or a team summarizing 
            long meetings, Verbatim delivers instant transcripts and intelligent chapter breakdowns—empowering you to focus 
            on the content that matters, not the manual transcription.
          </p>
          
          <div className="flex justify-center mb-16">
            <a
              href="https://github.com/Jeet-Srivastava/Verbatim"
              target="_blank"
              rel="noopener noreferrer"
              className="px-7 py-3.5 rounded-xl font-medium text-gray-600
                border border-gray-200 hover:border-rose-200
                hover:text-rose-600 hover:bg-rose-50
                transition-all duration-200 shadow-sm bg-white"
            >
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                View Source Code
              </span>
            </a>
          </div>

          {/* footer text */}
          <div className="pt-8 border-t border-gray-200">
            <p className="text-xs text-gray-400">
              Built with Next.js, FastAPI & Groq — by Jeet Srivastava
            </p>
          </div>
        </div>
      </section>
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
