import { isActiveIncidentStatus } from '../incidentStatus';

describe('active incident visibility', () => {
  it('excludes resolved status regardless of casing or surrounding spaces', () => {
    expect(isActiveIncidentStatus('resolved')).toBe(false);
    expect(isActiveIncidentStatus(' Resolved ')).toBe(false);
  });

  it('keeps every non-resolved status active', () => {
    expect(isActiveIncidentStatus('reported')).toBe(true);
    expect(isActiveIncidentStatus('acknowledged')).toBe(true);
    expect(isActiveIncidentStatus('in_progress')).toBe(true);
  });
});
