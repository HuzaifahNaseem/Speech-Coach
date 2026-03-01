import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSpeech } from '@/context/SpeechContext';
import { AudioRecorder } from '@/components/AudioRecorder';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'analyze' | 'history'>('analyze');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const {
    currentAnalysis,
    history,
    isLoading,
    error,
    analyzeSpeech,
    loadHistory,
    loadSession,
    clearError,
  } = useSpeech();

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      Alert.alert('Input Required', 'Please enter some text to analyze');
      return;
    }
    await analyzeSpeech(inputText);
  };

  const handleSampleText = () => {
    setInputText(
      "Um, so I was like thinking about the project and um, you know, we really need to like focus on the important stuff. Actually, I think we should, um, prioritize the main features first. Like, you know, the ones that matter most. So yeah, that's basically what I was thinking."
    );
  };

  const handleAudioRecorded = (transcript: string) => {
    setInputText(transcript);
  };

  const getPaceColor = (rating: string) => {
    switch (rating) {
      case 'optimal': return '#10b981';
      case 'slow': return '#f59e0b';
      case 'fast': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎤 Speech Coach</Text>
        <Text style={styles.headerSubtitle}>AI-Powered Speech Analysis</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'analyze' && styles.activeTab]}
          onPress={() => setActiveTab('analyze')}
        >
          <Ionicons
            name="mic"
            size={20}
            color={activeTab === 'analyze' ? '#4f46e5' : '#9ca3af'}
          />
          <Text style={[styles.tabText, activeTab === 'analyze' && styles.activeTabText]}>
            Analyze
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons
            name="time"
            size={20}
            color={activeTab === 'history' ? '#4f46e5' : '#9ca3af'}
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'analyze' ? (
          <>
            <AudioRecorder 
              onRecordingComplete={handleAudioRecorded}
              isProcessing={isProcessing}
            />
            
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Enter your speech transcript:</Text>
              <TextInput
                style={styles.input}
                multiline
                numberOfLines={8}
                placeholder="Paste your speech text here..."
                value={inputText}
                onChangeText={setInputText}
                textAlignVertical="top"
              />
              
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.analyzeButton]}
                  onPress={handleAnalyze}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="analytics" size={20} color="white" />
                      <Text style={styles.buttonText}>Analyze</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.sampleButton]}
                  onPress={handleSampleText}
                >
                  <Ionicons name="document-text" size={20} color="white" />
                  <Text style={styles.buttonText}>Sample</Text>
                </TouchableOpacity>
              </View>
            </View>

            {currentAnalysis && (
              <View style={styles.resultsCard}>
                <Text style={styles.sectionTitle}>Analysis Results</Text>
                
                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{currentAnalysis.data.metrics.totalWords}</Text>
                    <Text style={styles.metricLabel}>Total Words</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{currentAnalysis.data.metrics.fillerWordCount}</Text>
                    <Text style={styles.metricLabel}>Fillers</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>
                      {currentAnalysis.data.metrics.fillerPercentage.toFixed(1)}%
                    </Text>
                    <Text style={styles.metricLabel}>Filler %</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[
                      styles.metricValue,
                      { color: getPaceColor(currentAnalysis.data.metrics.speakingPace.rating) }
                    ]}>
                      {currentAnalysis.data.metrics.speakingPace.wpm}
                    </Text>
                    <Text style={styles.metricLabel}>WPM</Text>
                  </View>
                </View>

                {currentAnalysis.data.fillerWords.length > 0 ? (
                  <View style={styles.fillerSection}>
                    <Text style={styles.subSectionTitle}>Most Frequent Filler Words</Text>
                    {currentAnalysis.data.fillerWords.slice(0, 5).map((item, index) => (
                      <View key={index} style={styles.fillerRow}>
                        <View style={styles.fillerInfo}>
                          <Text style={styles.fillerWord}>"{item.word}"</Text>
                          <Text style={styles.fillerCount}>{item.count}x</Text>
                        </View>
                        <View style={[styles.progressBar, { width: `${item.percentage}%` }]} />
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.successMessage}>
                    <Ionicons name="checkmark-circle" size={40} color="#10b981" />
                    <Text style={styles.successText}>No filler words detected!</Text>
                  </View>
                )}

                {currentAnalysis.data.suggestions.length > 0 && (
                  <View style={styles.suggestionsSection}>
                    <Text style={styles.subSectionTitle}>Personalized Suggestions</Text>
                    {currentAnalysis.data.suggestions.map((suggestion, index) => (
                      <View key={index} style={styles.suggestionCard}>
                        <View style={styles.suggestionHeader}>
                          <View style={[
                            styles.priorityBadge,
                            { backgroundColor: getPriorityColor(suggestion.priority) }
                          ]}>
                            <Text style={styles.priorityText}>{suggestion.priority}</Text>
                          </View>
                          <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                        </View>
                        <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
                        {suggestion.examples && suggestion.examples.length > 0 && (
                          <View style={styles.examplesContainer}>
                            {suggestion.examples.map((example, idx) => (
                              <Text key={idx} style={styles.exampleText}>• {example}</Text>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        ) : (
          <View style={styles.historyCard}>
            <Text style={styles.sectionTitle}>Analysis History</Text>
            
            {history && history.sessions.length > 0 ? (
              history.sessions.map((session, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.historyItem}
                  onPress={() => loadSession(session.sessionId)}
                >
                  <View style={styles.historyItemContent}>
                    <View style={styles.historyItemHeader}>
                      <Ionicons name="calendar" size={16} color="#6b7280" />
                      <Text style={styles.historyDate}>
                        {new Date(session.timestamp).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.historyStats}>
                      <View style={styles.historyStat}>
                        <Text style={styles.historyStatLabel}>Fillers</Text>
                        <Text style={styles.historyStatValue}>
                          {session.metrics.fillerPercentage.toFixed(1)}%
                        </Text>
                      </View>
                      <View style={styles.historyStat}>
                        <Text style={styles.historyStatLabel}>WPM</Text>
                        <Text style={styles.historyStatValue}>{session.metrics.wpm}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document" size={48} color="#d1d5db" />
                <Text style={styles.emptyStateText}>No analysis history yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Analyze your first speech to see results here
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    backgroundColor: '#4f46e5',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#eef2ff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
  },
  activeTabText: {
    color: '#4f46e5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    minHeight: 150,
    backgroundColor: '#f9fafb',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  analyzeButton: {
    backgroundColor: '#4f46e5',
  },
  sampleButton: {
    backgroundColor: '#10b981',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricItem: {
    flex: 1,
    minWidth: (width - 80) / 2,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  fillerSection: {
    marginBottom: 20,
  },
  subSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  fillerRow: {
    marginBottom: 12,
  },
  fillerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fillerWord: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ef4444',
  },
  fillerCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#4f46e5',
    borderRadius: 3,
    opacity: 0.3,
  },
  successMessage: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    marginBottom: 20,
  },
  successText: {
    fontSize: 16,
    color: '#10b981',
    marginTop: 8,
  },
  suggestionsSection: {
    marginTop: 20,
  },
  suggestionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  suggestionDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  examplesContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  exampleText: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 4,
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyItem: {
    marginBottom: 12,
  },
  historyItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  historyItemHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  historyStats: {
    flexDirection: 'row',
    gap: 16,
    marginRight: 12,
  },
  historyStat: {
    alignItems: 'center',
  },
  historyStatLabel: {
    fontSize: 10,
    color: '#9ca3af',
  },
  historyStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
});