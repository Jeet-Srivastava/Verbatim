"""
AI Analysis — Chapters & Summary via LLaMA
=============================================
After Whisper gives us the raw transcript, we send it to Groq's
llama-3.1-8b-instant model to generate two things:

  1. Chapters — logical sections of the content with timestamps
     and short 3-word titles (like YouTube chapters)
  2. Executive Summary — a concise overview of what was discussed

This is the "wow factor" feature. The transcript alone is useful,
but auto-generated chapters and a summary make it genuinely impressive.

Important design decision: if LLaMA fails for any reason (rate limit,
bad response, whatever), we DON'T fail the whole request. The transcript
is the core deliverable — the analysis is a bonus. We return what we
have and note that analysis failed.
"""

import json
import logging
import os

from groq import Groq

logger = logging.getLogger("verbatim.analysis")


class AnalysisError(Exception):
    """Raised when the LLaMA analysis fails. Non-fatal in the pipeline."""
    pass


def get_groq_client() -> Groq:
    """
    Get a Groq client instance. Same pattern as transcription.py,
    but kept separate so the modules don't depend on each other.
    If we ever need different API keys or configs per model, this
    separation makes it easy.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise AnalysisError("GROQ_API_KEY not set — can't run LLaMA analysis")
    return Groq(api_key=api_key)


def analyze_transcript(
    transcript_text: str,
    segments: list[dict],
    duration: float,
    language: str = "en",
) -> dict:
    """
    Send the transcript + segment data to LLaMA for intelligent analysis.
    
    We give LLaMA:
      - The full transcript text
      - The segment timestamps (so it can map chapters to real timecodes)
      - The total duration
    
    And we ask for:
      - chapters: array of { start, end, title } where title is exactly 3 words
      - summary: a 2-3 sentence executive summary
    
    Returns a dict with "chapters" and "summary" keys.
    If anything goes wrong, returns a fallback with an error note.
    """
    if not transcript_text or not transcript_text.strip():
        return _empty_analysis("Transcript is empty — nothing to analyze")

    # we need segment timestamps to give LLaMA context about timing
    # format them as a simple timeline the model can reference
    timeline = _build_timeline_context(segments, duration)

    # build the prompt — this is the most critical part
    # we need to be VERY specific about the output format
    # or LLaMA will freestyle and give us unparseable garbage
    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(transcript_text, timeline, duration, language)

    client = get_groq_client()

    logger.info(f"Sending transcript ({len(transcript_text)} chars) to LLaMA for analysis...")

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,        # low temp = more consistent, structured output
            max_tokens=2048,         # chapters + summary shouldn't need more than this
            response_format={"type": "json_object"},  # force JSON output mode
        )

        # extract the response content
        raw_content = response.choices[0].message.content
        if not raw_content:
            logger.warning("LLaMA returned an empty response")
            return _empty_analysis("Model returned empty response")

        # parse the JSON response
        analysis = _parse_llama_response(raw_content, duration)

        logger.info(
            f"Analysis complete: {len(analysis['chapters'])} chapters, "
            f"summary length={len(analysis['summary'])} chars"
        )

        return analysis

    except AnalysisError:
        raise
    except json.JSONDecodeError as e:
        logger.warning(f"LLaMA returned invalid JSON: {e}")
        return _empty_analysis(f"Model returned malformed JSON: {str(e)}")
    except Exception as e:
        error_msg = str(e)
        logger.warning(f"LLaMA analysis failed: {error_msg}")

        # check for rate limiting — common with free tier
        if "429" in error_msg or "rate" in error_msg.lower():
            return _empty_analysis("Rate limit hit — try again in a minute")
        
        return _empty_analysis(f"Analysis failed: {error_msg}")


# ==============================================================
# Prompt Engineering
# ==============================================================

def _build_system_prompt() -> str:
    """
    The system prompt sets LLaMA's role and output constraints.
    We're very strict about the JSON schema here because we need
    to parse this programmatically on the backend.
    """
    return """You are a professional media analyst. Your job is to analyze transcripts from videos and audio recordings.

You MUST respond with a valid JSON object containing exactly two keys:

1. "chapters" — an array of chapter objects, each with:
   - "start": number (start time in seconds, must be >= 0)
   - "end": number (end time in seconds, must be > start)
   - "title": string (EXACTLY 3 words, capitalized like a title)

2. "summary" — a string containing a concise executive summary (2-3 sentences max)

Rules for chapters:
- Create between 3 and 8 chapters depending on content length
- First chapter must start at 0
- Chapters must not overlap
- Chapters must be in chronological order
- Each title must be EXACTLY 3 words — no more, no less
- Titles should capture the key topic of that section

Rules for summary:
- Maximum 3 sentences
- Focus on the main topics discussed
- Be specific, not generic
- Write in the same language as the transcript

