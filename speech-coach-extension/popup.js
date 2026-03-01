let recognition;
let transcriptText = "";
let startTime;
let wordCount = 0;
let chunkInterval;
let isRecording = false;
let latestFeedback = null;
let feedbackHistory = [];

const toggleBtn = document.getElementById("toggleBtn");
const recordingStatus = document.getElementById("recordingStatus");
const statusText = document.querySelector(".status-text");

const wpmDisplay = document.getElementById("wpm");
const wordCountDisplay = document.getElementById("wordCount");
const transcriptDisplay = document.getElementById("transcript");

toggleBtn.onclick = () => {
  if (!isRecording) {
    startRecognition();
  } else {
    stopRecognition();
  }
};

function startRecognition() {
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

  transcriptText = "";
  startTime = Date.now();

  recognition.onresult = (event) => {
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      let transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        transcriptText += transcript + " ";
      } else {
        interimTranscript += transcript;
      }
    }

    updateStats();
    transcriptDisplay.innerText = transcriptText + interimTranscript;
  };

  recognition.onend = () => {
    if (isRecording) recognition.start();
  };

  recognition.start();

  chunkInterval = setInterval(() => {
    if (!transcriptText.trim()) return;

    const chunk = transcriptText.trim();
    // Keep transcript for context
    sendQuickFeedback(chunk);
  }, 15000);

  isRecording = true;
  updateUIState();
}

function stopRecognition() {
  if (recognition) recognition.stop();
  if (chunkInterval) clearInterval(chunkInterval);

  isRecording = false;
  updateUIState();
  
  // Get end of session feedback
  if (transcriptText.trim()) {
    endSessionFeedback();
  }
}

async function sendQuickFeedback(transcript) {
  try {
    const duration = (Date.now() - startTime) / 1000;
    
    const response = await fetch('http://127.0.0.1:8000/quick-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: transcript,
        duration_seconds: duration
      })
    });
    
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }
    
    const data = await response.json();
    feedbackHistory.push(data);
    displayQuickTip(data);
  } catch (error) {
    console.error('Error sending to backend:', error);
    showError('Could not connect to backend. Make sure the server is running.');
  }
}

async function endSessionFeedback() {
  try {
    const duration = (Date.now() - startTime) / 1000;
    
    const response = await fetch('http://127.0.0.1:8000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: transcriptText.trim(),
        duration_seconds: duration
      })
    });
    
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }
    
    const data = await response.json();
    displayFeedback(data);
  } catch (error) {
    console.error('Error getting end session feedback:', error);
    showError('Could not get final feedback from backend.');
  }
}

function displayQuickTip(data) {
  const banner = document.getElementById('quickTipBanner');
  const text = document.getElementById('quickTipText');
  
  if (banner && text) {
    text.innerText = data.quick_tip;
    banner.className = `quick-tip-banner ${data.severity}`;
    banner.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      banner.style.display = 'none';
    }, 5000);
  }
  
  // Update stats from quick feedback
  if (wpmDisplay) wpmDisplay.innerText = Math.round(data.wpm);
  
  const fillerCountEl = document.getElementById('fillerCount');
  if (fillerCountEl) {
    fillerCountEl.innerText = data.filler_count;
  }
}

function displayFeedback(data) {
  latestFeedback = data;
  console.log('Received feedback:', data);
  updateFeedbackUI();
}

function showError(message) {
  console.error(message);
  // You can add UI error display later
}

function updateFeedbackUI() {
  if (!latestFeedback) return;
  
  // Update stats
  if (wpmDisplay) wpmDisplay.innerText = Math.round(latestFeedback.wpm);
  
  const fillerCountEl = document.getElementById('fillerCount');
  if (fillerCountEl) {
    fillerCountEl.innerText = latestFeedback.total_filler_count;
  }
  
  // Show feedback section
  const feedbackSection = document.getElementById('feedbackSection');
  const feedbackBox = document.getElementById('feedback');
  
  if (feedbackSection && feedbackBox) {
    feedbackSection.style.display = 'block';
    feedbackBox.innerText = latestFeedback.gemini_feedback;
  }
}

function updateUIState() {
  if (isRecording) {
    toggleBtn.textContent = "Stop Session";
    toggleBtn.style.background = "#ef4444";
    toggleBtn.style.color = "white";
    recordingStatus.classList.add("recording-active");
    statusText.textContent = "Recording...";
  } else {
    toggleBtn.textContent = "Start Session";
    toggleBtn.style.background = "#4f46e5";
    toggleBtn.style.color = "white";
    recordingStatus.classList.remove("recording-active");
    statusText.textContent = "Not Recording";
  }
}

function updateStats() {
  const words = transcriptText.trim().split(/\s+/);
  wordCount = words.filter(word => word.length > 0).length;

  const elapsedMinutes = (Date.now() - startTime) / 60000;
  const wpm = elapsedMinutes > 0
    ? Math.round(wordCount / elapsedMinutes)
    : 0;

  wordCountDisplay.innerText = wordCount;
  wpmDisplay.innerText = wpm;
}