"""
Verbatim Backend — FastAPI Server
==================================
Yeh hai apna main entry point for the backend.
Video upload aayega, transcript banega, aur response jayega frontend ko.

Run karne ke liye:
    uvicorn main:app --reload --port 8000
"""

import subprocess
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# -----------------------------------------------
# App initialize ho raha hai — yaha se sab shuru
# -----------------------------------------------
app = FastAPI(
    title="Verbatim API",
    description="Video Processing & Transcript System — backend API",
    version="0.1.0",
)

# -----------------------------------------------
# CORS setup — bina iske frontend request marega
# toh browser block kar dega, classic issue hai yeh
# -----------------------------------------------
# abhi ke liye sab origins allow hai (dev mode),
# production mein isko tighten karna padega
origins = [
    "http://localhost:3000",       # Next.js dev server
    "http://127.0.0.1:3000",
    "http://localhost:3001",       # just in case port change ho jaye
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],          # GET, POST, PUT, DELETE — sab allowed
    allow_headers=["*"],          # content-type, authorization — sab chalega
)


# -----------------------------------------------
# Health check route — sabse basic, server alive
# hai ya nahi check karne ke liye
# -----------------------------------------------
@app.get("/")
async def root():
    """Root endpoint — bas server ka heartbeat hai yeh."""
    return {
        "status": "alive",
        "message": "Verbatim API is running 🚀",
        "version": "0.1.0",
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint — monitoring tools ke liye useful.
    Agar yeh 200 de raha hai toh sab theek hai.
    """
    return {"status": "healthy"}


# -----------------------------------------------
# Video upload endpoint — yaha par video aayega
# frontend se, aur hum isko process karenge
# -----------------------------------------------
@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    """
    Video file accept karta hai.
    Abhi ke liye sirf file info return karega,
    baad mein transcript logic add karenge.
    """
    # basic validation — sirf video files allow
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(
            status_code=400,
            detail="Bhai sirf video file upload karo, yeh toh video nahi hai"
        )

    # file size check — 500MB se zyada nahi chahiye abhi
    # (actual content read nahi kar rahe, bas info de rahe hain)
    return JSONResponse(
        status_code=200,
        content={
            "filename": file.filename,
            "content_type": file.content_type,
            "message": "File received successfully — processing pipeline coming soon",
        },
    )


# -----------------------------------------------
# FFmpeg check — verify karo ki system mein
# ffmpeg installed hai ya nahi, warna video
# processing kaise hogi
# -----------------------------------------------
@app.get("/api/system/check-ffmpeg")
async def check_ffmpeg():
    """
    System check — ffmpeg available hai ya nahi.
    Video processing ke liye ffmpeg zaroori hai.
    """
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            text=True,
            timeout=10,  # 10 sec se zyada lage toh kuch gadbad hai
        )
        if result.returncode == 0:
            # pehli line mein version info hoti hai
            version_line = result.stdout.split("\n")[0]
            return {
                "ffmpeg_installed": True,
                "version": version_line,
            }
        else:
            return {"ffmpeg_installed": False, "error": "ffmpeg found but returned error"}
    except FileNotFoundError:
        # ffmpeg binary mili hi nahi system mein
        return {
            "ffmpeg_installed": False,
            "error": "ffmpeg is not installed — install it via: brew install ffmpeg",
        }
    except subprocess.TimeoutExpired:
        return {
            "ffmpeg_installed": False,
            "error": "ffmpeg check timed out — kuch toh issue hai system mein",
        }


# -----------------------------------------------
# Agar directly python main.py se run karna ho
# toh yeh block kaam aayega
# -----------------------------------------------
if __name__ == "__main__":
    import uvicorn

    # dev mode mein reload on — code change karo, server restart hoga apne aap
    print("🚀 Starting Verbatim API server...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
