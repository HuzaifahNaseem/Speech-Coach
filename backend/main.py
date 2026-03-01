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


def calculate_overall_score(wpm, total_filler_count, unclear_word_count, word_count, duration_seconds):
    """Calculate overall speaking score out of 100 with fair, percentage-based scoring."""
    score = 100
    
    # Pace scoring (max -30 points)
    # Optimal range: 95-155 WPM
    if wpm < 70:
        score -= min(30, (70 - wpm) * 0.5)
    elif wpm < 85:
        score -= min(15, (85 - wpm) * 0.4)
    elif wpm < 95:
        score -= min(8, (95 - wpm) * 0.3)
    elif wpm > 185:
        score -= min(30, (wpm - 185) * 0.4)
    elif wpm > 170:
        score -= min(20, (wpm - 170) * 0.35)
    elif wpm > 155:
        score -= min(10, (wpm - 155) * 0.3)
    
    # Filler word scoring (max -40 points) - based on percentage
    filler_percentage = (total_filler_count / word_count * 100) if word_count > 0 else 0
    
    if filler_percentage > 8:  # More than 8% fillers
        score -= 40
    elif filler_percentage > 5:  # 5-8%
        score -= 30
    elif filler_percentage > 3:  # 3-5%
        score -= 20
    elif filler_percentage > 2:  # 2-3%
        score -= 12
    elif filler_percentage > 1:  # 1-2%
        score -= 6
    elif filler_percentage > 0.5:  # 0.5-1%
        score -= 3
    
    # Clarity scoring (max -20 points) - based on percentage
    unclear_percentage = (unclear_word_count / word_count * 100) if word_count > 0 else 0
    
    if unclear_percentage > 5:  # More than 5% unclear
        score -= 20
    elif unclear_percentage > 3:  # 3-5%
        score -= 15
    elif unclear_percentage > 1:  # 1-3%
        score -= 10
    elif unclear_percentage > 0.5:  # 0.5-1%
        score -= 5
    elif unclear_percentage > 0:
        score -= 2
    
    # Duration penalty (max -10 points) - need reasonable sample size
    if duration_seconds < 20:
        score -= 10
    elif duration_seconds < 30:
        score -= 5
    elif duration_seconds < 45:
        score -= 2
    
    return max(0, min(100, round(score)))


def clean_gemini_text(text):
    """Remove markdown formatting and excessive symbols from Gemini output."""
    import re
    
    # Remove markdown headers (###, ##, #)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    
    # Remove bold/italic markers (**text**, *text*)
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    
    # Remove bullet points and list markers (-, *, •)
    text = re.sub(r'^[\*\-\•]\s+', '', text, flags=re.MULTILINE)
    
    # Clean up excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Remove special unicode characters but keep basic punctuation
    text = text.replace('—', '-')
    text = text.replace('–', '-')
    text = text.replace(''', "'")
    text = text.replace(''', "'")
    text = text.replace('"', '"')
    text = text.replace('"', '"')
    text = text.replace('…', '...')
    
    return text.strip()


# === ENDPOINTS ===

@app.get("/health")
def health():
    """Verify the server is running."""
    return {"ok": True}


