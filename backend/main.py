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


# === UTILITY FUNCTIONS ===

def get_filler_patterns():
    """Return improved filler word patterns."""
    return {
        "um": r"\b(um+|umm+|ummm+)\b",
        "uh": r"\b(uh+|uhh+|uhhh+|ugh+)\b",
        "like": r"\b(like)\b(?! to| it| that)",
        "you know": r"\b(you know|y'know|ya know)\b",
        "basically": r"\bbasically\b",
        "actually": r"\bactually\b",
        "literally": r"\bliterally\b",
        "sort of": r"\b(sort of|sorta)\b",
        "kind of": r"\b(kind of|kinda)\b",
        "i mean": r"\bi mean\b",
        "so": r"\bso+\b(?! that| far| much| many)",
        "right": r"\bright\b(?! now| here| there)",
    }


def detect_unclear_words(transcript):
    """Detect unclear or confused words from speech recognition."""
    words = transcript.split()
    unclear_words = []
    
    for i, word in enumerate(words):
        word_clean = re.sub(r'[^\w]', '', word.lower())
        
        # Single letter words that aren't "a" or "i"
        if len(word_clean) == 1 and word_clean not in ['a', 'i']:
            unclear_words.append(word)
        
        # Repeated characters (speech recognition errors)
        if len(word_clean) > 2 and len(set(word_clean)) == 1:
            unclear_words.append(word)
    
    return unclear_words


