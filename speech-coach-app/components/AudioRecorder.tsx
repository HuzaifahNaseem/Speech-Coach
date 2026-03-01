import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

interface AudioRecorderProps {
  onRecordingComplete: (transcript: string) => void;
  isProcessing: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onRecordingComplete, 
  isProcessing 
}) => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    getPermissions();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const getPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Microphone permission is needed to record audio.'
        );
      }
    } catch (error) {
      console.error('Error getting permissions:', error);
    }
  };

  const startRecording = async () => {
    try {
      if (hasPermission !== true) {
        await getPermissions();
        if (hasPermission !== true) return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      console.log('Stopping recording...');
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        await processAudio(uri);
      }
      
      setRecording(null);
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const processAudio = async (audioUri: string) => {
    try {
      Alert.alert(
        'Audio Recorded',
        'In a production app, this audio would be sent to a speech-to-text service.',
        [
          {
            text: 'Use Sample Text',
            onPress: () => {
              const sampleTranscript = "Um, so I was like thinking about the project and um, you know, we really need to like focus on the important stuff. Actually, I think we should, um, prioritize the main features first. Like, you know, the ones that matter most. So yeah, that's basically what I was thinking.";
              onRecordingComplete(sampleTranscript);
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="mic-off" size={40} color="#ef4444" />
        <Text style={styles.permissionText}>
          Microphone permission is required to record audio.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={getPermissions}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.recorderContainer}>
        {isRecording ? (
          <>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording...</Text>
            </View>
            <Text style={styles.timerText}>{formatTime(recordingDuration)}</Text>
            <TouchableOpacity
              style={[styles.recordButton, styles.stopButton]}
              onPress={stopRecording}
              disabled={isProcessing}
            >
              <Ionicons name="stop" size={32} color="white" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.instructionText}>
              Tap the microphone to start recording
            </Text>
            <TouchableOpacity
              style={[styles.recordButton, styles.startButton]}
              onPress={startRecording}
              disabled={isProcessing}
            >
              <Ionicons 
                name={isProcessing ? "sync" : "mic"} 
                size={40} 
                color="white" 
              />
            </TouchableOpacity>
            {isProcessing && (
              <Text style={styles.processingText}>Processing audio...</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  recorderContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  permissionContainer: {
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: '#b91c1c',
    textAlign: 'center',
    marginVertical: 10,
  },
  permissionButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 15,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  startButton: {
    backgroundColor: '#4f46e5',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  processingText: {
    fontSize: 14,
    color: '#4f46e5',
    marginTop: 10,
  },
});