@app.post("/quick-feedback")
async def quick_feedback(request: AnalyzeRequest):
    """Provide quick 20-second stats and coaching tips."""
    
    transcript = request.transcript
    duration_seconds = request.duration_seconds
    
    if duration_seconds <= 0:
        raise HTTPException(status_code=400, detail="duration_seconds must be greater than 0")
    
    # Get words from the transcript (this is ONLY the last 20 seconds now)
    words = transcript.split()
    word_count = len(words)
    
    # If no words, return "no speech detected" feedback
    if word_count == 0:
        return {
            "quick_tip": "No speech detected in last 20 seconds",
            "ten_sec_stats": {
                "wpm": 0,
                "filler_count": 0,
                "unclear_words": [],
                "pace_quality": "none"
            },
            "severity": "warning"
        }
    
    # Calculate stats for ONLY this 20-second window
    filler_words, filler_count = count_fillers(transcript)
    unclear_words = detect_unclear_words(transcript)
    
    # Calculate WPM based on actual words in this window
    twenty_sec_wpm = round((word_count / duration_seconds) * 60, 2)
    
    # Determine pace quality
    if twenty_sec_wpm > 170:
        pace_quality = "too_fast"
    elif twenty_sec_wpm < 110:
        pace_quality = "too_slow"
    else:
        pace_quality = "good"
    
    # Generate feedback lines for pace, fillers, and clarity
    unclear_count = len(unclear_words)
    pace_line = ""
    filler_line = ""
    clarity_line = ""
    severity = "good"
    
    # Pace feedback
    if twenty_sec_wpm > 170:
        pace_line = "Pace: Too fast"
        severity = "alert"
    elif twenty_sec_wpm < 110:
        pace_line = "Pace: Too slow"
        if severity == "good": severity = "warning"
    else:
        pace_line = "Pace: Good"
    
    # Filler word feedback
    if filler_count >= 5:
        filler_line = "Fillers: Way too many!"
        severity = "alert"
    elif filler_count >= 3:
        filler_line = "Fillers: Too many"
        severity = "alert"
    elif filler_count >= 1:
        filler_line = f"Fillers: {filler_count} detected"
        if severity == "good": severity = "warning"
    else:
        filler_line = "Fillers: None"
    
    # Clarity feedback
    if unclear_count >= 3:
        clarity_line = "Clarity: Several unclear words"
        if severity == "good": severity = "warning"
    elif unclear_count >= 1:
        clarity_line = f"Clarity: {unclear_count} unclear word"
        if severity == "good": severity = "warning"
    else:
        clarity_line = "Clarity: Clear"
    
    # Check if everything is perfect
    if filler_count == 0 and unclear_count == 0 and 110 <= twenty_sec_wpm <= 170:
        quick_tip = "Perfect!"
        severity = "good"
    else:
        # Combine all feedback lines
        quick_tip = f"{pace_line}\n{filler_line}\n{clarity_line}"
    
    # Debug logging
    print(f"[BACKEND] Quick feedback: {word_count} words / {duration_seconds:.1f}s = {twenty_sec_wpm:.1f} WPM")
    print(f"[BACKEND] Fillers: {filler_count}, Unclear: {unclear_count}, Severity: {severity}")
    print(f"[BACKEND] Pace check: WPM {twenty_sec_wpm:.1f} (>170=fast, <110=slow)")
    
    return {
        "quick_tip": quick_tip,
        "ten_sec_stats": {
            "wpm": twenty_sec_wpm,
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
    
    # Calculate overall score
    overall_score = calculate_overall_score(
        wpm, 
        total_filler_count, 
        unclear_word_count, 
        word_count, 
        duration_seconds
    )
    
    # Debug logging for score calculation
    print(f"[BACKEND] Final Analysis: {word_count} words, {wpm:.1f} WPM, {total_filler_count} fillers")
    print(f"[BACKEND] Score calculation: {overall_score}/100")
    print(f"[BACKEND] - Filler %: {(total_filler_count/word_count*100):.1f}%")
    print(f"[BACKEND] - Unclear %: {(unclear_word_count/word_count*100 if word_count > 0 else 0):.1f}%")
    
    # Generate improved Gemini prompt
    prompt = f"""You are a speech coach analyzing someone's speaking performance. Provide specific, actionable feedback based on their actual speech.

=== PERFORMANCE METRICS ===
Overall Score: {overall_score}/100
Speaking Pace: {wpm:.0f} words per minute
Total Filler Words: {total_filler_count} ({(total_filler_count/word_count*100):.1f}% of speech)
Unclear Words: {unclear_word_count}
Duration: {duration_seconds:.0f} seconds
Total Words: {word_count}

=== SCORING CONTEXT ===
Optimal Pace: 95-155 WPM (current: {wpm:.0f} WPM)
Filler Target: <1% of speech (current: {(total_filler_count/word_count*100):.1f}%)
Clarity Target: 0 unclear words (current: {unclear_word_count})

=== TRANSCRIPT ===
"{transcript}"

=== YOUR ANALYSIS MUST INCLUDE ===

1. SCORE EXPLANATION (2-3 sentences):
   Start with "Your score of {overall_score}/100 reflects..." 
   Explicitly explain which factors (pace, fillers, clarity) raised or lowered the score.
   Be direct about what went well and what needs improvement.

2. PACE ANALYSIS:
   Compare {wpm:.0f} WPM to optimal 95-155 range.
   If too fast (>155): Specific breathing and pacing techniques
   If too slow (<95): Strategies to maintain energy
   If good: Acknowledge and encourage maintaining it

3. FILLER WORD STRATEGY:
   {total_filler_count} fillers = {(total_filler_count/word_count*100):.1f}% of speech.
   Concrete techniques: pausing, breathing, thinking before speaking
   Reference specific moments if possible

4. CLARITY & ARTICULATION:
   Assess pronunciation and clarity based on transcript
   Specific exercises or techniques if issues detected

5. CONTENT & FLOW:
   Analyze coherence, structure, and message delivery
   Comment on transitions and idea connections

6. ACTION ITEMS (4-5 specific steps):
   Concrete, actionable improvements
   Prioritized by impact
   Directly tied to this speech sample

FORMAT: Clear paragraphs for each section. Be honest but constructive. No generic advice - everything must relate to what they actually said and how they said it. This is general speaking practice, not for any specific context."""

    try:
        model = genai.GenerativeModel("gemini-3-flash-preview")
        response = model.generate_content(prompt)
        gemini_feedback = clean_gemini_text(response.text)
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
        "overall_score": overall_score,
        "gemini_feedback": gemini_feedback,
        "status": "success"
    }
