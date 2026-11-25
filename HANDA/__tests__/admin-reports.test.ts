import { buildAnalyticsReportHtml, buildIncidentCsv } from '../admin-web/src/reports';
import type { AdminSnapshot, IncidentRecord } from '../admin-web/src/types';

const incident: IncidentRecord = {
  id: 'incident-1',
  type: 'SOS - Other',
  description: '<img src=x onerror=alert(1)>',
  location: 'Biñan City',
  createdAt: '2026-11-24T06:49:41.800000+00:00',
  status: 'in_progress',
  syncStatus: 'synced',
  latitude: 14.3,
  longitude: 121.08,
  severity: 'high',
  actionNotes: 'Unit dispatched',
  responsePeople: '2',
  responseOrganizations: 'BCDRRMO',
  responseEtaMinutes: 8,
  responseNotes: 'Responders en route',
  photoUris: ['incident-photo'],
  responsePhotoUris: [],
  reporterName: 'Resident Name',
  reporterContact: '09171234567',
};

describe('operational report exports', () => {
  it('exports complete incident fields as UTF-8 CSV without formula execution', () => {
    const csv = buildIncidentCsv([{ ...incident, description: '=SUM(1,1)' }]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Biñan City"');
    expect(csv).toContain('"Description"');
    expect(csv).toContain('"Response notes"');
    expect(csv).toContain('"Incident photo count"');
    expect(csv).toContain("\"'=SUM(1,1)\"");
    expect(csv).not.toContain('09171234567');
  });

  it('builds a standalone chart report and escapes untrusted incident content', () => {
    const data: AdminSnapshot = {
      incidents: [incident],
      evacuees: [{
        id: 'evacuee-1',
        displayName: 'Private Person',
        age: null,
        barangay: 'Biñan',
        contactNumber: '09999999999',
        centerName: 'Central School',
        status: 'checked_in',
        createdAt: '2026-11-24T06:49:41.800000+00:00',
      }],
      centers: [{
        id: 'center-1',
        name: 'Central School',
        location: 'Biñan',
        capacity: 100,
        currentOccupancy: 40,
        status: 'available',
        coordinatorName: 'Coordinator',
        contactNumber: '09170000000',
        notes: '',
      }],
      activePersonnel: 3,
      source: 'remote',
    };

    const html = buildAnalyticsReportHtml(data, {
      scope: 'Full network',
      includeIncidents: true,
      includeEvacuation: true,
    });

    expect(html).toContain('<svg class="bar-chart"');
    expect(html).toContain('<svg class="month-chart"');
    expect(html).toContain('Detailed incident records');
    expect(html).toContain('Evacuee register details');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('09171234567');
    expect(html).not.toContain('09999999999');
    expect(html).toContain('Unspecified');
  });
});
