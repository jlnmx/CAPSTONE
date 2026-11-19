export type CurrentAddressParts = {
  houseNumber: string;
  street: string;
  village: string;
  barangay: string;
};

export const EMPTY_CURRENT_ADDRESS: CurrentAddressParts = {
  houseNumber: '',
  street: '',
  village: '',
  barangay: '',
};

export const BINAN_CITY = 'Biñan City';

export const BINAN_BARANGAYS = [
  'Biñan',
  'Bungahan',
  'Canlalay',
  'Casile',
  'De La Paz',
  'Ganado',
  'Langkiwa',
  'Loma',
  'Malaban',
  'Malamig',
  'Mamplasan',
  'Platero',
  'Poblacion',
  'San Antonio',
  'San Francisco (Halang)',
  'San Jose',
  'San Vicente',
  'Santo Domingo',
  'Santo Niño',
  'Santo Tomas',
  'Soro-Soro',
  'Timbao',
  'Tubigan',
  'Zapote',
] as const;

function normalizeBarangay(value: string): string {
  return value
    .replace(/^(?:barangay|brgy\.?)\s*/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function formatCurrentAddress(parts: CurrentAddressParts): string {
  return [
    parts.houseNumber.trim(),
    parts.street.trim(),
    parts.village.trim(),
    parts.barangay.trim() ? `Brgy. ${parts.barangay.trim()}` : '',
    BINAN_CITY,
  ].filter(Boolean).join(', ');
}

export function isCurrentAddressComplete(parts: CurrentAddressParts): boolean {
  return Boolean(parts.houseNumber.trim() && parts.barangay.trim());
}

export function parseCurrentAddress(value: string): CurrentAddressParts {
  const segments = value.split(',').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) return { ...EMPTY_CURRENT_ADDRESS };

  const localSegments = segments.filter((segment) => !/^(?:Biñan City|Biñan|Laguna)$/i.test(segment));
  const barangayIndex = localSegments.findIndex((segment) => {
    const normalized = normalizeBarangay(segment);
    return BINAN_BARANGAYS.some((barangay) => normalizeBarangay(barangay) === normalized);
  });

  if (barangayIndex < 0) {
    return {
      ...EMPTY_CURRENT_ADDRESS,
      street: localSegments.join(', '),
    };
  }

  const addressSegments = localSegments.slice(0, barangayIndex);
  const [houseNumber, ...streetAndVillage] = addressSegments.length > 1
    ? addressSegments
    : ['', ...addressSegments];
  return {
    houseNumber,
    street: streetAndVillage[0] ?? '',
    village: streetAndVillage.slice(1).join(', '),
    barangay: BINAN_BARANGAYS.find((barangay) => normalizeBarangay(barangay) === normalizeBarangay(localSegments[barangayIndex])) ?? '',
  };
}
