import * as ImagePicker from 'expo-image-picker';
import { cropImage } from '../components/native/ImageCropper';
import { API_URL } from '../api/client';

export const mediaUrl = (url) => {
  if (!url) return null;
  if (/^(https?:|file:|content:|data:|blob:)/i.test(url)) return url;
  return `${API_URL.replace(/\/api\/v1\/?$/, '')}/${url.replace(/^\//, '')}`;
};

// Picks one photo, then opens the in-app cropper (any shape, pinch and drag) starting on
// `aspect`. Returns null when the person cancels either step.
export async function pickCroppedPhoto(aspect = [4, 5]) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted && permission.accessPrivileges !== 'limited') {
    throw new Error('Allow photo library access to choose a photo.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsMultipleSelection: false,
    allowsEditing: false, quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return cropImage(result.assets[0], aspect);
}

export function uploadAsset(asset) {
  const extension = asset.uri.split('?')[0].split('.').pop()?.toLowerCase();
  const type = asset.mimeType || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', mov: 'video/quicktime', mp4: 'video/mp4' }[extension]) || 'image/jpeg';
  return { uri: asset.uri, name: asset.uri.split('/').pop() || `photo.${extension || 'jpg'}`, type };
}
