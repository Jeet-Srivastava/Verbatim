<p align="center">
  <h1 align="center">🎬 Verbatim</h1>
  <p align="center">
    <strong>AI-Powered Video & Audio Transcription System</strong>
    <br />
    <em>Upload. Transcribe. Analyze. Download.</em>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js" alt="Next.js 14" />
    <img src="https://img.shields.io/badge/FastAPI-0.104+-009688?style=flat-square&logo=fastapi" alt="FastAPI" />
    <img src="https://img.shields.io/badge/Groq-Whisper%20%2B%20LLaMA-orange?style=flat-square" alt="Groq" />
    <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  </p>
</p>

---

## 📌 Overview

**Verbatim** is a full-stack media transcription and analysis system that takes a video or audio file, extracts and compresses the audio, transcribes it using Whisper, generates SRT subtitles, and produces AI-powered chapter markers with an executive summary — all in a single API call.

**Author:** Jeet Srivastava

---

## ⚡ The Approach

This project was built in 8 iterative phases, each adding a layer of functionality:

| Phase | What Was Built |
|-------|---------------|
| **Phase 1** | Monorepo scaffolding — `/frontend` (Next.js 14) and `/backend` (FastAPI) |
| **Phase 2** | Frontend UI shell — drag-and-drop upload, mic recording, glassmorphism design |
| **Phase 3** | Backend media processing — FFmpeg audio extraction + Opus compression |
| **Phase 4** | Whisper transcription via Groq — verbose_json format for timestamps → SRT |
| **Phase 5** | Meaningful Enhancement — LLaMA-powered chapter generation + executive summary |
| **Phase 6** | Frontend-backend integration — fetch calls, loading states, result storage |
| **Phase 7** | Masterpiece UI — split-layout video player + interactive chapters panel |
| **Phase 8** | Final polish — toast notifications, error boundaries, this README |

### Architecture

```
┌─────────────────┐         ┌──────────────────────────────────────┐
│   Next.js 14    │  POST   │           FastAPI Backend            │
│   Frontend      │ ──────► │                                      │
│                 │         │  1. Save upload (chunked streaming)   │
│  • Upload UI    │         │  2. FFmpeg → extract audio → .ogg    │
│  • Video Player │         │  3. Groq Whisper → transcribe        │
│  • Chapters     │  JSON   │  4. Groq LLaMA → chapters + summary  │
│  • SRT Download │ ◄────── │  5. Return text + SRT + analysis     │
└─────────────────┘         └──────────────────────────────────────┘
```

---

## 🧠 Key Technical Decisions

### Why Next.js 14 + FastAPI?

| Decision | Rationale |
|----------|-----------|
| **Next.js 14** for frontend | App Router, React Server Components, excellent DX with TypeScript. The upload page is a client component for interactivity while the landing page benefits from static generation. |
| **FastAPI** for backend | Native async support, automatic OpenAPI docs, and Pydantic validation. Python ecosystem gives us direct access to Groq SDK and subprocess for FFmpeg. |
| **Monorepo structure** | `/frontend` + `/backend` in one repo keeps deployment simple and avoids cross-repo dependency management for a project of this scale. |

### Why Groq for Ultra-Low Latency?

Groq runs Whisper and LLaMA on custom LPU (Language Processing Unit) hardware, delivering:

- **Whisper transcription**: ~10x faster than OpenAI's API — a 5-minute audio file transcribes in seconds, not minutes
- **LLaMA inference**: Sub-second response times for chapter generation
- **Combined pipeline**: An entire video can be processed end-to-end in under 60 seconds

This was a deliberate choice over alternatives:
- ❌ **OpenAI Whisper API** — slower, more expensive, rate-limited
- ❌ **Local Whisper** — requires GPU, complex deployment
- ❌ **AssemblyAI** — good but lacks the LLM integration we needed for chapters
- ✅ **Groq** — blazing fast inference for both STT and LLM in one SDK

### Why FFmpeg + Opus Compression?

Before sending audio to Groq, we compress it aggressively:

```bash
ffmpeg -i input.mp4 -vn -acodec libopus -b:a 32k -ar 16000 -ac 1 -application voip -y output.ogg
```

| Parameter | Why |
|-----------|-----|
| `-vn` | Strip video — we only need audio |
| `libopus` | Best speech codec at low bitrates |
| `32kbps` | Crystal clear for voice, tiny file size |
| `16kHz mono` | What Whisper internally resamples to anyway |
| `-application voip` | Tells Opus to optimize for voice clarity |

**Result**: A 500MB video → 2-8MB `.ogg` audio. This saves massive bandwidth on the Groq API call and stays well under the 25MB upload limit.

---

## 🌟 The Meaningful Enhancement: AI Chapter Generation

After Whisper produces the raw transcript, we send it to **Groq's LLaMA 3 (8B)** with a carefully crafted prompt that generates:

1. **Chapters** — 3-8 logical sections with precise timestamps and exactly 3-word titles
2. **Executive Summary** — A 2-3 sentence overview of the content

### How It Works

