// services/api.ts - With proper history management

export interface SpeechAnalysisRequest {
  transcript: string;
  sessionId?: string;
}

export interface FillerWord {
  word: string;
  count: number;
  percentage: number;
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: 'pace' | 'filler' | 'clarity' | 'confidence';
  priority: 'high' | 'medium' | 'low';
  examples?: string[];
}

export interface BackendAnalysisResponse {
  success: boolean;
  data: {
    sessionId: string;
    timestamp: string;
    metrics: {
      totalWords: number;
      uniqueWords: number;
      fillerWordCount: number;
      fillerPercentage: number;
      speakingPace: {
        wpm: number;
        rating: 'slow' | 'optimal' | 'fast';
      };
    };
    fillerWords: FillerWord[];
    suggestions: Suggestion[];
    transcript: string;
  };
  message?: string;
}

export interface SessionHistoryResponse {
  sessions: {
    sessionId: string;
    timestamp: string;
    metrics: {
      fillerPercentage: number;
      wpm: number;
      totalWords: number;
      fillerWordCount: number;
    };
    preview: string;
  }[];
}

// In-memory storage for demo purposes
// In a real app, this would be a database
let sessionsStore: BackendAnalysisResponse['data'][] = [];

// Mock data generator
const generateMockAnalysis = (transcript: string): BackendAnalysisResponse['data'] => {
  const words = transcript.split(/\s+/);
  const fillerWordsList = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'so', 'well', 'right', 'okay'];
  
  const fillerCounts: Record<string, number> = {};
  words.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^\w\s]/g, '');
    if (fillerWordsList.includes(cleanWord)) {
      fillerCounts[cleanWord] = (fillerCounts[cleanWord] || 0) + 1;
    }
  });

  const fillerArray = Object.entries(fillerCounts).map(([word, count]) => ({
    word,
    count,
    percentage: (count / words.length) * 100
  }));

  const totalFillers = fillerArray.reduce((sum, item) => sum + item.count, 0);
  const fillerPercentage = (totalFillers / words.length) * 100;

  // Calculate WPM (assuming 150 words per minute as average speaking rate)
  const estimatedMinutes = words.length / 150;
  const wpm = Math.round(words.length / (estimatedMinutes || 1));

  // Determine speaking pace rating
  let paceRating: 'slow' | 'optimal' | 'fast' = 'optimal';
  if (wpm < 110) paceRating = 'slow';
  else if (wpm > 170) paceRating = 'fast';

  // Generate dynamic suggestions based on actual filler words
  const suggestions: Suggestion[] = [];
  
  if (totalFillers > 0) {
    suggestions.push({
      id: Date.now().toString() + '1',
      title: 'Reduce Filler Words',
      description: `You used ${totalFillers} filler words (${fillerPercentage.toFixed(1)}% of your speech). Try these alternatives:`,
      category: 'filler',
      priority: totalFillers > 10 ? 'high' : totalFillers > 5 ? 'medium' : 'low',
      examples: fillerArray.slice(0, 3).map(f => 
        `Replace "${f.word}" with a silent pause`
      )
    });
  }

  if (paceRating !== 'optimal') {
    suggestions.push({
      id: Date.now().toString() + '2',
      title: 'Adjust Speaking Pace',
      description: paceRating === 'slow' 
        ? 'Your speaking pace is a bit slow. Try to speed up slightly to maintain engagement.'
        : 'Your speaking pace is a bit fast. Try slowing down for better clarity.',
      category: 'pace',
      priority: 'medium',
      examples: [
        'Practice with a metronome at 140 WPM',
        'Record yourself and check your pace',
        'Use pauses effectively instead of rushing'
      ]
    });
  }

  suggestions.push({
    id: Date.now().toString() + '3',
    title: 'Practice Exercise',
    description: 'Try this exercise to improve your speaking:',
    category: 'confidence',
    priority: 'low',
    examples: [
      'Read a passage aloud for 2 minutes daily',
      'Count your filler words and track improvement',
      'Practice pausing for 2-3 seconds between sentences'
    ]
  });

  return {
    sessionId: Date.now().toString(),
    timestamp: new Date().toISOString(),
    metrics: {
      totalWords: words.length,
      uniqueWords: new Set(words).size,
      fillerWordCount: totalFillers,
      fillerPercentage,
      speakingPace: {
        wpm,
        rating: paceRating
      }
    },
    fillerWords: fillerArray,
    suggestions,
    transcript
  };
};

class SpeechApiService {
  async analyzeSpeech(request: SpeechAnalysisRequest): Promise<BackendAnalysisResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate analysis
    const analysisData = generateMockAnalysis(request.transcript);
    
    // Store in history
    sessionsStore = [analysisData, ...sessionsStore].slice(0, 20); // Keep last 20 sessions
    
    return {
      success: true,
      data: analysisData
    };
  }

  async getHistory(userId?: string): Promise<SessionHistoryResponse> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return stored sessions with preview
    return {
      sessions: sessionsStore.map(session => ({
        sessionId: session.sessionId,
        timestamp: session.timestamp,
        metrics: {
          fillerPercentage: session.metrics.fillerPercentage,
          wpm: session.metrics.speakingPace.wpm,
          totalWords: session.metrics.totalWords,
          fillerWordCount: session.metrics.fillerWordCount
        },
        preview: session.transcript.substring(0, 60) + '...'
      }))
    };
  }

  async getSession(sessionId: string): Promise<BackendAnalysisResponse> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find the session in storage
    const session = sessionsStore.find(s => s.sessionId === sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    return {
      success: true,
      data: session
    };
  }

  async saveAnalysis(analysis: BackendAnalysisResponse['data']): Promise<any> {
    // Check if session already exists
    const existingIndex = sessionsStore.findIndex(s => s.sessionId === analysis.sessionId);
    
    if (existingIndex >= 0) {
      // Update existing session
      sessionsStore[existingIndex] = analysis;
    } else {
      // Add new session
      sessionsStore = [analysis, ...sessionsStore].slice(0, 20);
    }
    
    return { success: true, message: 'Analysis saved' };
  }

  // Helper method to clear history (for testing)
  clearHistory() {
    sessionsStore = [];
  }
}

export const speechApi = new SpeechApiService();