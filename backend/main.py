"""
Verbatim Backend — FastAPI Server
==================================
Main entry point. Handles the full pipeline:

  Upload → Save → FFmpeg → Groq Whisper → LLaMA Analysis → Response

The response includes:
  - Raw transcript text
  - SRT subtitles with timestamps
  - AI-generated chapters (3-word titles)
  - Executive summary

Run it:
    uvicorn main:app --reload --port 8000
"""

import os
import uuid
import logging
import subprocess
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from utils.media_processing import (
    process_media_file,
    cleanup_file,
    MediaProcessingError,
)
from utils.transcription import (
    transcribe_audio,
    TranscriptionError,
)
from utils.ai_analysis import analyze_transcript

# load .env file if it exists — this is where the GROQ_API_KEY lives
# python-dotenv is already installed as a uvicorn[standard] dependency
load_dotenv()

# -----------------------------------------------
# Logging — structured so we can actually read it
# -----------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("verbatim.api")

# -----------------------------------------------
# App setup
# -----------------------------------------------
app = FastAPI(
    title="Verbatim API",
    description="Video Processing & Transcript System — backend API",
    version="0.4.0",
)

# -----------------------------------------------
# CORS — let the Next.js frontend talk to us
# -----------------------------------------------
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------
# File storage config
# -----------------------------------------------
UPLOAD_DIR = Path(__file__).parent / "uploads"
PROCESSED_DIR = Path(__file__).parent / "uploads" / "processed"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB

ALLOWED_VIDEO_TYPES = {
    "video/mp4", "video/webm", "video/quicktime",
    "video/x-matroska", "video/avi", "video/x-msvideo",
}
ALLOWED_AUDIO_TYPES = {
    "audio/mpeg", "audio/wav", "audio/ogg",
    "audio/webm", "audio/mp4", "audio/x-m4a",
}
ALLOWED_TYPES = ALLOWED_VIDEO_TYPES | ALLOWED_AUDIO_TYPES

# fallback: some clients (curl, older browsers) send wrong MIME types
# so we also check the file extension — belt and suspenders approach
ALLOWED_EXTENSIONS = {
    ".mp4", ".mkv", ".avi", ".mov", ".webm",
    ".mp3", ".wav", ".ogg", ".m4a", ".opus",
}


def _is_allowed_file(content_type: str | None, filename: str | None) -> bool:
    """Check if a file is allowed by MIME type OR extension."""
    if content_type and content_type in ALLOWED_TYPES:
        return True
    # fallback to extension check — handles cases where MIME is wrong/missing
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in ALLOWED_EXTENSIONS:
            return True
    return False


# ==============================================================
# ROUTES
# ==============================================================

@app.get("/")
async def root():
    """Heartbeat — is the server alive?"""
    return {
        "status": "alive",
        "message": "Verbatim API is running 🚀",
        "version": "0.4.0",
    }


@app.get("/health")
async def health_check():
    """Health check for monitoring tools."""
    return {"status": "healthy"}


# -----------------------------------------------
# /api/upload — lightweight file info (Phase 1)
# -----------------------------------------------
@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    """Accept a media file and return its info. No processing."""
    if not _is_allowed_file(file.content_type, file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Send a video or audio file."
        )

    return JSONResponse(
        status_code=200,
        content={
            "filename": file.filename,
            "content_type": file.content_type,
            "message": "File received — use /api/process for full pipeline.",
        },
    )


