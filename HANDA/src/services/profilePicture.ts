import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { authenticatedFetch } from './apiClient';

const AVATAR_SIZE = 320;

/** Lets the user choose a photo and returns it as a square, compressed JPEG data URI. Returns null when cancelled. */
export async function pickProfilePicture(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted && permission.accessPrivileges !== 'limited') {
    throw new Error('Allow photo access to choose a profile picture.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const shortestSide = Math.min(asset.width, asset.height);
  const resized = await manipulateAsync(
    asset.uri,
    [
      { crop: { originX: Math.floor((asset.width - shortestSide) / 2), originY: Math.floor((asset.height - shortestSide) / 2), width: shortestSide, height: shortestSide } },
      { resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } },
    ],
    { compress: 0.7, format: SaveFormat.JPEG, base64: true },
  );
  if (!resized.base64) throw new Error('The photo could not be processed. Try a different image.');
  return `data:image/jpeg;base64,${resized.base64}`;
}

export async function saveProfilePicture(dataUri: string): Promise<string | null> {
  const response = await authenticatedFetch('/api/v1/auth/profile-picture', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profilePicture: dataUri }),
  });
  const result = await response.json().catch(() => null) as { profilePicture?: string | null; detail?: string } | null;
  if (!response.ok) throw new Error(typeof result?.detail === 'string' ? result.detail : 'The profile picture could not be saved.');
  return result?.profilePicture ?? null;
}

export async function removeProfilePicture(): Promise<void> {
  const response = await authenticatedFetch('/api/v1/auth/profile-picture', { method: 'DELETE' });
  if (!response.ok) throw new Error('The profile picture could not be removed.');
}
