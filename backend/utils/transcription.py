"""
Transcription Service — Groq Whisper Integration
===================================================
This module handles sending audio to Groq's whisper-large-v3 model
and converting the response into usable formats (raw text + SRT).

The flow is simple:
  1. Open the .ogg file
  2. Send it to Groq's transcription API with verbose_json format
  3. Get back segments with timestamps
  4. Parse those segments into standard .SRT subtitle format

We request verbose_json specifically because it gives us per-segment
timestamps (start/end in seconds). The regular response only gives
us the text — no timing info, which means no SRT generation.

SRT Format Refresher:
  1
  00:00:00,000 --> 00:00:05,320
  First line of dialogue.

  2
  00:00:05,320 --> 00:00:10,500
  Second line of dialogue.

Each entry = sequence number + timecodes + text + blank line.
Timecodes use HH:MM:SS,mmm (comma, NOT period — this is important).
"""

import os
import logging
from pathlib import Path

from groq import Groq

logger = logging.getLogger("verbatim.transcription")


class TranscriptionError(Exception):
    """
    Raised when the Groq API call fails or returns garbage.
    We catch this in the endpoint to send a proper error response
    instead of dumping a stack trace on the user.
    """
    pass


def get_groq_client() -> Groq:
    """
    Initialize the Groq client. It reads the API key from the
    GROQ_API_KEY environment variable automatically.
    
    If you haven't set it yet, you'll get a clear error here
    instead of a confusing one deep in the API call.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise TranscriptionError(
            "GROQ_API_KEY is not set. Get one from https://console.groq.com/keys "
            "and add it to your .env file or export it in your shell."
        )
    return Groq(api_key=api_key)


def transcribe_audio(
    audio_path: str,
    language: str | None = None,
    prompt: str | None = None,
) -> dict:
    """
    Send an audio file to Groq's whisper-large-v3 for transcription.
    
    We use verbose_json response format because:
      - It gives us per-segment timestamps (start, end in seconds)
      - We need those timestamps to generate SRT subtitles
      - The regular "json" format only returns the full text, no timing
    
    Args:
        audio_path:  path to the .ogg (or any audio) file
        language:    optional ISO 639-1 code (e.g., "en", "hi", "es")
                     if None, Whisper auto-detects the language
        prompt:      optional context hint for the model — useful if you
                     know the topic or have specific terminology
    
    Returns:
        dict with keys:
          - text: full transcript as a single string
          - segments: list of segments with timestamps
          - language: detected/specified language
          - duration: total audio duration in seconds
          - srt: formatted SRT subtitle string
    """
    if not os.path.exists(audio_path):
        raise TranscriptionError(f"Audio file not found: {audio_path}")

    file_size = os.path.getsize(audio_path)
    if file_size == 0:
        raise TranscriptionError("Audio file is empty — nothing to transcribe")

    # Groq has a 25MB limit for audio files
    # our .ogg files should be well under this after compression
    max_groq_size = 25 * 1024 * 1024
    if file_size > max_groq_size:
        raise TranscriptionError(
            f"Audio file is {file_size / (1024*1024):.1f}MB — Groq's limit is 25MB. "
            "Try a lower bitrate or split the file."
        )

    client = get_groq_client()

    logger.info(
        f"Sending {Path(audio_path).name} ({file_size / 1024:.0f}KB) "
        f"to Groq whisper-large-v3..."
    )

    try:
        # open the audio file and send it to Groq
        # verbose_json gives us the segment-level timestamps we need for SRT
        with open(audio_path, "rb") as audio_file:
            # build the kwargs dict — only include optional params if they're set
            kwargs = {
                "file": (Path(audio_path).name, audio_file),
                "model": "whisper-large-v3",
                "response_format": "verbose_json",
            }
            if language:
                kwargs["language"] = language
            if prompt:
                kwargs["prompt"] = prompt

            transcription = client.audio.transcriptions.create(**kwargs)

        # the response could be a Pydantic model or a dict depending on SDK version
        # let's handle both gracefully
        if isinstance(transcription, dict):
            raw_text = transcription.get("text", "")
            raw_segments = transcription.get("segments", [])
            detected_language = transcription.get("language", language or "unknown")
            duration = transcription.get("duration", 0.0)
        else:
            raw_text = transcription.text or ""
            raw_segments = transcription.segments if hasattr(transcription, "segments") else []
            detected_language = (
                transcription.language
                if hasattr(transcription, "language")
                else language or "unknown"
            )
            duration = (
                transcription.duration
                if hasattr(transcription, "duration")
                else 0.0
            )

        segments = []

        # extract segment data — each segment has start, end, and text
        if raw_segments:
            for seg in raw_segments:
                # Handle both dict and object style segments
                if isinstance(seg, dict):
                    seg_id = seg.get("id", len(segments))
                    seg_start = seg.get("start", 0.0)
                    seg_end = seg.get("end", 0.0)
                    seg_text = seg.get("text", "").strip()
                else:
                    seg_id = seg.id if hasattr(seg, "id") else len(segments)
                    seg_start = seg.start
                    seg_end = seg.end
                    seg_text = seg.text.strip()

                segments.append({
                    "id": seg_id,
                    "start": seg_start,
                    "end": seg_end,
                    "text": seg_text,
                })

        # generate the SRT string from segments
        srt_content = segments_to_srt(segments)

        logger.info(
            f"Transcription complete: {len(segments)} segments, "
            f"{len(raw_text)} chars, language={detected_language}"
        )

        return {
            "text": raw_text,
            "segments": segments,
            "language": detected_language,
            "duration": duration,
            "srt": srt_content,
        }

    except TranscriptionError:
        # re-raise our own errors as-is
        raise
    except Exception as e:
        # wrap any Groq SDK errors in our custom exception
        error_msg = str(e)
        logger.error(f"Groq API error: {error_msg}", exc_info=True)

        # check for common error patterns and give helpful messages
        if "401" in error_msg or "authentication" in error_msg.lower():
            raise TranscriptionError(
                "Groq API key is invalid or expired. "
                "Check your GROQ_API_KEY env variable."
            )
        elif "429" in error_msg or "rate" in error_msg.lower():
            raise TranscriptionError(
                "Groq rate limit hit — too many requests. "
                "Wait a minute and try again."
            )
        elif "413" in error_msg or "too large" in error_msg.lower():
            raise TranscriptionError(
                "Audio file is too large for Groq. Max is 25MB."
            )
        else:
            raise TranscriptionError(f"Transcription failed: {error_msg}")


# ==============================================================
# SRT Generation
# ==============================================================

def segments_to_srt(segments: list[dict]) -> str:
    """
    Convert a list of timestamp segments into a valid .SRT string.
    
    SRT format rules:
      - Sequence numbers start at 1 (not 0)
      - Timecodes are HH:MM:SS,mmm (comma separator, NOT period)
      - Each entry ends with a blank line
      - No blank line after the last entry (but most players tolerate it)
    
    Each segment dict needs: { "start": float, "end": float, "text": str }
    """
    if not segments:
        return ""

    srt_lines = []

    for index, segment in enumerate(segments, start=1):
        start_time = segment.get("start", 0.0)
        end_time = segment.get("end", 0.0)
        text = segment.get("text", "").strip()

        # skip empty segments — Whisper sometimes produces these
        # when there's silence or noise
        if not text:
            continue

        # convert float seconds to SRT timecode format
        start_tc = _seconds_to_srt_timecode(start_time)
        end_tc = _seconds_to_srt_timecode(end_time)

        # build the SRT entry:
        #   1
        #   00:00:00,000 --> 00:00:05,320
        #   The text goes here.
        #
        srt_lines.append(f"{index}")
        srt_lines.append(f"{start_tc} --> {end_tc}")
        srt_lines.append(text)
        srt_lines.append("")  # blank line separator between entries

    return "\n".join(srt_lines)


def _seconds_to_srt_timecode(total_seconds: float) -> str:
    """
    Convert a float timestamp (seconds) to SRT timecode format.
    
    The math, step by step:
      Input:  125.84 seconds
    
      1. hours   = floor(125.84 / 3600)                     = 0
      2. leftover = 125.84 % 3600                            = 125.84
      3. minutes = floor(125.84 / 60)                        = 2
      4. seconds = floor(125.84 % 60)                        = 5
      5. millis  = round((125.84 - floor(125.84)) * 1000)    = 840
    
      Output: "00:02:05,840"
    
    IMPORTANT: SRT uses a COMMA between seconds and milliseconds,
    not a period. This is a really common mistake that breaks some
    subtitle parsers. Don't change the comma to a dot.
    """
    # clamp negative values — shouldn't happen but just in case
    if total_seconds < 0:
        total_seconds = 0.0

    # step 1: pull out hours
    hours = int(total_seconds // 3600)

    # step 2: what's left after removing hours
    remainder = total_seconds % 3600

    # step 3: pull out minutes from the remainder
    minutes = int(remainder // 60)

    # step 4: pull out whole seconds
    seconds = int(remainder % 60)

    # step 5: get milliseconds from the fractional part
    # we use round() to avoid floating point weirdness like 839.9999 → 839
    milliseconds = round((total_seconds - int(total_seconds)) * 1000)

    # edge case: rounding can push millis to 1000
    # e.g., 5.9999 seconds → millis would be 1000
    if milliseconds >= 1000:
        milliseconds = 0
        seconds += 1
        if seconds >= 60:
            seconds = 0
            minutes += 1
            if minutes >= 60:
                minutes = 0
                hours += 1

    # format with zero-padding: HH:MM:SS,mmm
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def format_transcript_for_display(text: str, max_line_length: int = 80) -> str:
    """
    Optional utility — break a long transcript into readable paragraphs.
    Useful if the frontend wants to display the text in a nice format
    without it being one giant wall of text.
    """
    if not text:
        return ""

    words = text.split()
    lines = []
    current_line = []
    current_length = 0

    for word in words:
        if current_length + len(word) + 1 > max_line_length and current_line:
            lines.append(" ".join(current_line))
            current_line = [word]
            current_length = len(word)
        else:
            current_line.append(word)
            current_length += len(word) + 1

    if current_line:
        lines.append(" ".join(current_line))

    return "\n".join(lines)
