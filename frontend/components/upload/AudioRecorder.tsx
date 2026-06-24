/**
 * AudioRecorder Component — Record Audio from Mic
 * ==================================================
 * Uses the MediaRecorder API to capture audio from the user's mic.
 * Recording happens in chunks (via ondataavailable) so we're not
 * holding the entire recording in memory during capture.
 * 
 * The final blob is assembled only when the user hits stop.
 * This is how you handle potentially long recordings without
 * making the browser tab eat 2GB of RAM.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type RecordingState = "idle" | "requesting" | "recording" | "paused" | "stopped";

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
}

export default function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);         // in seconds
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // refs for stuff we don't want triggering re-renders
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);          // audio data comes in as chunks
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);   // accumulated paused time

  // cleanup on unmount — stop everything, release resources
  useEffect(() => {
    return () => {
      stopTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  // intentionally only run on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = Date.now() - (pausedDurationRef.current * 1000);
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDuration(elapsed);
    }, 200); // 200ms interval is enough for a timer display, no need for 60fps
  }, [stopTimer]);

  // start recording — requests mic permission first
  const startRecording = useCallback(async () => {
    setError(null);
    setState("requesting");

    try {
      // get the mic stream — this triggers the browser permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      // figure out what format this browser supports
      // webm/opus is the most widely supported, fallback to webm
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000, // 128kbps — good quality without huge files
      });

      // chunks come in via this callback
      // we're collecting them in a ref array — not state — so no re-renders
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // when recording stops, assemble the final blob
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // wrap the blob as a File so it matches the upload flow
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, "-");
        const file = new File([blob], `recording-${timestamp}.webm`, {
          type: mimeType,
          lastModified: Date.now(),
        });
        onRecordingComplete(file);
      };

      // request data every 1 second — this is the chunking strategy
      // prevents the entire recording from being buffered in one massive blob
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      pausedDurationRef.current = 0;
      setState("recording");
      startTimer();

    } catch (err) {
      // user denied mic access or something went wrong
      const message = err instanceof Error ? err.message : "Microphone access denied";
      if (message.includes("Permission") || message.includes("NotAllowed")) {
        setError("Mic permission denied. Check your browser settings.");
      } else {
        setError(`Could not access microphone: ${message}`);
      }
      setState("idle");
    }
  }, [onRecordingComplete, startTimer]);

  // pause/resume recording
  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === "recording") {
      recorder.pause();
      pausedDurationRef.current = duration;
      stopTimer();
      setState("paused");
    } else if (recorder.state === "paused") {
      recorder.resume();
      startTimer();
      setState("recording");
    }
  }, [duration, startTimer, stopTimer]);

  // stop recording — this triggers onstop which assembles the blob
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    // release the mic — the browser should show the mic indicator going away
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    stopTimer();
    setState("stopped");
  }, [stopTimer]);

  // reset everything for a new recording
  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    chunksRef.current = [];
    pausedDurationRef.current = 0;
    setState("idle");
  }, [audioUrl]);

  return (
    <div className="w-full">
      <div className="glass-strong rounded-2xl p-8 md:p-10">
        {/* header area with the waveform visualization */}
        <div className="flex flex-col items-center mb-8">
          {/* waveform / mic icon area */}
          <div className="relative mb-6">
            {state === "recording" ? (
              // live waveform bars when recording
              <div className="flex items-center gap-1 h-12">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-cyan-400 rounded-full"
                    style={{
                      animation: `wave-bar 0.8s ease-in-out infinite`,
                      animationDelay: `${i * 0.07}s`,
                      height: "12px",
                    }}
                  />
                ))}
              </div>
            ) : state === "paused" ? (
              // static bars when paused
              <div className="flex items-center gap-1 h-12">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-cyan-500/30"
                    style={{ height: `${8 + (i % 3) * 8}px` }}
                  />
                ))}
              </div>
            ) : (
              // mic icon when idle or stopped
              <div className={`p-5 rounded-2xl transition-all duration-300 ${
                state === "stopped" ? "bg-cyan-500/15" : "bg-zinc-800/60"
              }`}>
                <svg
                  className={`w-8 h-8 ${state === "stopped" ? "text-cyan-400" : "text-zinc-500"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                  />
                </svg>
              </div>
            )}

            {/* recording indicator dot */}
            {state === "recording" && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 dot-pulse" />
            )}
          </div>

          {/* timer display */}
          <div className="font-mono text-3xl font-light text-zinc-200 tracking-wider">
            {formatTime(duration)}
          </div>

          {/* status text */}
          <p className={`text-xs mt-2 font-medium ${
            state === "recording" ? "text-red-400" :
            state === "paused" ? "text-amber-400" :
            state === "stopped" ? "text-cyan-400" :
            "text-zinc-500"
          }`}>
            {state === "recording" && "Recording..."}
            {state === "paused" && "Paused"}
            {state === "stopped" && "Recording complete"}
            {state === "idle" && "Ready to record"}
            {state === "requesting" && "Requesting mic access..."}
          </p>
        </div>

        {/* control buttons */}
        <div className="flex items-center justify-center gap-3">
          {state === "idle" && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-6 py-3 rounded-xl
                bg-cyan-600 hover:bg-cyan-500 text-white font-medium
                transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/25
                active:scale-95"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              Start Recording
            </button>
          )}

          {state === "requesting" && (
            <button disabled className="flex items-center gap-2 px-6 py-3 rounded-xl
              bg-zinc-700 text-zinc-400 font-medium cursor-wait">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
              Requesting access...
            </button>
          )}

          {(state === "recording" || state === "paused") && (
            <>
              {/* pause/resume */}
              <button
                onClick={togglePause}
                className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700
                  text-zinc-300 transition-all duration-200 active:scale-95"
                title={state === "paused" ? "Resume" : "Pause"}
              >
                {state === "paused" ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                )}
              </button>

              {/* stop */}
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-6 py-3 rounded-xl
                  bg-red-600/90 hover:bg-red-500 text-white font-medium
                  transition-all duration-200 active:scale-95"
              >
                <div className="w-3 h-3 rounded-sm bg-white" />
                Stop
              </button>
            </>
          )}

          {state === "stopped" && (
            <button
              onClick={resetRecording}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium
                transition-all duration-200 active:scale-95 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                />
              </svg>
              Record Again
            </button>
          )}
        </div>

        {/* audio playback — only after recording is done */}
        {state === "stopped" && audioUrl && (
          <div className="mt-6 pt-5 border-t border-zinc-800">
            <audio
              src={audioUrl}
              controls
              className="w-full h-10 [&::-webkit-media-controls-panel]:bg-zinc-800
                [&::-webkit-media-controls-current-time-display]:text-zinc-400
                [&::-webkit-media-controls-time-remaining-display]:text-zinc-400"
            />
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Ready to transcribe</span>
            </div>
          </div>
        )}
      </div>

      {/* error display */}
      {error && (
        <div className="mt-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}


function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
