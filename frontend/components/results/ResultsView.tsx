/**
 * ResultsView — The Masterpiece UI
 * ===================================
 * Split layout: video player on the left, interactive transcript
 * and chapters panel on the right with that sweet glassmorphism look.
 *
 * How the chapter → video binding works:
 *   1. We receive a ref to the <video> element from the parent
 *   2. Each chapter card stores its start timestamp
 *   3. On click: videoRef.currentTime = chapter.start → video.play()
 *   4. We listen to the video's "timeupdate" event to highlight
 *      whichever chapter the playback is currently inside of
 *
 * The SRT download creates a Blob on the fly — no server roundtrip needed.
 * We just take the SRT string from state, wrap it in a Blob, create a
 * temporary <a> element, click it programmatically, then clean up.
 */

"use client";

import { useRef, useState, useEffect, useCallback } from "react";

// types so TypeScript doesn't yell at us
interface Chapter {
  start: number;
  end: number;
  title: string;
}

interface ResultsViewProps {
  videoUrl: string;
  srtContent: string;
  chapters: Chapter[];
  transcriptText: string;
  executiveSummary: string | null;
  fileName: string;
}

// which tab is showing in the right panel
type PanelTab = "chapters" | "transcript" | "srt";

// Helper to convert SRT to VTT format entirely on the frontend
// This prevents us from needing to touch the backend logic at all!
function srtToVtt(srt: string): string {
  // Replace the comma with a period specifically in the timestamps
  const vttBody = srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${vttBody}`;
}

export default function ResultsView({
  videoUrl,
  srtContent,
  chapters,
  transcriptText,
  executiveSummary,
  fileName,
}: ResultsViewProps) {
  // the video element ref — this is how we control playback from chapter clicks
  const videoRef = useRef<HTMLVideoElement>(null);

  // tracks which chapter the playback cursor is currently inside
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(-1);

  // which tab is showing in the right panel
  const [panelTab, setPanelTab] = useState<PanelTab>("chapters");

  // current playback time — updated via the video's timeupdate event
  const [currentTime, setCurrentTime] = useState(0);

  // subtitle states
  const [showCaptions, setShowCaptions] = useState(true);
  const [vttUrl, setVttUrl] = useState<string | null>(null);

  // convert SRT to VTT and create a Blob URL for the video player
  useEffect(() => {
    if (!srtContent) return;
    
    const vtt = srtToVtt(srtContent);
    const blob = new Blob([vtt], { type: "text/vtt;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    setVttUrl(url);
    
    // clean up the URL when component unmounts or SRT changes
    return () => URL.revokeObjectURL(url);
  }, [srtContent]);

  // listen to the video's timeupdate event so we can highlight the active chapter
  // timeupdate fires roughly 4 times per second — plenty for our purposes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const t = video.currentTime;
      setCurrentTime(t);

      // figure out which chapter we're currently inside
      const idx = chapters.findIndex(
        (ch) => t >= ch.start && t < ch.end
      );
      setActiveChapterIndex(idx);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [chapters]);

  // when a chapter is clicked, seek the video to that timestamp and play
  // this is the core of the chapter → video binding
  const handleChapterClick = useCallback((chapter: Chapter) => {
    const video = videoRef.current;
    if (!video) return;

    // set the playback position to the chapter's start time
    video.currentTime = chapter.start;
    // auto-play from the new position — feels more natural than just seeking
    video.play().catch(() => {
      // some browsers block autoplay, that's fine — the seek still works
      console.log("[Verbatim] Autoplay blocked, but seek worked");
    });
  }, []);

  // download the SRT file — creates a blob URL on the fly
  const handleDownloadSRT = useCallback(() => {
    if (!srtContent) return;

    // create a blob from the SRT string
    const blob = new Blob([srtContent], { type: "text/srt;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    // create a temporary <a> tag, click it, then clean up
    // this is the standard browser download trick — no server needed
    const link = document.createElement("a");
    const baseName = fileName.replace(/\.[^.]+$/, "");
    link.href = url;
    link.download = `${baseName}_transcript.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log("[Verbatim] SRT download triggered");
  }, [srtContent, fileName]);

  // format seconds to MM:SS for the chapter timestamps
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full animate-fade-in">
      {/* executive summary — spans full width above the split view */}
      {executiveSummary && (
        <div className="mb-6 p-5 glass-strong rounded-2xl animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            <h3 className="text-sm font-semibold text-rose-500 uppercase tracking-wider">
              Executive Summary
            </h3>
          </div>
          <p className="text-gray-800 leading-relaxed text-sm">{executiveSummary}</p>
        </div>
      )}

      {/* the main split view — video left, panel right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT SIDE — video player (takes 3/5 on desktop) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="relative rounded-2xl overflow-hidden glass-strong glow-rose bg-white border-rose-100">
            <video
              ref={videoRef}
              controls
              className="w-full aspect-video bg-black rounded-t-xl lg:rounded-xl"
              preload="metadata"
              crossOrigin="anonymous"
            >
              <source src={videoUrl} type="video/mp4" />
              {showCaptions && vttUrl && (
                <track 
                  src={vttUrl} 
                  kind="subtitles" 
                  srcLang="en" 
                  label="English" 
                  default 
                />
              )}
            </video>
          </div>

          {/* action bar below the video — download SRT + file info */}
          <div className="flex items-center justify-between gap-4 px-1">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              <span className="truncate max-w-[200px]">{fileName}</span>
            </div>

            <div className="flex items-center gap-3">
              {/* CC Toggle */}
              <button
                onClick={() => setShowCaptions(!showCaptions)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border transition-all duration-200
                  ${showCaptions 
                    ? "bg-rose-50 border-rose-200 text-rose-600 shadow-sm" 
                    : "bg-white border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                {showCaptions ? "Captions On" : "Captions Off"}
              </button>

              {/* Download SRT */}
              <button
                onClick={handleDownloadSRT}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
                  bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-200
                  text-gray-700 hover:text-rose-600 transition-all duration-200
                  hover:shadow-sm active:scale-[0.97]"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download .SRT
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE — interactive transcript & chapters panel (2/5 on desktop) */}
        <div className="lg:col-span-2 flex flex-col">
          {/* panel tabs */}
          <div className="flex gap-1 mb-4 p-1 bg-gray-50 rounded-xl border border-gray-200">
            {(["chapters", "transcript", "srt"] as PanelTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setPanelTab(tab)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
                  ${panelTab === tab
                    ? "bg-white text-rose-600 shadow-sm border border-gray-100"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  }`}
              >
                {tab === "chapters" ? "Chapters" : tab === "transcript" ? "Transcript" : "SRT Raw"}
              </button>
            ))}
          </div>

          {/* panel content — scrollable with glassmorphism */}
          <div className="flex-1 bg-white border border-rose-100 rounded-2xl p-4 overflow-hidden flex flex-col
            min-h-[400px] max-h-[calc(100vh-300px)] shadow-sm">

            {/* CHAPTERS TAB */}
            {panelTab === "chapters" && (
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {chapters.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                    No chapters generated
                  </div>
                ) : (
                  chapters.map((ch, i) => {
                    const isActive = i === activeChapterIndex;
                    return (
                      <button
                        key={i}
                        onClick={() => handleChapterClick(ch)}
                        className={`w-full text-left p-3.5 rounded-xl transition-all duration-300 group
                          ${isActive
                            ? "bg-rose-50 border border-rose-200 ring-glow-rose"
                            : "bg-white border border-gray-100 hover:bg-gray-50 hover:border-rose-100 shadow-sm"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* chapter number badge */}
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
                            ${isActive
                              ? "bg-rose-100 text-rose-600"
                              : "bg-gray-100 text-gray-500 group-hover:text-gray-900 group-hover:bg-rose-50"
                            }`}>
                            {i + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate
                              ${isActive ? "text-rose-700" : "text-gray-900"}`}>
                              {ch.title}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`font-mono text-[10px]
                                ${isActive ? "text-rose-500" : "text-gray-500"}`}>
                                {formatTime(ch.start)} — {formatTime(ch.end)}
                              </span>
                            </div>
                          </div>

                          {/* play icon — appears on hover or when active */}
                          <svg
                            className={`w-4 h-4 shrink-0 transition-all duration-200
                              ${isActive
                                ? "text-rose-500 scale-110"
                                : "text-gray-400 opacity-0 group-hover:opacity-100 group-hover:text-rose-400"
                              }`}
                            fill="currentColor" viewBox="0 0 24 24"
                          >
                            <path d="M8 5.14v14l11-7-11-7z" />
                          </svg>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* TRANSCRIPT TAB */}
            {panelTab === "transcript" && (
              <div className="flex-1 overflow-y-auto pr-1">
                <p className="text-sm text-gray-800 leading-7 whitespace-pre-wrap">
                  {transcriptText || "No transcript available"}
                </p>
              </div>
            )}

            {/* SRT RAW TAB — for the nerds who want to see the raw subtitle data */}
            {panelTab === "srt" && (
              <div className="flex-1 overflow-y-auto pr-1">
                <pre className="text-xs text-gray-600 font-mono leading-6 whitespace-pre-wrap">
                  {srtContent || "No SRT data available"}
                </pre>
              </div>
            )}
          </div>

          {/* playback position indicator */}
          <div className="mt-3 flex items-center justify-between px-1">
            <span className="text-[10px] text-gray-500 font-mono">
              Playback: {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-gray-500">
              {chapters.length} chapters · {transcriptText?.split(" ").length || 0} words
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
