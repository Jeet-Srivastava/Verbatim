/**
 * Upload Page — The Main UI Shell
 * ==================================
 * This is where users land to upload or record media.
 * Two tabs: "Upload File" (drag & drop) and "Record Audio" (mic).
 * 
 * The file/recording flows through here and eventually gets sent
 * to the backend for transcription. Right now we're just building
 * the shell — API calls come later.
 *
 * Architecture note: the File object lives here in a ref, not in
 * any child component. Children communicate via callbacks.
 * This way we have a single source of truth for what's being processed.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Tabs from "@/components/ui/Tabs";
import DropZone from "@/components/upload/DropZone";
import AudioRecorder from "@/components/upload/AudioRecorder";

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

  // New state variables for processing & results
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState("");
  
  const [srtContent, setSrtContent] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<string | null>(null);

  // single source of truth for the file we're about to process
  const fileRef = useRef<File | null>(null);

  // called when either the dropzone or recorder produces a file
  const handleFileReady = useCallback((file: File) => {
    fileRef.current = file;
    setHasFile(true);
    
    // clean up old object URL if any
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    
    // create a fresh local preview URL
    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    // reset any previous results
    setSrtContent(null);
    setChapters([]);
    setTranscriptText(null);
    setExecutiveSummary(null);
    
    console.log(`[Verbatim] File ready: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  }, [videoUrl]);

  const handleFileRemoved = useCallback(() => {
    fileRef.current = null;
    setHasFile(false);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
  }, [videoUrl]);

  // send the file to our FastAPI backend
  const handleTranscribe = useCallback(async () => {
    const file = fileRef.current;
    if (!file) return;
    
    setIsProcessing(true);
    setProgressStatus("Uploading media to server...");
    
    try {
      // package it up real nice for the backend
      const formData = new FormData();
      formData.append("file", file);

      console.log("[Verbatim] Starting transcription pipeline for:", file.name);

      // We'll just wait for the monolithic endpoint. 
      // In a real prod app, we'd probably use websockets for real-time progress.
      setProgressStatus("Extracting audio & running Whisper + LLaMA... this might take a minute ⏳");

      const res = await fetch("http://localhost:8000/api/process", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Transcription pipeline failed on the backend");
      }

      const data = await res.json();
      console.log("[Verbatim] Pipeline complete!", data);

      // store the awesome results in state
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
      alert(`Oops, something broke: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
      setProgressStatus("");
    }
  }, []);

  // Cleanup object URLs when unmounting to prevent memory leaks
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* main content area — centered with constrained width */}
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
              // clear any existing file when switching tabs
              // prevents confusing state where you switch tabs but old file is still "ready"
              handleFileRemoved();
            }}
          />
        </div>

        {/* tab content — constrained width for readability */}
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

        {/* transcribe CTA — appears when a file is ready and we aren't processing */}
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
              {/* subtle shimmer effect on the button */}
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

        {/* Futuristic loading state */}
        {isProcessing && (
          <div className="mt-12 flex flex-col items-center animate-fade-in">
            <div className="relative w-16 h-16 flex items-center justify-center">
              {/* Spinning glowing rings */}
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-blue-500/30 border-b-blue-400 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
              <svg className="w-6 h-6 text-cyan-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div className="mt-6 font-mono text-sm text-cyan-400 tracking-wider uppercase animate-pulse">
              {progressStatus}
            </div>
            <div className="mt-2 text-xs text-zinc-500 max-w-sm text-center">
              We are extracting audio, compressing via ffmpeg, transcribing via Whisper, and generating chapters with LLaMA.
            </div>
          </div>
        )}

        {/* Temporary rough display of results, just to verify it's working for now */}
        {srtContent && !isProcessing && (
          <div className="mt-12 w-full max-w-3xl animate-slide-up bg-zinc-900/50 backdrop-blur-md rounded-2xl border border-zinc-800/50 p-6 md:p-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
              Analysis Complete
            </h2>
            
            {executiveSummary && (
              <div className="mb-8 p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-2">Executive Summary</h3>
                <p className="text-zinc-300 leading-relaxed text-sm">{executiveSummary}</p>
              </div>
            )}

            {chapters.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4">Generated Chapters</h3>
                <div className="grid gap-3">
                  {chapters.map((ch, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors border border-zinc-700/30">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-zinc-500">
                          {new Date(ch.start * 1000).toISOString().substr(14, 5)}
                        </span>
                        <span className="text-sm text-zinc-200 font-medium">{ch.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {transcriptText && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Full Transcript</h3>
                <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
                  <p className="text-zinc-300 leading-relaxed text-sm whitespace-pre-wrap">{transcriptText}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* bottom info text */}
        <p className="mt-12 text-xs text-zinc-700 animate-fade-in stagger" style={{ animationDelay: "400ms" }}>
          Your files are processed securely and never stored permanently.
        </p>
      </div>
    </div>
  );
}
