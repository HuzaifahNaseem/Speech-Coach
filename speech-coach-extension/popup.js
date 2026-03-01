// === STATE MANAGEMENT ===
let recognition;
let transcriptText = "";
let startTime;
let isRecording = false;
let feedbackHistory = [];
let lastTenSecStats = null;
let overallStats = null;
let chunkInterval;

// === DOM ELEMENTS ===
const toggleBtn = document.getElementById("toggleBtn");
const recordingStatus = document.getElementById("recordingStatus");
const statusText = document.querySelector(".status-text");
const transcriptDisplay = document.getElementById("transcript");

// === SPEECH RECOGNITION ===

function startRecognition() {
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

  transcriptText = "";
  startTime = Date.now();
  feedbackHistory = [];
  lastTenSecStats = null;
  overallStats = null;

  // Hide overall stats from previous session
  document.getElementById('overallStatsSection').style.display = 'none';
  document.getElementById('feedbackSection').style.display = 'none';

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

    transcriptDisplay.innerText = transcriptText + interimTranscript;
  };

  recognition.onend = () => {
    if (isRecording) recognition.start();
  };

  recognition.start();

  // Call quick feedback every 10 seconds
  chunkInterval = setInterval(() => {
    if (!transcriptText.trim()) return;
    sendQuickFeedback(transcriptText.trim());
  }, 10000);

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
    sendFinalAnalysis(transcriptText.trim());
  }
}

// === API CALLS ===

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
    updateTenSecStats(data);
  } catch (error) {
    console.error('Error sending quick feedback:', error);
    showError('Could not connect to backend. Make sure the server is running.');
  }
}

async function sendFinalAnalysis(transcript) {
  try {
    const duration = (Date.now() - startTime) / 1000;
    
    const response = await fetch('http://127.0.0.1:8000/analyze', {
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
    updateOverallStats(data);
  } catch (error) {
    console.error('Error getting final analysis:', error);
    showError('Could not get final feedback from backend.');
  }
}

// === UI UPDATES ===

function updateTenSecStats(data) {
  lastTenSecStats = data.ten_sec_stats;
  
  const tenSecWpm = document.getElementById('tenSecWpm');
  const tenSecFillers = document.getElementById('tenSecFillers');
  const tenSecUnclear = document.getElementById('tenSecUnclear');
  const tenSecPace = document.getElementById('tenSecPace');
  
  if (tenSecWpm) tenSecWpm.textContent = Math.round(data.ten_sec_stats.wpm);
  if (tenSecFillers) tenSecFillers.textContent = data.ten_sec_stats.filler_count;
  if (tenSecUnclear) tenSecUnclear.textContent = data.ten_sec_stats.unclear_words.length;
  if (tenSecPace) {
    const paceText = data.ten_sec_stats.pace_quality === 'good' ? 'Good' :
                     data.ten_sec_stats.pace_quality === 'too_fast' ? 'Fast' : 'Slow';
    tenSecPace.textContent = paceText;
  }
  
  displayQuickTip(data.quick_tip, data.severity);
}

function updateOverallStats(data) {
  overallStats = data;
  
  // Show overall stats section
  const overallStatsSection = document.getElementById('overallStatsSection');
  if (overallStatsSection) overallStatsSection.style.display = 'block';
  
  // Update values
  const overallWpm = document.getElementById('overallWpm');
  const overallFillers = document.getElementById('overallFillers');
  const overallUnclear = document.getElementById('overallUnclear');
  const paceVariance = document.getElementById('paceVariance');
  const avgSentenceLength = document.getElementById('avgSentenceLength');
  const vocabRichness = document.getElementById('vocabRichness');
  const repeatedWords = document.getElementById('repeatedWords');
  
  if (overallWpm) overallWpm.textContent = Math.round(data.wpm);
  if (overallFillers) overallFillers.textContent = data.total_filler_count;
  if (overallUnclear) overallUnclear.textContent = data.unclear_word_count;
  if (paceVariance) paceVariance.textContent = data.pace_variance + ' WPM';
  if (avgSentenceLength) avgSentenceLength.textContent = data.avg_sentence_length + ' words';
  if (vocabRichness) vocabRichness.textContent = data.vocab_richness.toFixed(1) + '%';
  
  // Display top filler words
  const topFillersList = document.getElementById('topFillersList');
  if (topFillersList && data.top_filler_words) {
    if (data.top_filler_words.length > 0) {
      topFillersList.innerHTML = data.top_filler_words
        .map(f => `<li>"${f.word}" - ${f.count} times</li>`)
        .join('');
    } else {
      topFillersList.innerHTML = '<li>No filler words detected!</li>';
    }
  }
  
  // Show repeated words
  if (repeatedWords) {
    const repeatedWordsText = Object.entries(data.repeated_words)
      .map(([word, count]) => `${word} (${count}x)`)
      .join(', ');
    repeatedWords.textContent = repeatedWordsText || 'None';
  }
  
  // Show feedback section
  const feedbackSection = document.getElementById('feedbackSection');
  const feedbackBox = document.getElementById('feedback');
  
  if (feedbackSection && feedbackBox) {
    feedbackSection.style.display = 'block';
    feedbackBox.textContent = data.gemini_feedback;
  }
}

function displayQuickTip(tip, severity) {
  const banner = document.getElementById('quickTipBanner');
  const text = document.getElementById('quickTipText');
  
  if (banner && text) {
    text.textContent = tip;
    banner.className = `quick-tip-banner ${severity}`;
    banner.style.display = 'block';
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
      banner.style.display = 'none';
    }, 8000);
  }
}

function showError(message) {
  console.error(message);
  displayQuickTip(message, 'alert');
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

// === EVENT LISTENERS ===

toggleBtn.onclick = () => {
  if (!isRecording) {
    startRecognition();
  } else {
    stopRecognition();
  }
};
