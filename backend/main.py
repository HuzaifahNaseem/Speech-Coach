"""
FastAPI backend for the speaking-improvement Chrome extension.
Loads env with python-dotenv; health check at GET /health.
"""
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI

app = FastAPI(title="Speaking Improvement API")


@app.get("/health")
def health():
    """Verify the server is running."""
    return {"ok": True}
