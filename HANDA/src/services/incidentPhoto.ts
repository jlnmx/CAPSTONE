import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export const MAX_INCIDENT_PHOTO_DATA_URI_CHARS = 1_500_000;

export async function prepareIncidentPhoto(uri: string, width: number): Promise<string> {
  const image = await manipulateAsync(
    uri,
    [{ resize: { width: Math.min(width, 1280) } }],
    { compress: 0.55, format: SaveFormat.JPEG, base64: true },
  );
  if (!image.base64) throw new Error('The photo could not be prepared for upload. Please try again.');
  const dataUri = `data:image/jpeg;base64,${image.base64}`;
  if (dataUri.length > MAX_INCIDENT_PHOTO_DATA_URI_CHARS) {
    throw new Error('Each incident photo must be smaller than 1.5 MB. Choose a smaller photo and try again.');
  }
  return dataUri;
}
