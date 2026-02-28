let recognition;
let transcriptText = "";
let startTime;
let wordCount = 0;

const wpmDisplay = document.getElementById("wpm");
const wordCountDisplay = document.getElementById("wordCount");
const transcriptDisplay = document.getElementById("transcript");

document.getElementById("startBtn").onclick = () => {
  startRecognition();
};

document.getElementById("stopBtn").onclick = () => {
  stopRecognition();
};

function startRecognition() {
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

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

  recognition.start();
}

function stopRecognition() {
  if (recognition) recognition.stop();
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