Example output format:
{
  "chapters": [
    {"start": 0, "end": 45.5, "title": "Introduction And Welcome"},
    {"start": 45.5, "end": 120.0, "title": "Main Topic Discussion"},
    {"start": 120.0, "end": 180.0, "title": "Closing And Summary"}
  ],
  "summary": "The speaker discusses modern web development practices. Key topics include React performance optimization and deployment strategies. The talk concludes with Q&A about best practices."
}"""


def _build_user_prompt(
    transcript: str,
    timeline: str,
    duration: float,
    language: str,
) -> str:
    """
    The user prompt provides the actual content for LLaMA to analyze.
    We include the timeline so it can place chapters at logical points.
    """
    # truncate very long transcripts — LLaMA has an 8K context window
    # and we need room for the system prompt + output
    max_transcript_length = 6000
    truncated = transcript[:max_transcript_length]
    if len(transcript) > max_transcript_length:
        truncated += "\n\n[...transcript truncated for analysis...]"

    return f"""Analyze this transcript and generate chapters with timestamps and an executive summary.

Total duration: {duration:.1f} seconds ({_format_duration(duration)})
Language: {language}

--- TIMELINE WITH TIMESTAMPS ---
{timeline}

--- FULL TRANSCRIPT ---
{truncated}

Remember: respond with valid JSON only. Each chapter title must be EXACTLY 3 words."""


# ==============================================================
# Response Parsing
# ==============================================================

def _parse_llama_response(raw_content: str, duration: float) -> dict:
    """
    Parse and validate LLaMA's JSON response.
    
    We do several sanity checks because LLMs are unpredictable:
      - Is it valid JSON?
      - Does it have the required keys?
      - Are the chapters properly ordered?
      - Are timestamps within the actual duration?
    
    If something's off, we fix it rather than rejecting the whole response.
    Better to return slightly imperfect chapters than no chapters at all.
    """
    data = json.loads(raw_content)

    # extract chapters — with fallbacks for slightly different formats
    chapters = data.get("chapters", [])
    summary = data.get("summary", "")

    # sometimes LLaMA wraps things in extra nesting
    if isinstance(summary, dict):
        summary = summary.get("text", str(summary))
    if isinstance(summary, list):
        summary = " ".join(str(s) for s in summary)

    # validate and clean up chapters
    cleaned_chapters = []
    for ch in chapters:
        if not isinstance(ch, dict):
            continue

        start = _safe_float(ch.get("start", 0))
        end = _safe_float(ch.get("end", 0))
        title = str(ch.get("title", "Untitled Section")).strip()

        # clamp timestamps to valid range
        start = max(0, min(start, duration))
        end = max(start + 0.1, min(end, duration))

        # ensure title isn't empty
        if not title:
            title = "Untitled Section Here"

        cleaned_chapters.append({
            "start": round(start, 1),
            "end": round(end, 1),
            "title": title,
        })

    # sort chapters by start time — just in case LLaMA scrambled them
    cleaned_chapters.sort(key=lambda c: c["start"])

    # if we got zero chapters, something went wrong — make a fallback
    if not cleaned_chapters:
        cleaned_chapters = _generate_fallback_chapters(duration)
        logger.warning("LLaMA produced no valid chapters — using fallback")

    return {
        "chapters": cleaned_chapters,
        "summary": summary.strip() if isinstance(summary, str) else str(summary),
    }


# ==============================================================
# Helper Functions
# ==============================================================

def _build_timeline_context(segments: list[dict], duration: float) -> str:
    """
    Build a simplified timeline from Whisper segments.
    This gives LLaMA a sense of what's being said at each timestamp
    so it can place chapter boundaries at natural breakpoints.
    
    We sample segments rather than sending all of them — LLaMA
    doesn't need 200 segments, just enough to understand the flow.
    """
    if not segments:
        return f"[0s - {duration:.0f}s]: (no segment data available)"

    lines = []
    # sample roughly 20-30 segments to keep context manageable
    step = max(1, len(segments) // 25)

    for i in range(0, len(segments), step):
        seg = segments[i]
        start = seg.get("start", 0)
        text_preview = seg.get("text", "")[:80]  # first 80 chars
        lines.append(f"[{start:.1f}s]: {text_preview}")

    return "\n".join(lines)


def _generate_fallback_chapters(duration: float) -> list[dict]:
    """
    If LLaMA completely fails to produce chapters, we generate
    basic evenly-spaced ones. Not intelligent, but better than nothing.
    """
    if duration <= 0:
        return [{"start": 0, "end": 1, "title": "Full Recording Content"}]

    # split into 3 equal parts
    third = round(duration / 3, 1)
    return [
        {"start": 0, "end": third, "title": "Opening Section Content"},
        {"start": third, "end": round(third * 2, 1), "title": "Middle Section Content"},
        {"start": round(third * 2, 1), "end": round(duration, 1), "title": "Closing Section Content"},
    ]


def _empty_analysis(reason: str) -> dict:
    """
    Return a valid but empty analysis result with an error note.
    This way the API response always has the same shape, making
    frontend code simpler — no need to check if analysis exists.
    """
    return {
        "chapters": [],
        "summary": "",
        "analysis_note": reason,
    }


def _safe_float(value) -> float:
    """Convert whatever LLaMA gave us to a float without crashing."""
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


def _format_duration(seconds: float) -> str:
    """Human-readable duration string — for the prompt context."""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    if mins > 0:
        return f"{mins}m {secs}s"
    return f"{secs}s"
