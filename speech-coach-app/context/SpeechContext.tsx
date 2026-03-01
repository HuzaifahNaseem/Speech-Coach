import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { speechApi, BackendAnalysisResponse, SessionHistoryResponse } from '@/services/api';

interface SpeechContextType {
  currentAnalysis: BackendAnalysisResponse | null;
  history: SessionHistoryResponse | null;
  isLoading: boolean;
  error: string | null;
  analyzeSpeech: (transcript: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  clearError: () => void;
  clearCurrentAnalysis: () => void;
}

const SpeechContext = createContext<SpeechContextType | undefined>(undefined);

export const useSpeech = () => {
  const context = useContext(SpeechContext);
  if (!context) {
    throw new Error('useSpeech must be used within a SpeechProvider');
  }
  return context;
};

interface SpeechProviderProps {
  children: ReactNode;
}

export const SpeechProvider: React.FC<SpeechProviderProps> = ({ children }) => {
  const [currentAnalysis, setCurrentAnalysis] = useState<BackendAnalysisResponse | null>(null);
  const [history, setHistory] = useState<SessionHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const historyData = await speechApi.getHistory();
      setHistory(historyData);
    } catch (err) {
      console.error('Failed to load history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load history');
    }
  }, []);

  const analyzeSpeech = async (transcript: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await speechApi.analyzeSpeech({ transcript });
      setCurrentAnalysis(response);
      // Immediately refresh history to include the new session
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze speech');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await speechApi.getSession(sessionId);
      setCurrentAnalysis(session);
      // Switch to analyze tab to show the loaded session
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);
  
  const clearCurrentAnalysis = () => setCurrentAnalysis(null);

  // Load history on mount
  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <SpeechContext.Provider
      value={{
        currentAnalysis,
        history,
        isLoading,
        error,
        analyzeSpeech,
        loadHistory,
        loadSession,
        clearError,
        clearCurrentAnalysis,
      }}
    >
      {children}
    </SpeechContext.Provider>
  );
};