```
Whisper Output (segments with timestamps)
    │
    ▼
┌──────────────────────────────┐
│  Build timeline context from │
│  Whisper segment timestamps  │
│  (sampled ~25 segments)      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  LLaMA 3 (8B) via Groq      │
│  • JSON mode enforced        │
│  • Low temperature (0.3)     │
│  • Strict output schema      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Validation Layer            │
│  • Clamp timestamps          │
│  • Sort chronologically      │
│  • Generate fallbacks        │
└──────────────────────────────┘
```

### Graceful Degradation

The analysis is **non-blocking**. If LLaMA fails (rate limit, bad response, etc.), the endpoint still returns the full transcript and SRT. The `analysis_note` field explains what happened:

```json
{
  "transcription": { "text": "...", "srt": "..." },
  "analysis": {
    "chapters": [],
    "summary": "",
    "analysis_note": "Rate limit hit — try again in a minute"
  }
}
```

---

## 🖥️ Frontend Highlights

- **Drag & Drop Upload** with real-time file validation (type, size)
- **Live Audio Recording** via MediaRecorder API with waveform visualization
- **Futuristic Loading State** with multi-step progress indicator
- **Split-Layout Results View**: HTML5 video player (left) + interactive chapters panel (right)
- **Clickable Chapters**: Click a chapter → video seeks to that timestamp and auto-plays
- **SRT Download**: Client-side Blob generation, no server roundtrip
- **Toast Notifications**: Clean error/success toasts instead of browser alerts
- **Dark Mode Design**: zinc-900/950 base, cyan accent, glassmorphism panels

---

## 🚀 Quick Setup

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.10+
- **FFmpeg** — `brew install ffmpeg` (macOS) or `apt install ffmpeg` (Linux)
- **Groq API Key** — Free at [console.groq.com/keys](https://console.groq.com/keys)

### 1. Clone the Repository

```bash
git clone https://github.com/Jeet-Srivastava/Verbatim.git
cd Verbatim
```

### 2. Backend Setup

```bash
cd backend

# create virtual environment and install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# configure your API key
cp .env.example .env
# edit .env and paste your GROQ_API_KEY

# start the server
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# install dependencies
npm install

# start the dev server
npm run dev
```

### 4. Use It

1. Open [http://localhost:3000](http://localhost:3000)
2. Navigate to the Upload page
3. Drop a video/audio file or record from your mic
4. Click **Start Transcription**
5. Wait ~30-60 seconds for the full pipeline
6. View chapters, transcript, and download the SRT file

---

## 📁 Project Structure

```
Verbatim/
├── frontend/                    # Next.js 14 + Tailwind
│   ├── app/
│   │   ├── page.tsx             # Landing page
│   │   ├── upload/page.tsx      # Upload + Results UI
│   │   ├── layout.tsx           # Root layout
│   │   └── globals.css          # Design system
│   └── components/
│       ├── layout/Navbar.tsx    # Navigation
│       ├── ui/Tabs.tsx          # Tab switcher
│       ├── ui/Toast.tsx         # Toast notification system
│       ├── upload/DropZone.tsx   # Drag & drop upload
│       ├── upload/AudioRecorder.tsx  # Mic recording
│       └── results/ResultsView.tsx  # Split-layout results
│
├── backend/                     # FastAPI + Python
│   ├── main.py                  # API endpoints
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Environment template
│   └── utils/
│       ├── media_processing.py  # FFmpeg audio extraction
│       ├── transcription.py     # Groq Whisper integration
│       └── ai_analysis.py       # LLaMA chapter generation
│
└── README.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/health` | Load balancer health |
| `GET` | `/api/system/status` | FFmpeg + Groq API key status |
| `POST` | `/api/upload` | Lightweight file validation |
| `POST` | `/api/process` | **Full pipeline** — upload → FFmpeg → Whisper → LLaMA → response |

### `/api/process` Response Shape

```json
{
  "status": "completed",
  "original": {
    "filename": "interview.mp4",
    "content_type": "video/mp4",
    "size_bytes": 52428800,
    "size_human": "50.0 MB"
  },
  "processing": {
    "compressed_size_bytes": 1048576,
    "compressed_size_human": "1.0 MB",
    "compression_ratio": 50.0,
    "was_video": true
  },
  "transcription": {
    "text": "Full transcript text...",
    "srt": "1\n00:00:00,000 --> 00:00:05,320\nFirst subtitle...\n\n",
    "language": "en",
    "duration": 300.5,
    "segment_count": 45,
    "segments": [...]
  },
  "analysis": {
    "chapters": [
      { "start": 0, "end": 60.0, "title": "Introduction And Context" },
      { "start": 60.0, "end": 180.0, "title": "Main Discussion Points" },
      { "start": 180.0, "end": 300.5, "title": "Conclusion And Takeaways" }
    ],
    "summary": "The speaker discusses...",
    "analysis_note": null
  }
}
```

---

## 🛠️ Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14, React 18, TypeScript | App framework + type safety |
| Styling | Tailwind CSS 3.4 | Utility-first CSS with custom design tokens |
| Backend | FastAPI, Python 3.10+ | Async API server |
| Media | FFmpeg, libopus | Audio extraction + compression |
| STT | Groq Whisper Large v3 | Speech-to-text transcription |
| LLM | Groq LLaMA 3 8B | Chapter generation + summarization |
| Format | SRT (SubRip) | Industry-standard subtitle format |

---

<p align="center">
  Built with ☕ and determination by <strong>Jeet Srivastava</strong>
</p>
