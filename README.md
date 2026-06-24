# Verbatim 🎬

> Video Processing & Transcript System — built with Next.js 14, Tailwind CSS, FastAPI & Groq.

## Project Structure

```
Braahmam/
├── backend/              # FastAPI Python backend
│   ├── main.py           # API server entry point
│   └── requirements.txt  # Python dependencies
├── frontend/             # Next.js 14 frontend
│   ├── app/              # App Router pages
│   └── ...
├── .gitignore
└── README.md
```

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API will be live at `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App will be live at `http://localhost:3000`

## Tech Stack

| Layer    | Tech                    |
|----------|-------------------------|
| Frontend | Next.js 14, Tailwind CSS |
| Backend  | FastAPI, Python 3.10+   |
| AI/ML    | Groq API                |
| Video    | FFmpeg (subprocess)     |

## License

MIT
