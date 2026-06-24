/**
 * DropZone Component — Drag & Drop File Upload
 * ==============================================
 * This is the core upload component. It handles:
 * - Drag and drop (with visual feedback on hover)
 * - Click to select via hidden file input
 * - File validation (type, size)
 * - Preview with metadata display
 *
 * IMPORTANT perf note: We never read the file into memory.
 * The File object is just a reference — the browser streams it
 * from disk when we actually need it (upload or preview).
 * State only holds lightweight metadata to avoid re-render hell.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

// keep this separate from the File object — only the stuff we render
interface FileMetadata {
  name: string;
  size: number;         // bytes
  type: string;
  lastModified: number;
  previewUrl: string | null;  // object URL, not base64 — crucial for big files
}

// what file types we accept — both for the input and for validation
const ACCEPTED_TYPES = [
  "video/mp4", "video/webm", "video/quicktime", "video/x-matroska",
  "video/avi", "video/x-msvideo",
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4",
  "audio/x-m4a",
];

const ACCEPTED_EXTENSIONS = ".mp4,.mkv,.avi,.mov,.webm,.mp3,.wav,.ogg,.m4a";
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB — same as backend limit

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  onFileRemoved: () => void;
  disabled?: boolean;
}

export default function DropZone({ onFileSelected, onFileRemoved, disabled = false }: DropZoneProps) {
  const { toast } = useToast();
  const [fileMeta, setFileMeta] = useState<FileMetadata | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // the actual File reference — stored in a ref, NOT state
  // we dont want a 500MB blob causing re-renders, that'd be insane
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // drag counter prevents flicker — dragenter/leave fires on child elements too
  // so a simple boolean would toggle on/off erratically
  const dragCounter = useRef(0);

  // cleanup object URLs on unmount to prevent memory leaks
  // browsers usually handle this but let's be explicit about it
  useEffect(() => {
    return () => {
      if (fileMeta?.previewUrl) {
        URL.revokeObjectURL(fileMeta.previewUrl);
      }
    };
  }, [fileMeta?.previewUrl]);

  // validate the file before accepting it
  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type) && file.type !== "") {
      // some browsers don't set type for .mkv — check extension as fallback
      const ext = file.name.split(".").pop()?.toLowerCase();
      const validExtensions = ["mp4", "mkv", "avi", "mov", "webm", "mp3", "wav", "ogg", "m4a"];
      if (!ext || !validExtensions.includes(ext)) {
        return `Unsupported format: ${file.type || file.name}. Use video or audio files.`;
      }
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${formatSize(file.size)}. Max is 500MB.`;
    }
    if (file.size === 0) {
      return "This file appears to be empty.";
    }
    return null;
  }, []);

  // process the dropped/selected file
  const handleFile = useCallback((file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      // also fire a toast so the user sees it even if they scroll past the dropzone
      toast.error(validationError);
      return;
    }

    // revoke previous preview URL if there was one
    if (fileMeta?.previewUrl) {
      URL.revokeObjectURL(fileMeta.previewUrl);
    }

    // createObjectURL is the key here — it gives us a blob:// URL
    // that the browser can stream directly. No reading into memory.
    const isVideo = file.type.startsWith("video/");
    const previewUrl = isVideo ? URL.createObjectURL(file) : null;

    // store the lightweight metadata in state (triggers re-render)
    setFileMeta({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      previewUrl,
    });

    // store the heavy File object in ref (no re-render)
    fileRef.current = file;
    onFileSelected(file);
  }, [fileMeta?.previewUrl, onFileSelected, validateFile, toast]);

  // remove the current file
  const handleRemove = useCallback(() => {
    if (fileMeta?.previewUrl) {
      URL.revokeObjectURL(fileMeta.previewUrl);
    }
    setFileMeta(null);
    fileRef.current = null;
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onFileRemoved();
  }, [fileMeta?.previewUrl, onFileRemoved]);

  // --- drag event handlers ---
  // using the counter trick to handle nested element drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); // required — without this, drop won't fire. Classic gotcha.
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]); // only take the first file — one at a time
    }
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  // when there's already a file selected, show the preview card
  if (fileMeta) {
    return (
      <div className="animate-fade-in-scale">
        <FilePreviewCard
          meta={fileMeta}
          onRemove={handleRemove}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* the actual drop zone */}
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative w-full rounded-2xl p-10 md:p-14
          flex flex-col items-center justify-center
          cursor-pointer transition-all duration-300 ease-out
          min-h-[280px] group
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${isDragActive
            ? "glass border-cyan-500/50 glow-cyan scale-[1.01]"
            : "glass hover:border-cyan-500/20 hover:ring-glow-cyan"
          }
        `}
      >
        {/* animated background gradient that follows drag state */}
        <div className={`
          absolute inset-0 rounded-2xl transition-opacity duration-500
          bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5
          ${isDragActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"}
        `} />

        {/* content */}
        <div className="relative z-10 flex flex-col items-center">
          {/* upload icon — changes appearance on drag */}
          <div className={`
            mb-6 p-4 rounded-2xl transition-all duration-300
            ${isDragActive
              ? "bg-cyan-500/15 scale-110"
              : "bg-zinc-800/60 group-hover:bg-cyan-500/10"
            }
          `}>
            <svg
              className={`w-10 h-10 transition-colors duration-300 ${
                isDragActive ? "text-cyan-400" : "text-zinc-500 group-hover:text-cyan-400/70"
              }`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>

          <h3 className={`text-lg font-semibold mb-1.5 transition-colors ${
            isDragActive ? "text-cyan-300" : "text-zinc-300"
          }`}>
            {isDragActive ? "Drop it right here" : "Drag & drop your file"}
          </h3>

          <p className="text-sm text-zinc-500 mb-5">
            or click anywhere to browse
          </p>

          {/* the browse button — just a visual hint, whole area is clickable */}
          <button
            type="button"
            className="px-5 py-2.5 text-sm font-medium rounded-xl
              bg-cyan-600/20 text-cyan-400 border border-cyan-500/20
              hover:bg-cyan-600/30 hover:border-cyan-500/40
              transition-all duration-200 active:scale-95"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Browse Files
          </button>

          <p className="text-xs text-zinc-600 mt-4">
            MP4, MKV, AVI, MOV, MP3, WAV — up to 500MB
          </p>
        </div>

        {/* hidden file input — we trigger it programmatically */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* error message */}
      {error && (
        <div className="mt-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}


/**
 * FilePreviewCard — shows after a file is selected
 * Displays metadata + video thumbnail if applicable
 */
function FilePreviewCard({ meta, onRemove }: { meta: FileMetadata; onRemove: () => void }) {
  const isVideo = meta.type.startsWith("video/");
  const isAudio = meta.type.startsWith("audio/");

  return (
    <div className="glass-strong rounded-2xl overflow-hidden">
      {/* video preview — only if it's a video file */}
      {isVideo && meta.previewUrl && (
        <div className="relative bg-black/40">
          <video
            src={meta.previewUrl}
            className="w-full max-h-[240px] object-contain"
            muted
            playsInline
            // autoplay a short preview loop — just the first few seconds
            onLoadedData={(e) => {
              const video = e.currentTarget;
              video.currentTime = 0;
              video.play().catch(() => {});
              setTimeout(() => video.pause(), 3000);
            }}
          />
          {/* subtle overlay gradient at the bottom */}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-zinc-900/80 to-transparent" />
        </div>
      )}

      {/* audio icon — for audio files */}
      {isAudio && (
        <div className="flex items-center justify-center py-8 bg-zinc-900/40">
          <div className="p-4 rounded-2xl bg-cyan-500/10">
            <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
              />
            </svg>
          </div>
        </div>
      )}

      {/* file info bar */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-200 truncate">{meta.name}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-zinc-500">{formatSize(meta.size)}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-xs text-zinc-500">{getFileTypeLabel(meta.type, meta.name)}</span>
            </div>
          </div>

          {/* remove button */}
          <button
            onClick={onRemove}
            className="p-2 rounded-lg text-zinc-500 hover:text-red-400
              hover:bg-red-500/10 transition-all duration-200"
            title="Remove file"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ready indicator */}
        <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/15">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">Ready to transcribe</span>
        </div>
      </div>
    </div>
  );
}


// --- Utility functions ---

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function getFileTypeLabel(type: string, name: string): string {
  const ext = name.split(".").pop()?.toUpperCase();
  if (type.startsWith("video/")) return `${ext} Video`;
  if (type.startsWith("audio/")) return `${ext} Audio`;
  return ext || "Unknown";
}