# -----------------------------------------------
# /api/process — THE main endpoint
# Full pipeline: upload → ffmpeg → whisper → llama → response
#
# This is what the frontend calls when the user
# clicks "Start Transcription". Everything happens
# in one shot: save, extract, transcribe, analyze.
# -----------------------------------------------
@app.post("/api/process")
async def process_upload(
    file: UploadFile = File(...),
    language: str | None = None,
):
    """
    Full media processing + transcription + analysis pipeline:
      1. Validate the uploaded file
      2. Save to disk (chunked, to handle large files)
      3. FFmpeg: extract audio, compress to .ogg
      4. Groq Whisper: transcribe with timestamps
      5. Parse timestamps into SRT format
      6. LLaMA: generate chapters + executive summary
      7. Return everything + clean up temp files
    """

    # --- validation ---
    if not _is_allowed_file(file.content_type, file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. "
                   f"We accept video (MP4, MKV, AVI, MOV, WebM) and audio (MP3, WAV, OGG, M4A)."
        )

    file_ext = Path(file.filename).suffix.lower() if file.filename else ".mp4"
    unique_name = f"{uuid.uuid4().hex[:12]}{file_ext}"
    upload_path = str(UPLOAD_DIR / unique_name)

    saved_path = None
    processed_path = None  # track the .ogg so we can clean it up too

    try:
        # --- step 1: save the upload to disk ---
        # chunked reads — we don't want a 500MB file sitting in RAM all at once
        logger.info(f"Receiving upload: {file.filename} ({file.content_type})")

        total_bytes = 0
        chunk_size = 1024 * 1024  # 1MB chunks

        with open(upload_path, "wb") as f:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break

                total_bytes += len(chunk)

                if total_bytes > MAX_UPLOAD_SIZE:
                    f.close()
                    cleanup_file(upload_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)}MB."
                    )

                f.write(chunk)

        saved_path = upload_path
        logger.info(f"Saved {total_bytes / (1024*1024):.1f}MB to {unique_name}")

        # --- step 2: extract and compress audio via ffmpeg ---
        logger.info("Starting ffmpeg processing...")
        media_result = process_media_file(
            input_path=upload_path,
            output_dir=str(PROCESSED_DIR),
            content_type=file.content_type,
        )
        processed_path = media_result["output_path"]

        logger.info(
            f"FFmpeg done: {_format_size(media_result['input_size'])} → "
            f"{_format_size(media_result['output_size'])} "
            f"({media_result['compression_ratio']}x compression)"
        )

        # --- step 3: send to Groq Whisper for transcription ---
        logger.info("Sending to Groq whisper-large-v3...")
        transcript_result = transcribe_audio(
            audio_path=processed_path,
            language=language,
        )

        logger.info(
            f"Transcription complete: {len(transcript_result['segments'])} segments, "
            f"language={transcript_result['language']}, "
            f"duration={transcript_result['duration']:.1f}s"
        )

        # --- step 4: AI analysis — chapters + summary ---
        # this is the "meaningful enhancement" — LLaMA reads the transcript
        # and generates intelligent chapter markers and an executive summary.
        #
        # IMPORTANT: this is wrapped in try/except on purpose.
        # if LLaMA fails (rate limit, bad response, whatever), we still
        # return the transcript. the analysis is a bonus, not a requirement.
        analysis_result = None
        try:
            logger.info("Sending transcript to LLaMA for chapter analysis...")
            analysis_result = analyze_transcript(
                transcript_text=transcript_result["text"],
                segments=transcript_result["segments"],
                duration=transcript_result["duration"],
                language=transcript_result["language"],
            )
            logger.info(
                f"Analysis done: {len(analysis_result.get('chapters', []))} chapters generated"
            )
        except Exception as e:
            # log it but don't crash — the transcript is the core deliverable
            logger.warning(f"LLaMA analysis failed (non-fatal): {e}")
            analysis_result = {
                "chapters": [],
                "summary": "",
                "analysis_note": f"Analysis unavailable: {str(e)}",
            }

        # --- step 5: build the response ---
        response = {
            "status": "completed",
            "original": {
                "filename": file.filename,
                "content_type": file.content_type,
                "size_bytes": media_result["input_size"],
                "size_human": _format_size(media_result["input_size"]),
            },
            "processing": {
                "compressed_size_bytes": media_result["output_size"],
                "compressed_size_human": _format_size(media_result["output_size"]),
                "compression_ratio": media_result["compression_ratio"],
                "was_video": media_result["was_video"],
            },
            "transcription": {
                "text": transcript_result["text"],
                "srt": transcript_result["srt"],
                "language": transcript_result["language"],
                "duration": transcript_result["duration"],
                "segment_count": len(transcript_result["segments"]),
                "segments": transcript_result["segments"],
            },
            "analysis": {
                "chapters": analysis_result.get("chapters", []),
                "summary": analysis_result.get("summary", ""),
                "analysis_note": analysis_result.get("analysis_note"),
            },
        }

        # --- step 6: clean up temp files ---
        # both the original upload and the processed .ogg
        # we have everything we need now, no point keeping audio around
        cleanup_file(upload_path)
        cleanup_file(processed_path)
        logger.info(f"Pipeline complete for {file.filename} ✓")

        return JSONResponse(status_code=200, content=response)

    except MediaProcessingError as e:
        # ffmpeg blew up
        if saved_path:
            cleanup_file(saved_path)
        if processed_path:
            cleanup_file(processed_path)
        logger.error(f"FFmpeg failed for {file.filename}: {e}")
        raise HTTPException(status_code=422, detail=f"Media processing failed: {str(e)}")

    except TranscriptionError as e:
        # Groq API failed — the audio was fine, whisper just didn't cooperate
        if saved_path:
            cleanup_file(saved_path)
        if processed_path:
            cleanup_file(processed_path)
        logger.error(f"Transcription failed for {file.filename}: {e}")
        raise HTTPException(status_code=422, detail=f"Transcription failed: {str(e)}")

    except HTTPException:
        raise

    except Exception as e:
        # something truly unexpected
        if saved_path:
            cleanup_file(saved_path)
        if processed_path:
            cleanup_file(processed_path)
        logger.error(f"Unexpected error for {file.filename}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Something went wrong. Check the server logs."
        )


