/**
 * Upload Page — Full Pipeline UI
 * ==================================
 * This page has two modes:
 *   1. UPLOAD MODE — drag & drop or record audio, hit transcribe
 *   2. RESULTS MODE — video player + interactive chapters/transcript panel
 *
 * When the user uploads a file and the backend finishes processing,
 * we flip into results mode showing the full ResultsView.
 * The "New Upload" button resets everything back to upload mode.
 *
 * Architecture:
 *   - File object lives in a ref (not state) to avoid memory bloat
 *   - Video URL is an Object URL for local preview, no server roundtrip
 *   - All transcript data (SRT, chapters, summary) lives in React state
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Tabs from "@/components/ui/Tabs";
import DropZone from "@/components/upload/DropZone";
import AudioRecorder from "@/components/upload/AudioRecorder";
import ResultsView from "@/components/results/ResultsView";

interface Chapter {
  start: number;
  end: number;
  title: string;
}

// tab configuration — icons are inline SVGs to avoid external deps
const TABS = [
  {
    id: "upload",
    label: "Upload File",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>
    ),
  },
  {
    id: "record",
    label: "Record Audio",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
        />
      </svg>
    ),
  },
];

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState("upload");
  const [hasFile, setHasFile] = useState(false);
  const [fileName, setFileName] = useState("");

  // processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState("");
  const [progressStep, setProgressStep] = useState(0);
  
  // results — these get populated after the backend responds
  const [srtContent, setSrtContent] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<string | null>(null);

  // are we in "results mode"? derived from whether we have transcript data
  const hasResults = !!srtContent && !isProcessing;

  // the raw File object — lives in a ref because React state would serialize it
  const fileRef = useRef<File | null>(null);

  // called when either the dropzone or recorder produces a file
  const handleFileReady = useCallback((file: File) => {
    fileRef.current = file;
    setHasFile(true);
    setFileName(file.name);
    
    // clean up old object URL if any
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    
    // create a fresh local preview URL — the video player will use this
    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    // reset any previous results so we don't show stale data
    setSrtContent(null);
    setChapters([]);
    setTranscriptText(null);
    setExecutiveSummary(null);
    
    console.log(`[Verbatim] File ready: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  }, [videoUrl]);

  const handleFileRemoved = useCallback(() => {
    fileRef.current = null;
    setHasFile(false);
    setFileName("");
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
  }, [videoUrl]);

  // reset everything back to upload mode — the "start over" button
  const handleNewUpload = useCallback(() => {
    handleFileRemoved();
    setSrtContent(null);
    setChapters([]);
    setTranscriptText(null);
    setExecutiveSummary(null);
    setProgressStep(0);
  }, [handleFileRemoved]);

  // the big one — send the file to our FastAPI backend and wait for magic
  const handleTranscribe = useCallback(async () => {
    const file = fileRef.current;
    if (!file) return;
    
    setIsProcessing(true);
    setProgressStep(1);
    setProgressStatus("Uploading your file to the server...");
    
    try {
      const formData = new FormData();
      formData.append("file", file);

      console.log("[Verbatim] Starting transcription pipeline for:", file.name);

      // simulate progress steps since the backend is a single long request
      // in production you'd use websockets or SSE for real progress
      const progressTimer = setTimeout(() => {
        setProgressStep(2);
        setProgressStatus("Extracting audio with FFmpeg...");
      }, 2000);

      const progressTimer2 = setTimeout(() => {
        setProgressStep(3);
        setProgressStatus("Transcribing with Whisper AI...");
      }, 5000);

      const progressTimer3 = setTimeout(() => {
        setProgressStep(4);
        setProgressStatus("Generating chapters with LLaMA...");
      }, 10000);

      const res = await fetch("http://localhost:8000/api/process", {
        method: "POST",
        body: formData,
      });

      // clear the fake progress timers once the real response arrives
      clearTimeout(progressTimer);
      clearTimeout(progressTimer2);
      clearTimeout(progressTimer3);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Pipeline failed on the backend");
      }

      const data = await res.json();
      console.log("[Verbatim] Pipeline complete!", data);

      // store results in state — this triggers the switch to results mode
      if (data.transcription) {
        setSrtContent(data.transcription.srt);
        setTranscriptText(data.transcription.text);
      }
      
      if (data.analysis) {
        setChapters(data.analysis.chapters || []);
        setExecutiveSummary(data.analysis.summary || null);
      }
      
    } catch (err: unknown) {
      console.error("[Verbatim] Pipeline error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`Something went wrong: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus("");
      setProgressStep(0);
    }
  }, []);

  // clean up Object URLs on unmount so we don't leak browser memory
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // progress step labels for the loading animation
  const PROGRESS_STEPS = [
    { label: "Upload", icon: "↑" },
    { label: "FFmpeg", icon: "🎵" },
    { label: "Whisper", icon: "🗣️" },
    { label: "LLaMA", icon: "🧠" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ============================================
          RESULTS MODE — the masterpiece layout
          video player left, chapters/transcript right
      ============================================ */}
      {hasResults && videoUrl ? (
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-10 py-6 md:py-10">
          {/* top bar with back button and status */}
          <div className="flex items-center justify-between mb-6 animate-fade-in">
            <button
              onClick={handleNewUpload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40
                text-zinc-400 hover:text-white transition-all duration-200
                active:scale-[0.97]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              New Upload
            </button>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse" />
              <span className="text-xs text-zinc-500 font-medium">Analysis Complete</span>
            </div>
          </div>

          {/* the actual ResultsView component — the star of the show */}
          <ResultsView
            videoUrl={videoUrl}
            srtContent={srtContent!}
            chapters={chapters}
            transcriptText={transcriptText || ""}
            executiveSummary={executiveSummary}
            fileName={fileName}
          />
        </div>
      ) : (
        /* ============================================
           UPLOAD MODE — the original upload shell
        ============================================ */
        <div className="flex-1 flex flex-col items-center px-4 sm:px-6 py-10 md:py-16">
          {/* page header */}
          <div className="text-center mb-8 animate-fade-in">
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 mb-2">
              Upload Media
            </h1>
            <p className="text-sm text-zinc-500 max-w-md">
              Drop a video or audio file, or record directly from your mic.
              We&apos;ll handle the transcription.
            </p>
          </div>

          {/* tab switcher */}
          <div className="mb-8 animate-fade-in stagger" style={{ animationDelay: "100ms" }}>
            <Tabs
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                handleFileRemoved();
              }}
            />
          </div>

          {/* tab content */}
          <div className="w-full max-w-xl animate-fade-in stagger" style={{ animationDelay: "200ms" }}>
            {activeTab === "upload" ? (
              <DropZone
                onFileSelected={handleFileReady}
                onFileRemoved={handleFileRemoved}
              />
            ) : (
              <AudioRecorder
                onRecordingComplete={handleFileReady}
              />
            )}
          </div>

          {/* transcribe button — shows when a file is ready and we're not processing */}
          {hasFile && !isProcessing && !srtContent && (
            <div className="mt-8 animate-slide-up">
              <button
                onClick={handleTranscribe}
                className="group relative px-8 py-3.5 rounded-xl font-semibold text-white
                  bg-gradient-to-r from-cyan-600 to-blue-600
                  hover:from-cyan-500 hover:to-blue-500
                  transition-all duration-300
                  hover:shadow-xl hover:shadow-cyan-500/20
                  active:scale-[0.97]"
              >
                <div className="absolute inset-0 rounded-xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent
                    animate-shimmer" style={{ backgroundSize: "200% 100%" }} />
                </div>
                <span className="relative flex items-center gap-2">
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                    />
                  </svg>
                  Start Transcription
                </span>
              </button>
            </div>
          )}

          {/* futuristic loading state with step progress */}
          {isProcessing && (
            <div className="mt-12 flex flex-col items-center animate-fade-in w-full max-w-md">
              {/* step progress bar */}
              <div className="w-full flex items-center gap-2 mb-8">
                {PROGRESS_STEPS.map((step, i) => {
                  const stepNum = i + 1;
                  const isCurrentStep = stepNum === progressStep;
                  const isCompleted = stepNum < progressStep;
                  return (
                    <div key={step.label} className="flex-1 flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm
                        transition-all duration-500
                        ${isCompleted
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : isCurrentStep
                            ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 animate-pulse glow-cyan"
                            : "bg-zinc-800/50 text-zinc-600 border border-zinc-700/30"
                        }`}>
                        {isCompleted ? "✓" : step.icon}
                      </div>
                      <span className={`text-[10px] font-medium tracking-wider uppercase
                        ${isCurrentStep ? "text-cyan-400" : isCompleted ? "text-zinc-400" : "text-zinc-600"}`}>
                        {step.label}
                      </span>
                      {/* connector line between steps */}
                      {i < PROGRESS_STEPS.length - 1 && (
                        <div className={`absolute h-0.5 w-full top-5
                          ${isCompleted ? "bg-cyan-500/30" : "bg-zinc-800"}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* spinning rings */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-blue-500/30 border-b-blue-400 animate-spin"
                  style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                <svg className="w-6 h-6 text-cyan-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>

              {/* status text */}
              <div className="mt-6 font-mono text-sm text-cyan-400 tracking-wider uppercase animate-pulse text-center">
                {progressStatus}
              </div>
              <div className="mt-2 text-xs text-zinc-600 text-center">
                This usually takes 30-60 seconds depending on file size
              </div>
            </div>
          )}

          {/* bottom info */}
          <p className="mt-12 text-xs text-zinc-700 animate-fade-in stagger" style={{ animationDelay: "400ms" }}>
            Your files are processed securely and never stored permanently.
          </p>
        </div>
      )}
    </div>
  );
}
