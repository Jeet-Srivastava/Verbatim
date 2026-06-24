"""
Media Processing Utilities
============================
All the heavy lifting for audio extraction and format conversion lives here.
We lean on ffmpeg for everything — it's the Swiss Army knife of media processing
and there's no reason to reinvent that wheel.

The core idea is simple:
  1. Got a video? Strip out the video stream, keep only audio.
  2. Got audio already? Cool, skip extraction.
  3. Either way, convert to compressed .ogg (Opus codec) before sending
     to the transcription API. This saves a TON of bandwidth.

Why .ogg with Opus?
  - Opus at 32kbps for voice is basically indistinguishable from the original
  - A 1-hour video that's 500MB becomes a ~14MB audio file
  - Whisper-based models internally resample to 16kHz mono anyway,
    so there's zero quality loss in doing it ourselves first
"""

import os
import subprocess
import logging
from pathlib import Path

logger = logging.getLogger("verbatim.media")

# file extensions we consider as "already audio" — no video stripping needed
AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".wma", ".opus", ".webm"}
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".ts", ".m4v"}

# mime type prefixes for quick checks
AUDIO_MIME_PREFIX = "audio/"
VIDEO_MIME_PREFIX = "video/"


class MediaProcessingError(Exception):
    """
    Custom exception for when ffmpeg blows up or something goes sideways
    during processing. We want to catch these specifically in the endpoint
    so we can return a helpful error message instead of a generic 500.
    """
    pass


def is_audio_file(file_path: str, content_type: str | None = None) -> bool:
    """
    Quick check — is this file already audio?
    
    We check both the extension AND the content type because sometimes
    one or the other is unreliable. For example, .webm can be either
    video or audio, so we need the mime type to disambiguate.
    """
    ext = Path(file_path).suffix.lower()

    # if the content type clearly says audio, trust it
    if content_type and content_type.startswith(AUDIO_MIME_PREFIX):
        return True

    # if the content type says video, it's video regardless of extension
    if content_type and content_type.startswith(VIDEO_MIME_PREFIX):
        return False

    # fall back to extension-based check
    return ext in AUDIO_EXTENSIONS


def check_ffmpeg_installed() -> bool:
    """
    Quick sanity check — is ffmpeg actually available on this system?
    We call this before attempting any processing so we can fail fast
    with a clear error instead of a cryptic FileNotFoundError.
    """
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def get_media_info(file_path: str) -> dict:
    """
    Use ffprobe (ships with ffmpeg) to get media file metadata.
    Returns duration, codec info, format details — the stuff we need
    to make smart decisions about processing.
    
    We use JSON output format because parsing ffprobe's text output
    is a nightmare — trust me, don't go down that road.
    """
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "quiet",              # shush, we don't want warnings in stdout
                "-print_format", "json",    # give us structured data, not wall of text
                "-show_format",             # file-level info (duration, bitrate, etc.)
                "-show_streams",            # per-stream info (audio channels, codec, etc.)
                file_path,
            ],
            capture_output=True,
            text=True,
            timeout=30,  # 30 seconds should be plenty even for huge files
        )

        if result.returncode != 0:
            logger.warning(f"ffprobe returned non-zero for {file_path}: {result.stderr}")
            return {}

        import json
        return json.loads(result.stdout)

    except (FileNotFoundError, subprocess.TimeoutExpired, Exception) as e:
        logger.error(f"ffprobe failed for {file_path}: {e}")
        return {}