# -----------------------------------------------
# System check — ffmpeg + Groq API key status
# -----------------------------------------------
@app.get("/api/system/status")
async def system_status():
    """
    Combined system check — tells the frontend everything it needs
    to know before the user tries to upload a file.
    Returns ffmpeg status and whether the Groq API key is configured.
    """
    # check ffmpeg
    ffmpeg_ok = False
    ffmpeg_version = None
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            ffmpeg_ok = True
            ffmpeg_version = result.stdout.split("\n")[0]
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # check Groq API key
    groq_configured = bool(os.environ.get("GROQ_API_KEY"))

    return {
        "ffmpeg": {
            "installed": ffmpeg_ok,
            "version": ffmpeg_version,
        },
        "groq": {
            "api_key_configured": groq_configured,
        },
        "ready": ffmpeg_ok and groq_configured,
    }


# keep the old endpoint for backward compat
@app.get("/api/system/check-ffmpeg")
async def check_ffmpeg():
    """Legacy ffmpeg check — use /api/system/status instead."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return {"ffmpeg_installed": True, "version": result.stdout.split("\n")[0]}
        return {"ffmpeg_installed": False, "error": "ffmpeg returned an error"}
    except FileNotFoundError:
        return {"ffmpeg_installed": False, "error": "ffmpeg is not installed"}
    except subprocess.TimeoutExpired:
        return {"ffmpeg_installed": False, "error": "ffmpeg check timed out"}


# -----------------------------------------------
# Helpers
# -----------------------------------------------
def _format_size(bytes_count: int) -> str:
    """Human-readable file size."""
    for unit in ["B", "KB", "MB", "GB"]:
        if bytes_count < 1024:
            return f"{bytes_count:.1f} {unit}"
        bytes_count /= 1024
    return f"{bytes_count:.1f} TB"


# -----------------------------------------------
# Direct run
# -----------------------------------------------
if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Verbatim API server...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
