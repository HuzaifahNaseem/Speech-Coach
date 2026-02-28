let recognition;
let transcriptText = "";
let startTime;
let wordCount = 0;
let chunkInterval;
let isRecording = false;

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
    transcriptText = "";
    sendToGemini(chunk);
  }, 30000);

  isRecording = true;
  updateUIState();
}

function stopRecognition() {
  if (recognition) recognition.stop();
  if (chunkInterval) clearInterval(chunkInterval);

  isRecording = false;
  updateUIState();
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