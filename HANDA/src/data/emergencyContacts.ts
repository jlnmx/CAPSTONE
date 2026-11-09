import type { ImageSourcePropType } from 'react-native';

export type ContactNumber = { label: string; number: string };

export type EmergencyContact = {
  id: string;
  name: string;
  title: string;
  summary: string;
  description: string;
  logo: ImageSourcePropType;
  color: string;
  numbers: ContactNumber[];
  address: string;
  website?: string;
};

const CITY_HALL = 'Biñan City Hall Compound, Brgy. Zapote, Biñan City, Laguna';

export const emergencyContacts: EmergencyContact[] = [
  {
    id: 'bcdrrmo',
    name: 'BCDRRMO',
    title: 'Biñan City Disaster Risk Reduction and Management Office',
    summary: 'Disaster response and rescue',
    description: 'The Biñan City Disaster Risk Reduction and Management Office (BCDRRMO) (C3) handles disaster management, emergency response, and rescue operations in Biñan City, Laguna.',
    logo: require('../../assets/logos/bcdrrmo.jpg'),
    color: '#D07B19',
    numbers: [
      { label: 'Smart (New)', number: '0968-185-8911' },
      { label: 'Smart', number: '0908-891-9711' },
      { label: 'Globe', number: '0917-120-8911' },
      { label: 'PLDT (Admin)', number: '(049) 536-2622' },
      { label: 'Intelco', number: '(049) 513-9111' },
    ],
    address: CITY_HALL,
  },
  {
    id: 'pnp',
    name: 'PNP',
    title: 'Philippine National Police',
    summary: 'Police assistance',
    description: 'The Philippine National Police (PNP; Filipino: Pambansang Pulisya ng Pilipinas) is the national police force of the Philippines. Its national headquarters is located at Camp Crame in Bagong Lipunan ng Crame, Quezon City. Currently, it has approximately 228,000 personnel to police a population in excess of 100 million.\n\nThe agency is administered and controlled by the National Police Commission and is part of the Department of the Interior and Local Government (DILG). Local police officers are operationally controlled by city or municipal mayors. DILG, on the other hand, organizes, trains and equips the PNP for the performance of police functions as a police force that is national in scope and civilian in character.',
    logo: require('../../assets/logos/pnp.jpg'),
    color: '#2A5793',
    numbers: [
      { label: 'Hotline', number: '(049) 513-5111' },
      { label: 'Globe / TM', number: '0916-261-9833' },
      { label: 'Smart / TNT / Sun', number: '0998-598-5631' },
      { label: 'Local landline (PLDT)', number: '(049) 513-5113' },
    ],
    address: CITY_HALL,
    website: 'https://pnp.gov.ph/',
  },
  {
    id: 'bfp',
    name: 'BFP',
    title: 'Bureau of Fire Protection',
    summary: 'Fire and rescue',
    description: 'The BFP is responsible for ensuring public safety through the prevention or suppression of all destructive fires on buildings, houses, and other similar structure, forests, and land transportation vehicles and equipment, ships/vessels docked at piers, wharves or anchored at major seaports, petroleum industry installations. It is also responsible for the enforcement of the Fire Code of the Philippines and other related laws, conduct investigations involving fire incidents and causes thereof including the filing of appropriate complaints/cases.',
    logo: require('../../assets/logos/bfp.png'),
    color: '#D59A1E',
    numbers: [
      { label: 'Landline (PLDT/Intelco)', number: '(049) 511-9111' },
      { label: 'Mobile (Cellular)', number: '0992-419-3585' },
    ],
    address: CITY_HALL,
    website: 'https://bfp.gov.ph/',
  },
  {
    id: 'poso',
    name: 'POSO',
    title: 'Public Order and Safety Office',
    summary: 'Traffic and road assistance',
    description: 'The Public Order and Safety Office (POSO) of Biñan City, Laguna handles local traffic enforcement, public safety, and emergency response.',
    logo: require('../../assets/logos/poso.jpg'),
    color: '#2A5793',
    numbers: [
      { label: 'POSO Hotline (Intelco)', number: '(049) 513-8888' },
      { label: 'POSO Hotline (PLDT / Local)', number: '(049) 523-5400 local 5320' },
    ],
    address: CITY_HALL,
  },
  {
    id: 'ospital',
    name: 'Ospital ng Biñan',
    title: 'Ospital ng Biñan',
    summary: 'Medical emergency',
    description: 'Ospital ng Biñan provides emergency medical care and hospital services for residents of Biñan City, Laguna.',
    logo: require('../../assets/logos/ospital.jpg'),
    color: '#1BAA8B',
    numbers: [{ label: 'Hotline', number: '(049) 511-4119' }],
    address: 'Ospital ng Biñan, Biñan City, Laguna',
  },
  {
    id: 'bjmp',
    name: 'BJMP',
    title: 'Bureau of Jail Management and Penology',
    summary: 'Jail management assistance',
    description: 'The Bureau of Jail Management and Penology (BJMP) manages and supervises city and municipal jails and provides assistance related to jail management.',
    logo: require('../../assets/logos/bjmp.jpg'),
    color: '#4D8540',
    numbers: [{ label: 'Hotline', number: '(049) 511-6324' }],
    address: 'BJMP Biñan City Jail, Biñan City, Laguna',
  },
];

export function getEmergencyContact(id: string | undefined): EmergencyContact | undefined {
  return emergencyContacts.find((contact) => contact.id === id);
}

export function toDialNumber(value: string): string {
  const [base, extension] = value.split(/\s+local\s+/i);
  const digits = base.replace(/[^0-9+]/g, '');
  return extension ? `${digits},${extension.replace(/\D/g, '')}` : digits;
}
