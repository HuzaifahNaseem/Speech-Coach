# Speaking Improvement Backend

Python FastAPI backend for the Chrome extension: will receive transcript + duration, compute WPM and filler count, and call Gemini for speaking feedback.

## Setup

1. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

2. **Set your Gemini API key**

   Copy the example env file and add your key:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:

   ```
   GEMINI_API_KEY=your_key_here
   ```

3. **Run the server**

   ```bash
   uvicorn main:app --reload
   ```

   Default: http://127.0.0.1:8000

## Verify

- **Health check:** `GET /health` → `{ "ok": true }`
- Open http://127.0.0.1:8000/health in a browser or use curl.

Later: analyze route (transcript + duration → WPM, filler count, Gemini feedback) will be added here.
