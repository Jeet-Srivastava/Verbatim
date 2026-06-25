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

**Verbatim** is an AI-Powered Media Transcription & Analysis system that takes a video or audio file, extracts and compresses the audio, transcribes it using Whisper, generates SRT subtitles, and produces AI-powered chapter markers with an executive summary — all in a single API call.

**Author:** Jeet Srivastava

---

## ⚡ The Approach

As an innovative engineer and researcher, my approach to solving the unstructured media problem was rooted in performance, scalability, and user experience. Instead of building a naive pipeline that simply passes data from point A to point B, I engineered a highly optimized architecture that treats media processing as a first-class citizen. 

I sought to eliminate the traditional bottlenecks of audio transcription—massive payload transfers and slow inference times—by moving compression to the edge of the backend and leveraging LPU (Language Processing Unit) acceleration for AI inference. This ensures that the system doesn't just work; it scales elegantly while providing instantaneous value to the user through a meticulously crafted, highly interactive UI.

### Architecture Flow

```
┌─────────────────┐         ┌──────────────────────────────────────┐
│   Next.js 14    │  POST   │           FastAPI Backend            │
│   Frontend      │ ──────► │                                      │
│                 │         │  1. Save upload (chunked streaming)  │
│  • Upload UI    │         │  2. FFmpeg → extract audio → .ogg    │
│  • Video Player │         │  3. Groq Whisper → transcribe        │
│  • Chapters     │  JSON   │  4. Groq LLaMA → chapters + summary  │
│  • SRT Download │ ◄────── │  5. Return text + SRT + analysis     │
└─────────────────┘         └──────────────────────────────────────┘
```

---

## 🧠 Key Technical Decisions

Driven by curiosity and a desire to build a system that is demonstrably better than standard wrappers, I made several critical architectural choices:

### 1. Ultra-Low Latency Inference (Groq)
I was curious about pushing the absolute boundaries of transcription speed. Rather than settling for traditional GPU-based inference like OpenAI's API, I integrated **Groq's LPU architecture**. This innovative decision reduces transcription times from minutes down to mere seconds. It allows an entire video to be processed end-to-end in under 60 seconds, providing an unparalleled user experience.

### 2. FFmpeg Audio Extraction & Opus Compression
To make the application significantly more robust, I implemented a pre-processing pipeline that intercepts massive video files (up to hundreds of MBs). Instead of forwarding these heavy files to the AI, the backend uses FFmpeg to strip the video track and heavily compress the audio using the `libopus` codec (32kbps mono). 
**Result:** A 500MB video becomes a 2MB `.ogg` file. This drastically cuts down the payload size before it ever hits the AI inference engine, eliminating timeout errors and saving massive bandwidth.

### 3. Next.js 14 + FastAPI Decoupling
I chose Next.js for a blazing-fast, reactive frontend and FastAPI for a highly concurrent, async Python backend. This decoupling allows the heavy computational tasks (FFmpeg) to run independently on the server without blocking the UI thread, enabling real-time loading states and smooth transitions on the client.

### 4. Meaningful Enhancement: AI Chapter Generation
To elevate the product beyond a simple utility, I integrated **LLaMA 3.1 (8B)** to generate intelligent chapter markers and executive summaries based on the Whisper output. I engineered this as a graceful fallback layer—if the LLM rate-limits or fails, the analysis is non-blocking. The user still instantly gets their transcription and SRT file without any application-breaking errors.

---

## 📊 Assumptions Made

From a market analyst and product strategy perspective, several key assumptions drove the architecture and Go-To-Market (GTM) readiness of Verbatim:

- **Time-to-Value is the Core Metric:** Users in media, journalism, and enterprise environments do not want to wait 10 minutes for a 5-minute video to transcribe. The assumption is that *speed is the primary competitive moat*, which wholly justified the integration of Groq's LPUs over standard, slower API endpoints.
- **Bandwidth is Expensive and Unpredictable:** We assumed that users will upload massive, unoptimized media files (e.g., 4K `.mp4` recordings from their phones). Therefore, server-side extraction of the audio layer—rather than client-side browser processing or direct API forwarding—was necessary to ensure a 100% success rate regardless of the user's network speed or hardware limitations.
- **Raw Text is Not Enough:** We hypothesized that users don't just want a wall of text; they want structured, actionable data. The assumption that users need immediate contextual navigation drove the development of the AI Chapter Generation feature. It transforms raw transcription data into a consumable, searchable product asset.
- **Professional Aesthetics Build Trust:** We assumed that enterprise and power users associate UI quality directly with backend reliability. The decision to implement a highly polished, interactive split-pane results view was made to establish immediate credibility and user trust upon the very first interaction.

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

<p align="center">
  Built with ☕ and determination by <strong>Jeet Srivastava</strong>
</p>
