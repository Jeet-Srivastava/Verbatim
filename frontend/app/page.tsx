/**
 * Verbatim — Landing Page
 * ========================
 * Yeh hai main page jo user ko sabse pehle dikhega.
 * Upload area, status indicator, aur basic branding hai yaha.
 * Abhi static hai — baad mein API integration aayega.
 */

export default function Home() {
  return (
    // full screen centered layout — hero section jaisa feel
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16">

      {/* -----------------------------------------------
          Header section — branding + tagline
          pehli impression yahi se banti hai bhai
      ----------------------------------------------- */}
      <div className="text-center mb-12 animate-fade-in">
        {/* Logo / Brand name — bold aur prominent */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400">
            Verbatim
          </span>
        </h1>

        {/* Tagline — chhota, crisp, point pe */}
        <p className="text-lg md:text-xl text-zinc-400 max-w-md mx-auto text-balance">
          Upload your video. Get an accurate transcript.
          <br />
          <span className="text-zinc-500">Powered by Groq AI — blazing fast.</span>
        </p>
      </div>

      {/* -----------------------------------------------
          Upload Card — yaha video drop/select hoga
          glassmorphism effect laga hai — premium feel
      ----------------------------------------------- */}
      <div
        className="glass rounded-2xl p-8 md:p-12 w-full max-w-xl text-center 
                   animate-fade-in transition-all duration-300 
                   hover:border-violet-500/30 hover:glow-violet cursor-pointer group"
        style={{ animationDelay: "0.2s", opacity: 0 }}
      >
        {/* Upload icon — SVG inline rakha hai, external dependency nahi chahiye */}
        <div className="mb-6">
          <svg
            className="w-16 h-16 mx-auto text-violet-400 group-hover:text-violet-300 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>

        {/* Upload instructions — clear aur simple */}
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">
          Drop your video here
        </h2>
        <p className="text-sm text-zinc-500 mb-6">
          MP4, MKV, AVI, MOV — 500MB tak upload kar sakte ho
        </p>

        {/* Upload button — ye abhi dummy hai, functionality baad mein */}
        <button
          className="px-6 py-3 bg-violet-600 hover:bg-violet-500 
                     text-white font-medium rounded-xl 
                     transition-all duration-200 
                     hover:shadow-lg hover:shadow-violet-500/25
                     active:scale-95"
        >
          Select Video File
        </button>
      </div>

      {/* -----------------------------------------------
          Status / Feature cards — kya kya hoga batao
          user ko confidence dena hai ki system solid hai
      ----------------------------------------------- */}
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 w-full max-w-3xl animate-fade-in"
        style={{ animationDelay: "0.4s", opacity: 0 }}
      >
        {/* Feature 1 — Fast processing */}
        <div className="glass rounded-xl p-5 text-center">
          <div className="text-2xl mb-2">⚡</div>
          <h3 className="text-sm font-semibold text-zinc-300">Lightning Fast</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Groq inference — seconds mein transcript ready
          </p>
        </div>

        {/* Feature 2 — Accurate output */}
        <div className="glass rounded-xl p-5 text-center">
          <div className="text-2xl mb-2">🎯</div>
          <h3 className="text-sm font-semibold text-zinc-300">High Accuracy</h3>
          <p className="text-xs text-zinc-500 mt-1">
            State-of-the-art speech recognition models
          </p>
        </div>

        {/* Feature 3 — Multiple formats support */}
        <div className="glass rounded-xl p-5 text-center">
          <div className="text-2xl mb-2">📁</div>
          <h3 className="text-sm font-semibold text-zinc-300">Any Format</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Video daalo kisi bhi format mein — hum handle kar lenge
          </p>
        </div>
      </div>

      {/* -----------------------------------------------
          Footer line — subtle, non-intrusive
      ----------------------------------------------- */}
      <p
        className="mt-16 text-xs text-zinc-600 animate-fade-in"
        style={{ animationDelay: "0.6s", opacity: 0 }}
      >
        Built with Next.js, FastAPI & Groq — by Jeet Srivastava
      </p>
    </div>
  );
}
