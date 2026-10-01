import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../api/client';

export const mediaUrl = (url) => {
  if (!url) return null;
  if (/^(https?:|file:|content:|data:|blob:)/i.test(url)) return url;
  return `${API_URL.replace(/\/api\/v1\/?$/, '')}/${url.replace(/^\//, '')}`;
};

// Native editing is incompatible with multiple selection. Add photos one at a time.
export async function pickCroppedPhoto(aspect = [4, 5]) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted && permission.accessPrivileges !== 'limited') {
    throw new Error('Allow photo library access to choose a photo.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsMultipleSelection: false,
    allowsEditing: true, aspect, quality: 0.85,
  });
  return result.canceled ? null : result.assets?.[0];
}

export function uploadAsset(asset) {
  const extension = asset.uri.split('?')[0].split('.').pop()?.toLowerCase();
  const type = asset.mimeType || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', mov: 'video/quicktime', mp4: 'video/mp4' }[extension]) || 'image/jpeg';
  return { uri: asset.uri, name: asset.uri.split('/').pop() || `photo.${extension || 'jpg'}`, type };
}
