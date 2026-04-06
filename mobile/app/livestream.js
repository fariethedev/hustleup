import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  Dimensions, Alert, SafeAreaView, KeyboardAvoidingView, Platform,
  Animated, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width, height } = Dimensions.get('window');
const LIME = '#CDFF00';
const BG = '#050505';

// Mock chat messages
const MOCK_CHAT = [
  { id: '1', user: 'Maya J.', text: '🔥🔥🔥', time: '0:12' },
  { id: '2', user: 'Jamal C.', text: 'This is so cool!', time: '0:30' },
  { id: '3', user: 'Sofia M.', text: 'Love this!!', time: '0:45' },
  { id: '4', user: 'Andre W.', text: 'Yooo 🙌', time: '1:02' },
  { id: '5', user: 'Aisha P.', text: 'Keep going!', time: '1:18' },
];

export default function LiveStreamScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isViewer = params.mode === 'viewer';
  const streamTitle = params.title || 'My Live Stream';

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('front');
  const [isMuted, setIsMuted] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [chatMessages, setChatMessages] = useState(MOCK_CHAT);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationRef = useRef(null);

  // Pulse animation for LIVE badge
  useEffect(() => {
    if (isLive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isLive]);

  // Duration timer
  useEffect(() => {
    if (isLive) {
      durationRef.current = setInterval(() => {
        setDuration(d => d + 1);
        // Simulate viewers joining/leaving
        setViewerCount(v => Math.max(0, v + Math.floor(Math.random() * 5) - 1));
      }, 1000);
      return () => clearInterval(durationRef.current);
    }
  }, [isLive]);

  // Simulate viewers joining when live starts
  const startLive = () => {
    setIsLive(true);
    setViewerCount(Math.floor(Math.random() * 20) + 5);
    setDuration(0);
  };

  const endLive = () => {
    Alert.alert('End Live', 'Are you sure you want to end the stream?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Stream', style: 'destructive', onPress: () => {
        setIsLive(false);
        clearInterval(durationRef.current);
        Alert.alert(
          'Stream Ended',
          `Duration: ${formatDuration(duration)}\nPeak viewers: ${viewerCount + 5}`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }},
    ]);
  };

  const formatDuration = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleCamera = () => setFacing(f => f === 'front' ? 'back' : 'front');

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const newMsg = {
      id: Date.now().toString(),
      user: 'You',
      text: chatInput.trim(),
      time: formatDuration(duration),
    };
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput('');
  };

  // Permission handling
  if (!permission) {
    return (
      <View style={s.permissionScreen}>
        <Feather name="loader" size={32} color={LIME} />
        <Text style={s.permissionText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={s.permissionScreen}>
        <View style={s.permissionCard}>
          <View style={s.permissionIconWrap}>
            <Feather name="video" size={48} color={LIME} />
          </View>
          <Text style={s.permissionTitle}>Camera Access Required</Text>
          <Text style={s.permissionSub}>
            To go live, HustleUp needs access to your camera and microphone.
          </Text>
          <TouchableOpacity style={s.permissionBtn} onPress={requestPermission}>
            <Text style={s.permissionBtnText}>Enable Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.permissionBackBtn} onPress={() => router.back()}>
            <Text style={s.permissionBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      {/* Camera Preview */}
      <CameraView
        style={s.camera}
        facing={facing}
        enableTorch={false}
      />

      {/* Overlay gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'transparent', 'transparent', 'rgba(0,0,0,0.8)']}
        locations={[0, 0.2, 0.6, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Top bar */}
      <SafeAreaView style={s.topBar}>
        <View style={s.topBarRow}>
          <TouchableOpacity style={s.closeBtn} onPress={isLive ? endLive : () => router.back()}>
            <Feather name="x" size={22} color="#FFF" />
          </TouchableOpacity>

          {isLive && (
            <View style={s.liveInfoRow}>
              <Animated.View style={[s.liveBadge, { opacity: pulseAnim }]}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>LIVE</Text>
              </Animated.View>
              <View style={s.durationBadge}>
                <Feather name="clock" size={10} color="#FFF" />
                <Text style={s.durationText}>{formatDuration(duration)}</Text>
              </View>
              <View style={s.viewerBadge}>
                <Feather name="eye" size={10} color="#FFF" />
                <Text style={s.viewerText}>{viewerCount}</Text>
              </View>
            </View>
          )}

          <View style={s.topBarRight}>
            <TouchableOpacity style={s.controlBtn} onPress={toggleCamera}>
              <Feather name="refresh-cw" size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={s.controlBtn} onPress={() => setIsMuted(!isMuted)}>
              <Feather name={isMuted ? 'mic-off' : 'mic'} size={18} color={isMuted ? '#FF3B30' : '#FFF'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stream title */}
        {isLive && (
          <View style={s.titleBar}>
            <Text style={s.titleText}>{streamTitle}</Text>
          </View>
        )}
      </SafeAreaView>

      {/* Chat overlay */}
      {isLive && showChat && (
        <View style={s.chatOverlay}>
          <FlatList
            data={chatMessages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={s.chatBubble}>
                <Text style={s.chatUser}>{item.user}</Text>
                <Text style={s.chatText}>{item.text}</Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            inverted={false}
            contentContainerStyle={{ gap: 6 }}
          />
        </View>
      )}

      {/* Bottom controls */}
      <KeyboardAvoidingView
        style={s.bottomBar}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {!isLive ? (
          /* Pre-live setup */
          <View style={s.setupContainer}>
            <View style={s.setupCard}>
              <Text style={s.setupTitle}>Ready to go live?</Text>
              <Text style={s.setupSub}>Your followers will be notified when you start streaming.</Text>
              <TouchableOpacity style={s.goLiveBtn} onPress={startLive} activeOpacity={0.85}>
                <View style={s.goLiveDot} />
                <Text style={s.goLiveText}>GO LIVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Live chat input */
          <View style={s.chatInputRow}>
            <TouchableOpacity style={s.chatToggle} onPress={() => setShowChat(!showChat)}>
              <Feather name={showChat ? 'message-circle' : 'message-square'} size={20} color="#FFF" />
            </TouchableOpacity>
            <View style={s.chatInputWrap}>
              <TextInput
                style={s.chatInput}
                placeholder="Say something..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={chatInput}
                onChangeText={setChatInput}
                returnKeyType="send"
                onSubmitEditing={sendChat}
              />
              <TouchableOpacity style={s.sendBtn} onPress={sendChat}>
                <Feather name="send" size={16} color={BG} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.endBtn} onPress={endLive}>
              <Text style={s.endBtnText}>END</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  camera: { ...StyleSheet.absoluteFillObject },

  // Permission
  permissionScreen: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center', padding: 32 },
  permissionCard: { alignItems: 'center', gap: 16, backgroundColor: '#111', borderRadius: 28, padding: 40, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  permissionIconWrap: { width: 100, height: 100, borderRadius: 30, backgroundColor: 'rgba(205,255,0,0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(205,255,0,0.2)' },
  permissionTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  permissionSub: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  permissionText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 16 },
  permissionBtn: { backgroundColor: LIME, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 20, width: '100%', alignItems: 'center' },
  permissionBtnText: { color: BG, fontSize: 16, fontWeight: '900' },
  permissionBackBtn: { paddingVertical: 12 },
  permissionBackText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '700' },

  // Top bar
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  topBarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  liveInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FF3B30', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  liveText: { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  durationBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  durationText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  viewerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  viewerText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  topBarRight: { flexDirection: 'row', gap: 8 },
  controlBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  titleBar: { marginHorizontal: 16, marginTop: 12, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  titleText: { color: '#FFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },

  // Chat overlay
  chatOverlay: { position: 'absolute', bottom: 90, left: 0, right: 0, height: 220, paddingHorizontal: 16 },
  chatBubble: { flexDirection: 'row', alignItems: 'baseline', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start', maxWidth: '80%' },
  chatUser: { color: LIME, fontSize: 12, fontWeight: '800' },
  chatText: { color: '#FFF', fontSize: 13, fontWeight: '500', flexShrink: 1 },

  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 40 },

  // Setup (pre-live)
  setupContainer: { alignItems: 'center', paddingHorizontal: 32 },
  setupCard: { backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  setupTitle: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  setupSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FF3B30', paddingHorizontal: 36, paddingVertical: 16, borderRadius: 30, marginTop: 8 },
  goLiveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF' },
  goLiveText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  // Chat input (live)
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chatToggle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  chatInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 22, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chatInput: { flex: 1, color: '#FFF', fontSize: 14, paddingVertical: 10 },
  sendBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: LIME, justifyContent: 'center', alignItems: 'center' },
  endBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22 },
  endBtnText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
});
