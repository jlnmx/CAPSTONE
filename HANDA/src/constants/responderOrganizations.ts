export const RESPONDER_ORGANIZATIONS = ['PNP', 'BFP', 'POSO', 'BCDRRMO', 'Barangay Responder'] as const;
export type ResponderOrganization = typeof RESPONDER_ORGANIZATIONS[number];

export const BINAN_BARANGAYS = [
  'Biñan (Poblacion)', 'Bungahan', 'Canlalay', 'Casile', 'De La Paz', 'Ganado', 'Langkiwa', 'Loma',
  'Malaban', 'Malamig', 'Mamplasan', 'Platero', 'San Antonio', 'San Francisco (Halang)', 'San Jose',
  'San Vicente', 'Santo Domingo', 'Santo Niño', 'Santo Tomas', 'Soro-Soro', 'Timbao', 'Tubigan', 'Zapote',
] as const;

export function formatResponderOrganization(organization?: string | null, barangay?: string | null): string {
  if (!organization) return '';
  return organization === 'Barangay Responder' && barangay ? `Barangay Responder (Brgy. ${barangay})` : organization;
}

// Splits a saved "PNP, Barangay Responder (Brgy. Loma), Red Cross" string back into list choices and free text.
export function parseOrganizations(value: string): { selected: ResponderOrganization[]; barangay: string; other: string } {
  const selected: ResponderOrganization[] = [];
  const other: string[] = [];
  let barangay = '';
  value.split(',').map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const match = RESPONDER_ORGANIZATIONS.find((organization) => part === organization || part.startsWith(`${organization} (`));
    if (match) {
      if (!selected.includes(match)) selected.push(match);
      const detail = part.match(/^Barangay Responder \(Brgy\. (.+)\)$/);
      if (detail) barangay = detail[1];
    } else {
      other.push(part);
    }
  });
  return { selected, barangay, other: other.join(', ') };
}
