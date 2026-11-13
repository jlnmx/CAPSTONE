export const RESPONDER_ORGANIZATIONS = ['PNP', 'BFP', 'POSO', 'BCDRRMO'] as const;
export type ResponderOrganization = typeof RESPONDER_ORGANIZATIONS[number];

export function parseOrganizations(value: string): { selected: ResponderOrganization[]; other: string } {
  const selected: ResponderOrganization[] = [];
  const other: string[] = [];
  value.split(',').map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const match = RESPONDER_ORGANIZATIONS.find((organization) => part === organization || part.startsWith(`${organization} (`));
    if (match) {
      if (!selected.includes(match)) selected.push(match);
    } else {
      other.push(part);
    }
  });
  return { selected, other: other.join(', ') };
}
