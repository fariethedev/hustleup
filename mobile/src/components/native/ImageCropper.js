import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from './Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

/**
 * In-app cropper: pinch to zoom, drag to frame, and switch the shape (original, square,
 * portrait, landscape, story). Replaces the phone's own editor, which locks to one fixed
 * shape (always a square on iPhone).
 *
 * Any mounted <CropHost /> can present it; the most recently mounted host wins, so a host
 * placed inside a modal shows the cropper on top of that modal (iOS cannot stack a
 * root-level modal over an open one).
 */
const hosts = [];
export function cropImage(asset, aspect) {
  const host = hosts[hosts.length - 1];
  if (!host || !asset?.width || !asset?.height) return Promise.resolve(asset);
  return new Promise(resolve => host({ asset, aspect, resolve }));
}

const PRESETS = [['original', 'Original', 'maximize'], ['1:1', 'Square', 'square'], ['4:5', 'Portrait', 'smartphone'], ['16:9', 'Wide', 'monitor'], ['9:16', 'Story', 'film']];
const ratioOf = (key, asset) => {
  if (key === 'original') return asset.width / asset.height;
  const [a, b] = key.split(':').map(Number);
  return a / b;
};
const keyFor = aspect => {
  if (!aspect) return 'original';
  const k = `${aspect[0]}:${aspect[1]}`;
  return PRESETS.some(p => p[0] === k) ? k : 'original';
};
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const distance = touches => Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);

export function CropHost() {
  const [job, setJob] = useState(null);
  useEffect(() => {
    const open = next => setJob(next);
    hosts.push(open);
    return () => { const i = hosts.lastIndexOf(open); if (i >= 0) hosts.splice(i, 1); };
  }, []);
  if (!job) return null;
  return <Cropper key={job.asset.uri} job={job} onDone={result => { job.resolve(result); setJob(null); }} />;
}

function Cropper({ job, onDone }) {
  const { asset } = job;
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [preset, setPreset] = useState(keyFor(job.aspect));
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  // Frame: the chosen shape, as large as fits between the bars.
  const ratio = ratioOf(preset, asset);
  const maxW = screenW - 32;
  const maxH = screenH - insets.top - insets.bottom - 230;
  let fw = maxW, fh = maxW / ratio;
  if (fh > maxH) { fh = maxH; fw = fh * ratio; }
  const base = Math.max(fw / asset.width, fh / asset.height); // cover the frame at zoom 1
  const scale = base * zoom;
  const dw = asset.width * scale, dh = asset.height * scale;
  const limitX = (dw - fw) / 2, limitY = (dh - fh) / 2;
  const ox = clamp(offset.x, -limitX, limitX), oy = clamp(offset.y, -limitY, limitY);

  // Plain mutable holders (not refs): the gesture callbacks read the latest frame from them.
  const geo = useRef({});
  useEffect(() => { geo.current = { zoom, ox, oy }; });
  const gesture = useRef({});
  // eslint-disable-next-line react-hooks/refs -- refs are only read inside gesture callbacks
  const [pan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { gesture.current = { ...geo.current, pinch: null }; },
    onPanResponderMove: (e, g) => {
      const touches = e.nativeEvent.touches;
      if (touches.length >= 2) {
        const d = distance(touches);
        if (!gesture.current.pinch) gesture.current.pinch = { d, zoom: geo.current.zoom };
        setZoom(clamp(gesture.current.pinch.zoom * (d / gesture.current.pinch.d), 1, 6));
      } else if (!gesture.current.pinch) {
        setOffset({ x: gesture.current.ox + g.dx, y: gesture.current.oy + g.dy });
      }
    },
    onPanResponderRelease: () => { gesture.current = {}; },
  }));

  const choose = key => { setPreset(key); setZoom(1); setOffset({ x: 0, y: 0 }); };

  const done = async () => {
    setBusy(true);
    try {
      const crop = {
        originX: Math.max(0, Math.round((limitX - ox) / scale)),
        originY: Math.max(0, Math.round((limitY - oy) / scale)),
        width: Math.round(fw / scale),
        height: Math.round(fh / scale),
      };
      crop.width = Math.min(crop.width, asset.width - crop.originX);
      crop.height = Math.min(crop.height, asset.height - crop.originY);
      // Keep uploads light: nothing wider than 1600px.
      const actions = [{ crop }];
      if (crop.width > 1600) actions.push({ resize: { width: 1600 } });
      const out = await manipulateAsync(asset.uri, actions, { compress: 0.85, format: SaveFormat.JPEG });
      onDone({ ...asset, uri: out.uri, width: out.width, height: out.height, mimeType: 'image/jpeg', fileName: `photo_${Date.now()}.jpg` });
    } catch {
      onDone(asset); // fall back to the uncropped photo rather than losing it
    }
  };

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => onDone(null)} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48 }}>
          <Pressable onPress={() => onDone(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel"><Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Cancel</Text></Pressable>
          <Text style={{ flex: 1, textAlign: 'center', color: '#FFF', fontSize: 16, fontWeight: '800' }}>Crop</Text>
          <Pressable onPress={done} disabled={busy} hitSlop={10} accessibilityRole="button" accessibilityLabel="Use photo">
            {busy ? <ActivityIndicator color="#CDFF00" /> : <Text style={{ color: '#CDFF00', fontSize: 16, fontWeight: '800' }}>Done</Text>}
          </Pressable>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} {...pan.panHandlers}>
          <View style={{ width: fw, height: fh, overflow: 'hidden' }}>
            <Image source={{ uri: asset.uri }} style={{ position: 'absolute', width: dw, height: dh, left: (fw - dw) / 2 + ox, top: (fh - dh) / 2 + oy }} />
            {/* rule-of-thirds guide */}
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2, borderColor: '#FFFFFF' }}>
              {[1, 2].map(i => <View key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i * 100) / 3}%`, width: 1, backgroundColor: '#FFFFFF55' }} />)}
              {[1, 2].map(i => <View key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: `${(i * 100) / 3}%`, height: 1, backgroundColor: '#FFFFFF55' }} />)}
            </View>
          </View>
        </View>

        <Text style={{ color: '#FFFFFF90', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>Pinch to zoom · drag to move</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8 }}>
          {PRESETS.map(([key, label, icon]) => {
            const on = preset === key;
            return (
              <Pressable key={key} onPress={() => choose(key)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}
                style={{ alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 14, backgroundColor: on ? '#FFFFFF1F' : 'transparent', minWidth: 62 }}>
                <Feather name={icon} size={20} color={on ? '#CDFF00' : '#FFFFFFB0'} />
                <Text style={{ color: on ? '#CDFF00' : '#FFFFFFB0', fontSize: 11, fontWeight: '700' }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}
