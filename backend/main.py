"""
FastAPI backend for the speaking-improvement Chrome extension.
Loads env with python-dotenv; health check at GET /health.
"""
from dotenv import load_dotenv

load_dotenv()

import os
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai

app = FastAPI(title="Speaking Improvement API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(chrome-extension://.*|http://localhost:.*|https://localhost:.*)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


class AnalyzeRequest(BaseModel):
    transcript: str
    duration_seconds: float


@app.get("/health")
def health():
    """Verify the server is running."""
    return {"ok": True}


@app.post("/quick-feedback")
async def quick_feedback(request: AnalyzeRequest):
    """Provide quick 1-2 sentence coaching tips based on current metrics."""
    
    transcript = request.transcript
    duration_seconds = request.duration_seconds
    
    if duration_seconds <= 0:
        raise HTTPException(status_code=400, detail="duration_seconds must be greater than 0")
    
    filler_patterns = {
        "um": r"\bum\b",
        "uh": r"\bu+h+\b",
        "like": r"\blike\b",
        "you know": r"\byou know\b",
        "basically": r"\bbasically\b",
        "actually": r"\bactually\b",
        "literally": r"\bliterally\b",
        "sort of": r"\bsort of\b",
        "kind of": r"\bkind of\b",
        "i mean": r"\bi mean\b",
    }
    
    total_filler_count = 0
    transcript_lower = transcript.lower()
    
    for filler, pattern in filler_patterns.items():
        count = len(re.findall(pattern, transcript_lower))
        total_filler_count += count
    
    words = transcript.split()
    word_count = len(words)
    duration_minutes = duration_seconds / 60
    wpm = round(word_count / duration_minutes, 2) if duration_minutes > 0 else 0
    
    fillers_per_minute = total_filler_count / duration_minutes if duration_minutes > 0 else 0
    
    quick_tip = ""
    severity = "good"
    
    if fillers_per_minute > 10:
        quick_tip = "Too many filler words! Pause instead of saying 'um'."
        severity = "alert"
    elif fillers_per_minute > 5:
        quick_tip = "You're using filler words. Take a breath before speaking."
        severity = "warning"
    elif wpm > 160:
        quick_tip = "Slow down! You're speaking too fast."
        severity = "warning"
    elif wpm < 120:
        quick_tip = "Try speaking a bit faster to maintain energy."
        severity = "warning"
    else:
        quick_tip = "Great pace! Keep it up."
        severity = "good"
    
    return {
        "quick_tip": quick_tip,
        "wpm": wpm,
        "filler_count": total_filler_count,
        "severity": severity
    }


@app.post("/analyze")
async def analyze_speech(request: AnalyzeRequest):
    """Analyze speech transcript for filler words, WPM, and get AI feedback."""
    
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not configured. Please set it in the .env file."
        )
    
    transcript = request.transcript
    duration_seconds = request.duration_seconds
    
    if duration_seconds <= 0:
        raise HTTPException(status_code=400, detail="duration_seconds must be greater than 0")
    
    filler_patterns = {
        "um": r"\bum\b",
        "uh": r"\bu+h+\b",
        "like": r"\blike\b",
        "you know": r"\byou know\b",
        "basically": r"\bbasically\b",
        "actually": r"\bactually\b",
        "literally": r"\bliterally\b",
        "sort of": r"\bsort of\b",
        "kind of": r"\bkind of\b",
        "i mean": r"\bi mean\b",
    }
    
    filler_words = {}
    total_filler_count = 0
    transcript_lower = transcript.lower()
    
    for filler, pattern in filler_patterns.items():
        count = len(re.findall(pattern, transcript_lower))
        filler_words[filler] = count
        total_filler_count += count
    
    words = transcript.split()
    word_count = len(words)
    duration_minutes = duration_seconds / 60
    wpm = round(word_count / duration_minutes, 2) if duration_minutes > 0 else 0
    
    prompt = f"""Analyze the following speech transcript and provide feedback on:

1. Speaking pace: Evaluate if the pace is too fast, too slow, or appropriate (WPM: {wpm})
2. Clarity and coherence: Assess how clear and well-structured the speech is
3. Professional language usage: Evaluate the professionalism and appropriateness of language
4. Provide 3-5 specific, actionable suggestions for improvement

Transcript:
"{transcript}"

Filler word count: {total_filler_count}

Please provide a comprehensive but concise analysis (2-3 paragraphs) followed by numbered actionable suggestions."""

    try:
        model = genai.GenerativeModel("gemini-3-flash-preview")
        response = model.generate_content(prompt)
        gemini_feedback = response.text
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get feedback from Gemini API: {str(e)}"
        )
    
    return {
        "wpm": wpm,
        "filler_words": filler_words,
        "total_filler_count": total_filler_count,
        "gemini_feedback": gemini_feedback,
        "status": "success"
    }
