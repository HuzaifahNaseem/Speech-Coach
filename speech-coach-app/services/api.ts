// services/api.ts - MOCK VERSION for testing without backend

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
    };
  }[];
}

// Mock data generator
const generateMockAnalysis = (transcript: string): BackendAnalysisResponse => {
  const words = transcript.split(/\s+/);
  const fillerWords = ['um', 'uh', 'like', 'you know', 'actually', 'basically'];
  
  const fillerCounts: Record<string, number> = {};
  words.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^\w\s]/g, '');
    if (fillerWords.includes(cleanWord)) {
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

  return {
    success: true,
    data: {
      sessionId: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      metrics: {
        totalWords: words.length,
        uniqueWords: new Set(words).size,
        fillerWordCount: totalFillers,
        fillerPercentage,
        speakingPace: {
          wpm: Math.floor(words.length / 2),
          rating: fillerPercentage > 10 ? 'slow' : fillerPercentage > 5 ? 'optimal' : 'fast'
        }
      },
      fillerWords: fillerArray,
      suggestions: [
        {
          id: '1',
          title: 'Reduce Filler Words',
          description: 'You used several filler words. Try pausing instead.',
          category: 'filler',
          priority: 'high',
          examples: ['Replace "um" with a silent pause', 'Use "such as" instead of "like"']
        },
        {
          id: '2',
          title: 'Improve Speaking Pace',
          description: 'Your pace could be more consistent.',
          category: 'pace',
          priority: 'medium',
          examples: ['Practice with a metronome', 'Record yourself and listen back']
        }
      ],
      transcript
    }
  };
};

class SpeechApiService {
  async analyzeSpeech(request: SpeechAnalysisRequest): Promise<BackendAnalysisResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return generateMockAnalysis(request.transcript);
  }

  async getHistory(userId?: string): Promise<SessionHistoryResponse> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      sessions: [
        {
          sessionId: '1',
          timestamp: new Date().toISOString(),
          metrics: { fillerPercentage: 8.5, wpm: 120 }
        },
        {
          sessionId: '2',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          metrics: { fillerPercentage: 12.3, wpm: 95 }
        }
      ]
    };
  }

  async getSession(sessionId: string): Promise<BackendAnalysisResponse> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateMockAnalysis('Sample transcript for session ' + sessionId);
  }

  async saveAnalysis(analysis: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, message: 'Analysis saved' };
  }
}

export const speechApi = new SpeechApiService();