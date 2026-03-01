import React, { createContext, useContext, useState, ReactNode } from 'react';
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

  const analyzeSpeech = async (transcript: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await speechApi.analyzeSpeech({ transcript });
      setCurrentAnalysis(response);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze speech');
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const historyData = await speechApi.getHistory();
      setHistory(historyData);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const loadSession = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await speechApi.getSession(sessionId);
      setCurrentAnalysis(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

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
      }}
    >
      {children}
    </SpeechContext.Provider>
  );
};