def calculate_advanced_metrics(transcript, duration_seconds, filler_count):
    """Calculate advanced speaking metrics."""
    words = transcript.split()
    sentences = re.split(r'[.!?]+', transcript)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    # Pace consistency (WPM variance)
    chunk_size = max(1, len(words) // 4) if len(words) > 10 else len(words)
    chunks = [words[i:i+chunk_size] for i in range(0, len(words), chunk_size) if words[i:i+chunk_size]]
    
    if len(chunks) > 1:
        chunk_durations = [duration_seconds / len(chunks)] * len(chunks)
        wpms = [(len(chunk) / (dur / 60)) for chunk, dur in zip(chunks, chunk_durations) if dur > 0]
        pace_variance = max(wpms) - min(wpms) if len(wpms) > 1 else 0
    else:
        pace_variance = 0
    
    # Average sentence length
    avg_sentence_length = len(words) / len(sentences) if sentences else 0
    
    # Vocabulary richness (unique words / total words)
    unique_words = len(set([w.lower() for w in words if len(w) > 3]))
    vocab_richness = (unique_words / len(words)) * 100 if words else 0
    
    # Repetition detection (words used more than expected)
    word_freq = {}
    for word in words:
        word_lower = word.lower()
        if len(word_lower) > 3:
            word_freq[word_lower] = word_freq.get(word_lower, 0) + 1
    
    repeated_words = {w: c for w, c in word_freq.items() if c >= 3}
    
    return {
        "pace_variance": round(pace_variance, 2),
        "avg_sentence_length": round(avg_sentence_length, 2),
        "vocab_richness": round(vocab_richness, 2),
        "repeated_words": repeated_words
    }


def count_fillers(transcript):
    """Count all filler words in transcript."""
    filler_patterns = get_filler_patterns()
    filler_words = {}
    total_filler_count = 0
    transcript_lower = transcript.lower()
    
    for filler, pattern in filler_patterns.items():
        count = len(re.findall(pattern, transcript_lower))
        filler_words[filler] = count
        total_filler_count += count
    
    return filler_words, total_filler_count


def get_top_filler_words(filler_words_dict, top_n=3):
    """Return top N most used filler words."""
    sorted_fillers = sorted(
        filler_words_dict.items(), 
        key=lambda x: x[1], 
        reverse=True
    )
    # Only include fillers that were actually used
    top_fillers = [
        {"word": word, "count": count} 
        for word, count in sorted_fillers[:top_n] 
        if count > 0
    ]
    return top_fillers


# === ENDPOINTS ===

@app.get("/health")
def health():
    """Verify the server is running."""
    return {"ok": True}


@app.post("/quick-feedback")
async def quick_feedback(request: AnalyzeRequest):
    """Provide quick 10-second stats and coaching tips."""
    
    transcript = request.transcript
    duration_seconds = request.duration_seconds
    
    if duration_seconds <= 0:
        raise HTTPException(status_code=400, detail="duration_seconds must be greater than 0")
    
    # Get last 10 seconds of transcript (approximate by word count)
    words = transcript.split()
    total_words = len(words)
    duration_minutes = duration_seconds / 60
    wpm = round(total_words / duration_minutes, 2) if duration_minutes > 0 else 0
    
    # Estimate words in last 10 seconds
    words_per_second = total_words / duration_seconds if duration_seconds > 0 else 0
    last_10_sec_word_count = int(words_per_second * min(10, duration_seconds))
    last_10_sec_words = words[-last_10_sec_word_count:] if last_10_sec_word_count > 0 else words
    last_10_sec_transcript = " ".join(last_10_sec_words)
    
    # Calculate 10-sec stats
    filler_words, filler_count = count_fillers(last_10_sec_transcript)
    unclear_words = detect_unclear_words(last_10_sec_transcript)
    
    ten_sec_wpm = round((len(last_10_sec_words) / 10) * 60, 2) if len(last_10_sec_words) > 0 else 0
    
    # Determine pace quality
    if ten_sec_wpm > 160:
        pace_quality = "too_fast"
    elif ten_sec_wpm < 120:
        pace_quality = "too_slow"
    else:
        pace_quality = "good"
    
    # Generate quick tip with improved thresholds
    unclear_count = len(unclear_words)
    quick_tip = ""
    severity = "good"
    
    # Priority 1: Check filler words (most important)
    if filler_count >= 5:
        quick_tip = "Way too many filler words! Pause instead of saying 'um'."
        severity = "alert"
    elif filler_count >= 3:
        quick_tip = "Too many filler words. Practice pausing before speaking."
        severity = "alert"
    elif filler_count >= 1:
        quick_tip = "Watch your filler words. Try to eliminate them."
        severity = "warning"
    # Priority 2: Check unclear words
    elif unclear_count >= 3:
        quick_tip = "Several words were unclear. Enunciate more carefully."
        severity = "warning"
    elif unclear_count >= 1:
        quick_tip = "A word sounded unclear. Focus on pronunciation."
        severity = "warning"
    # Priority 3: Check pace
    elif ten_sec_wpm > 170:
        quick_tip = "You're speaking way too fast! Slow down significantly."
        severity = "alert"
    elif ten_sec_wpm > 150:
        quick_tip = "You're speaking too fast. Take a breath and slow down."
        severity = "warning"
    elif ten_sec_wpm > 145:
        quick_tip = "Your pace is a bit fast. Try to slow down slightly."
        severity = "warning"
    elif ten_sec_wpm < 95:
        quick_tip = "You're speaking too slowly. Pick up the pace."
        severity = "warning"
    elif ten_sec_wpm < 105:
        quick_tip = "Your pace is a bit slow. Try speaking a little faster."
        severity = "warning"
    # Everything is good
    elif filler_count == 0:
        quick_tip = "Excellent! No fillers and good pace."
        severity = "good"
    else:
        quick_tip = "Great pace! Keep it up."
        severity = "good"
    
    # Debug logging
    print(f"[DEBUG] 10-sec WPM: {ten_sec_wpm}, Fillers: {filler_count}, Unclear: {unclear_count}, Tip: {quick_tip}")
    
    return {
        "quick_tip": quick_tip,
        "ten_sec_stats": {
            "wpm": ten_sec_wpm,
            "filler_count": filler_count,
            "unclear_words": unclear_words,
            "pace_quality": pace_quality
        },
        "severity": severity
    }


@app.post("/analyze")
async def analyze_speech(request: AnalyzeRequest):
    """Analyze full speech transcript with comprehensive metrics and AI feedback."""
    
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not configured. Please set it in the .env file."
        )
    
    transcript = request.transcript
    duration_seconds = request.duration_seconds
    
    if duration_seconds <= 0:
        raise HTTPException(status_code=400, detail="duration_seconds must be greater than 0")
    
    # Count filler words
    filler_words, total_filler_count = count_fillers(transcript)
    
    # Detect unclear words
    unclear_words = detect_unclear_words(transcript)
    unclear_word_count = len(unclear_words)
    
    # Calculate WPM
    words = transcript.split()
    word_count = len(words)
    duration_minutes = duration_seconds / 60
    wpm = round(word_count / duration_minutes, 2) if duration_minutes > 0 else 0
    
    # Calculate advanced metrics
    advanced_metrics = calculate_advanced_metrics(transcript, duration_seconds, total_filler_count)
    
    # Get top filler words
    top_filler_words = get_top_filler_words(filler_words, top_n=3)
    
    # Generate improved Gemini prompt
    prompt = f"""You are a speech coach analyzing someone's speaking performance. Provide specific, actionable feedback based on what they actually said.

METRICS:
- Speaking pace: {wpm} words per minute
- Total filler words: {total_filler_count}
- Duration: {duration_seconds} seconds
- Unclear words: {unclear_word_count}

TRANSCRIPT:
"{transcript}"

PROVIDE FEEDBACK ON:
1. Speaking pace: Is {wpm} WPM appropriate? Too fast/slow? How to adjust?
2. Filler word usage: {total_filler_count} fillers detected. Specific strategies to reduce them.
3. Clarity: Were there unclear moments? How to articulate better?
4. Content quality: Based on what they said, how was the flow and coherence?

Give 3-5 SPECIFIC suggestions for improvement that directly relate to THIS speech sample. Be constructive and actionable. Do NOT assume this is an interview or any specific context - this is general speaking practice.

Format: 2-3 sentences of analysis, then numbered list of suggestions."""

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
        "top_filler_words": top_filler_words,
        "unclear_words": unclear_words,
        "unclear_word_count": unclear_word_count,
        "pace_variance": advanced_metrics["pace_variance"],
        "avg_sentence_length": advanced_metrics["avg_sentence_length"],
        "vocab_richness": advanced_metrics["vocab_richness"],
        "repeated_words": advanced_metrics["repeated_words"],
        "gemini_feedback": gemini_feedback,
        "status": "success"
    }
