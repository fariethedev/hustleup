import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

export const formatDuration = (ms) => {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Playback bubble for a voice message. */
export function VoicePlayer({ uri, durationMs, tint, muted }) {
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);
  const total = (status.duration ? status.duration * 1000 : 0) || durationMs || 0;
  const progress = total ? Math.min(1, (status.currentTime * 1000) / total) : 0;

  useEffect(() => {
    if (status.didJustFinish) { player.pause(); player.seekTo(0); }
  }, [status.didJustFinish, player]);

  const toggle = async () => {
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      if (status.playing) player.pause(); else player.play();
    } catch { Alert.alert('Can’t play', 'This voice message could not be played.'); }
  };

  // A fixed pseudo-waveform: cheap, stable across renders, and looks like WhatsApp's.
  const bars = [6, 12, 18, 10, 22, 14, 8, 20, 16, 9, 19, 12, 7, 15, 21, 11, 6, 13, 18, 9];
  return (
    <View style={v.row}>
      <TouchableOpacity accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'} onPress={toggle} style={[v.play, { backgroundColor: tint }]}>
        <Feather name={status.playing ? 'pause' : 'play'} size={18} color="#111" />
      </TouchableOpacity>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={v.wave}>
          {bars.map((h, i) => (
            <View key={i} style={[v.bar, { height: h, backgroundColor: i / bars.length <= progress ? tint : muted }]} />
          ))}
        </View>
        <Text style={[v.time, { color: muted }]}>{formatDuration(status.playing || status.currentTime ? status.currentTime * 1000 : total)}</Text>
      </View>
    </View>
  );
}

/**
 * Hold-free recorder bar: tap the mic to start, then send or discard — the most reliable
 * pattern across iOS and Android without a gesture library.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [active, setActive] = useState(false);

  const start = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone needed', 'Allow microphone access to send voice messages.');
      return false;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setActive(true);
    return true;
  };

  const stop = async () => {
    const duration = state.durationMillis;
    await recorder.stop();
    setActive(false);
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    return { uri: recorder.uri, durationMs: duration };
  };

  const cancel = async () => {
    try { await recorder.stop(); } catch { /* already stopped */ }
    setActive(false);
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
  };

  return { active, durationMs: state.durationMillis || 0, start, stop, cancel };
}

export function RecordingBar({ durationMs, onCancel, onSend, accent, text }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={v.recording}>
      <TouchableOpacity accessibilityLabel="Discard voice message" onPress={onCancel} style={v.recBtn}><Feather name="trash-2" size={20} color="#FF5C5C" /></TouchableOpacity>
      <Animated.View style={[v.dot, { opacity: pulse }]} />
      <Text style={{ color: text, fontSize: 16, fontWeight: '700', flex: 1 }}>{formatDuration(durationMs)}  Recording…</Text>
      <TouchableOpacity accessibilityLabel="Send voice message" onPress={onSend} style={[v.send, { backgroundColor: accent }]}><Feather name="send" size={18} color="#111" /></TouchableOpacity>
    </View>
  );
}

const v = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200 },
  play: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  bar: { width: 3, borderRadius: 2 },
  time: { fontSize: 11, fontWeight: '600' },
  recording: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, minHeight: 48 },
  recBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30' },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
