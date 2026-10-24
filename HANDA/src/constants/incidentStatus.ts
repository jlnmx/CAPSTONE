export type IncidentStatusKey = 'reported' | 'acknowledged' | 'in_progress' | 'resolved';

export const INCIDENT_STATUS_COLORS: Record<IncidentStatusKey, string> = {
  reported: '#D62828',
  acknowledged: '#F28C28',
  in_progress: '#1769AA',
  resolved: '#667085',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatusKey, string> = {
  reported: 'Reported',
  acknowledged: 'Acknowledged',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

export function incidentStatusColor(status: string | undefined | null): string {
  return INCIDENT_STATUS_COLORS[String(status ?? 'reported').toLowerCase() as IncidentStatusKey] ?? INCIDENT_STATUS_COLORS.reported;
}

export function incidentStatusLabel(status: string | undefined | null): string {
  const key = String(status ?? 'reported').toLowerCase() as IncidentStatusKey;
  return INCIDENT_STATUS_LABELS[key] ?? key.replace(/_/g, ' ');
}