def extract_audio_to_ogg(
    input_path: str,
    output_path: str | None = None,
    bitrate: str = "32k",
    sample_rate: int = 16000,
) -> str:
    """
    The main workhorse function — takes any media file and produces
    a compressed .ogg (Opus) audio file optimized for speech-to-text.

    Here's the full breakdown of what ffmpeg does:
    
    -i input       → read from this file
    -vn            → drop the video stream entirely (huge size savings)
    -acodec libopus → use Opus codec (best speech compression on the planet)
    -b:a 32k       → 32 kbps bitrate (more than enough for clear speech)
    -ar 16000      → 16kHz sample rate (Whisper resamples to this anyway)
    -ac 1          → mono (speech doesn't need stereo, cuts size in half)
    -application voip → tell Opus to optimize for voice, not music
    -y             → overwrite output without asking (non-interactive mode)

    Args:
        input_path:  path to the source video/audio file
        output_path: where to save the .ogg file (auto-generated if None)
        bitrate:     audio bitrate (default "32k" — sweet spot for speech)
        sample_rate: sample rate in Hz (default 16000 — what STT models want)

    Returns:
        path to the output .ogg file

    Raises:
        MediaProcessingError: if ffmpeg fails or input file doesn't exist
    """
    # sanity checks — fail fast with clear messages
    if not os.path.exists(input_path):
        raise MediaProcessingError(f"Input file not found: {input_path}")

    if not check_ffmpeg_installed():
        raise MediaProcessingError(
            "ffmpeg is not installed. Install it with: brew install ffmpeg (macOS) "
            "or apt-get install ffmpeg (Linux)"
        )

    # auto-generate output path if not provided
    # put it right next to the input file with an _audio.ogg suffix
    if output_path is None:
        input_stem = Path(input_path).stem
        input_dir = Path(input_path).parent
        output_path = str(input_dir / f"{input_stem}_audio.ogg")

    # build the ffmpeg command
    # each argument is on its own line because debugging long CLI commands
    # that are all on one line is pure suffering
    cmd = [
        "ffmpeg",
        "-i", input_path,          # input file

        "-vn",                     # strip video — we only care about audio

        "-acodec", "libopus",      # Opus codec — king of speech compression
        "-b:a", bitrate,           # 32kbps is the sweet spot for voice
        "-ar", str(sample_rate),   # 16kHz — what Whisper expects internally
        "-ac", "1",                # mono — speech doesn't benefit from stereo

        "-application", "voip",    # tell Opus this is voice, not music
                                   # this makes it prioritize speech clarity
                                   # over frequency response

        "-y",                      # overwrite without asking — we're in a pipeline,
                                   # nobody's sitting there to type "y"

        output_path,               # where the output goes
    ]

    logger.info(f"Running ffmpeg: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout — should handle even large files
                          # if your file takes longer than 5 min to process,
                          # something is probably wrong anyway
        )

        if result.returncode != 0:
            # ffmpeg prints errors to stderr — grab that for debugging
            error_msg = result.stderr.strip().split("\n")[-1] if result.stderr else "Unknown error"
            logger.error(f"ffmpeg failed: {error_msg}")
            raise MediaProcessingError(f"ffmpeg processing failed: {error_msg}")

        # verify the output file actually exists and isn't empty
        if not os.path.exists(output_path):
            raise MediaProcessingError("ffmpeg ran but output file wasn't created — weird")

        output_size = os.path.getsize(output_path)
        if output_size == 0:
            os.remove(output_path)  # clean up the empty file
            raise MediaProcessingError("ffmpeg produced an empty output file — input might be corrupted")

        # log the compression ratio — satisfying to see
        input_size = os.path.getsize(input_path)
        ratio = input_size / output_size if output_size > 0 else 0
        logger.info(
            f"Audio extraction complete: {_format_size(input_size)} → {_format_size(output_size)} "
            f"({ratio:.1f}x compression)"
        )

        return output_path

    except subprocess.TimeoutExpired:
        # kill the ffmpeg process if it's hanging
        raise MediaProcessingError(
            "ffmpeg timed out after 5 minutes — file might be too large or corrupted"
        )
    except FileNotFoundError:
        raise MediaProcessingError(
            "ffmpeg binary not found — make sure it's installed and in your PATH"
        )


def convert_audio_to_ogg(
    input_path: str,
    output_path: str | None = None,
    bitrate: str = "32k",
    sample_rate: int = 16000,
) -> str:
    """
    For files that are already audio — we skip the -vn flag since there's
    no video to strip, but we still re-encode to Opus for consistent format
    and compression.

    This is basically the same as extract_audio_to_ogg but semantically
    separate. If the input is already a .ogg at the right bitrate,
    we could skip this entirely, but re-encoding is fast for audio-only
    files and guarantees consistent output.
    """
    # we can just call the extraction function — it works on audio too
    # the -vn flag is harmless on audio-only files (ffmpeg just ignores it)
    return extract_audio_to_ogg(input_path, output_path, bitrate, sample_rate)


def process_media_file(
    input_path: str,
    output_dir: str | None = None,
    content_type: str | None = None,
) -> dict:
    """
    High-level processing function — the one the API endpoint calls.
    
    Figures out what kind of file it is, processes it accordingly,
    and returns a dict with all the info the caller needs.

    Returns:
        {
            "input_path": str,
            "output_path": str,
            "input_size": int,
            "output_size": int,
            "compression_ratio": float,
            "was_video": bool,
            "media_info": dict,
        }
    """
    if not os.path.exists(input_path):
        raise MediaProcessingError(f"Input file not found: {input_path}")

    # figure out where to put the output
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        output_filename = f"{Path(input_path).stem}_processed.ogg"
        output_path = os.path.join(output_dir, output_filename)
    else:
        output_path = None  # let the conversion function auto-generate it

    # grab media info before processing — useful for logging and response
    media_info = get_media_info(input_path)

    # decide: is this a video we need to strip, or audio we just compress?
    was_video = not is_audio_file(input_path, content_type)

    if was_video:
        logger.info(f"Video detected — extracting audio from: {Path(input_path).name}")
        result_path = extract_audio_to_ogg(input_path, output_path)
    else:
        logger.info(f"Audio detected — compressing: {Path(input_path).name}")
        result_path = convert_audio_to_ogg(input_path, output_path)

    input_size = os.path.getsize(input_path)
    output_size = os.path.getsize(result_path)

    return {
        "input_path": input_path,
        "output_path": result_path,
        "input_size": input_size,
        "output_size": output_size,
        "compression_ratio": round(input_size / output_size, 1) if output_size > 0 else 0,
        "was_video": was_video,
        "media_info": media_info,
    }


def cleanup_file(file_path: str) -> None:
    """
    Delete a temporary file. Wrapped in a try/except because we don't
    want a cleanup failure to crash the whole request — log it and move on.
    """
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.debug(f"Cleaned up: {file_path}")
    except OSError as e:
        logger.warning(f"Failed to clean up {file_path}: {e}")


# --- internal helpers ---

def _format_size(bytes_count: int) -> str:
    """Human-readable file size — just for logging, not for the API response."""
    for unit in ["B", "KB", "MB", "GB"]:
        if bytes_count < 1024:
            return f"{bytes_count:.1f}{unit}"
        bytes_count /= 1024
    return f"{bytes_count:.1f}TB"
