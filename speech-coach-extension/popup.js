// === STATE MANAGEMENT ===
let recognition;
let transcriptText = "";
let confirmedText = "";
let startTime;
let isRecording = false;
let feedbackHistory = [];
let lastTenSecStats = null;
let overallStats = null;
let chunkInterval;
let notificationsEnabled = true;
const NOTIFICATION_STORAGE_KEY = 'notificationsEnabled';

// === DOM ELEMENTS ===
const toggleBtn = document.getElementById("toggleBtn");
const recordingStatus = document.getElementById("recordingStatus");
const statusText = document.querySelector(".status-text");
const transcriptDisplay = document.getElementById("transcript");
const notificationToggle = document.getElementById('notificationToggle');

// === NOTIFICATION FUNCTIONS ===

// Load saved notification preference
async function loadNotificationPreference() {
  const result = await chrome.storage.local.get(NOTIFICATION_STORAGE_KEY);
  notificationsEnabled = result[NOTIFICATION_STORAGE_KEY] !== false; // Default true
  if (notificationToggle) {
    notificationToggle.checked = notificationsEnabled;
  }
}

// Save notification preference
async function saveNotificationPreference(enabled) {
  notificationsEnabled = enabled;
  await chrome.storage.local.set({ [NOTIFICATION_STORAGE_KEY]: enabled });
}

// Request notification permission
async function requestNotificationPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      notificationsEnabled = false;
      if (notificationToggle) {
        notificationToggle.checked = false;
      }
    }
    return permission === 'granted';
  }
  return false;
}

// Show desktop notification
async function showNotification(title, message, severity = 'info') {
  if (!notificationsEnabled) return;
  
  // Request permission if not already granted
  if (Notification.permission !== 'granted') {
    const granted = await requestNotificationPermission();
    if (!granted) return;
  }
  
  const notification = new Notification(title, {
    body: message,
    tag: 'speech-coach-tip', // Replaces previous notification
    requireInteraction: false,
    silent: false
  });
  
  // Auto-close after 8 seconds
  setTimeout(() => notification.close(), 8000);
  
  // Clicking notification focuses the window
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

// === SPEECH RECOGNITION ===

function startRecognition() {
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

  transcriptText = "";
  confirmedText = "";
  startTime = Date.now();
  feedbackHistory = [];
  lastTenSecStats = null;
  overallStats = null;

  // Hide overall stats from previous session
  document.getElementById('overallStatsSection').style.display = 'none';
  document.getElementById('feedbackSection').style.display = 'none';
  
  // Request notification permission on first recording
  if (notificationsEnabled && Notification.permission === 'default') {
    requestNotificationPermission();
  }

  recognition.onresult = (event) => {
    let fullTranscript = "";
    let interimTranscript = "";

    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        fullTranscript += event.results[i][0].transcript + " ";
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    transcriptText = confirmedText + fullTranscript;
    transcriptDisplay.innerText = transcriptText + interimTranscript;
  };

  recognition.onend = () => {
    if (isRecording) {
      confirmedText = transcriptText;
      recognition.start();
    }
  };

  recognition.onend = () => {
    if (isRecording) recognition.start();
  };

  recognition.start();

    // Send feedback every 20 seconds
    chunkInterval = setInterval(() => {
      if (!transcriptText.trim()) return;
  
      // Calculate WPM right here in frontend
      const words = transcriptText.trim().split(/\s+/).filter(w => w.length > 0);
      const totalSeconds = (Date.now() - startTime) / 1000;
      const wpm = Math.round((words.length / totalSeconds) * 60);
  
      // Update WPM display directly from frontend (not backend)
      const tenSecWpm = document.getElementById('tenSecWpm');
      if (tenSecWpm) tenSecWpm.textContent = wpm;
  
      console.log(`[WPM CHECK] ${words.length} words / ${totalSeconds.toFixed(0)}s = ${wpm} WPM`);
  
      // Send to backend for filler words and coaching tips only
      sendQuickFeedback(transcriptText.trim(), totalSeconds);
    }, 20000);

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

async function sendQuickFeedback(transcript, actualDuration) {
  try {
    // Use the actual duration since last feedback (should be ~20 seconds)
    const duration = actualDuration || 20;
    
    const wordCount = transcript.split(/\s+/).filter(w => w.length > 0).length;
    const calculatedWpm = (wordCount / duration) * 60;
    console.log(`[FRONTEND] Sending: ${wordCount} words in ${duration.toFixed(1)}s = ${calculatedWpm.toFixed(1)} WPM`);
    
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
  
  // WPM is calculated in frontend, don't override it here
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
  
  // Update overall score
  const overallScoreEl = document.getElementById('overallScore');
  if (overallScoreEl && data.overall_score !== undefined) {
    overallScoreEl.textContent = data.overall_score;
    
    // Color-code the score
    const scoreValue = data.overall_score;
    const scoreContainer = overallScoreEl.parentElement;
    if (scoreValue >= 90) {
      scoreContainer.style.background = 'linear-gradient(135deg, #10b981, #34d399)';
    } else if (scoreValue >= 70) {
      scoreContainer.style.background = 'linear-gradient(135deg, #4f46e5, #6366f1)';
    } else if (scoreValue >= 50) {
      scoreContainer.style.background = 'linear-gradient(135deg, #f59e0b, #fbbf24)';
    } else {
      scoreContainer.style.background = 'linear-gradient(135deg, #ef4444, #f87171)';
    }
  }
  
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
  
  // Also send desktop notification
  const title = 'Speech Coach';
  showNotification(title, tip, severity);
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

// Toggle event listener for notifications
if (notificationToggle) {
  notificationToggle.addEventListener('change', async (e) => {
    await saveNotificationPreference(e.target.checked);
    if (e.target.checked) {
      await requestNotificationPermission();
    }
  });
}

// Load notification preference on startup
loadNotificationPreference();
