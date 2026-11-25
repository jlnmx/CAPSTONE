import type { AdminSnapshot, IncidentRecord } from './types';

type AnalyticsReportOptions = {
  scope: string;
  includeIncidents: boolean;
  includeEvacuation: boolean;
};

function csvCell(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const text = value == null ? '' : String(value);
  const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function buildIncidentCsv(incidents: IncidentRecord[]) {
  return buildCsv([
    [
      'Incident ID',
      'Type',
      'Severity',
      'Status',
      'Reported at (UTC)',
      'Location',
      'Description',
      'Latitude',
      'Longitude',
      'Sync status',
      'Response people',
      'Response organizations',
      'Response ETA (minutes)',
      'Action notes',
      'Response notes',
      'Incident photo count',
      'Response photo count',
    ],
    ...incidents.map((incident) => [
      incident.id,
      incident.type,
      incident.severity,
      incident.status,
      incident.createdAt,
      incident.location,
      incident.description,
      incident.latitude,
      incident.longitude,
      incident.syncStatus,
      incident.responsePeople,
      incident.responseOrganizations,
      incident.responseEtaMinutes,
      incident.actionNotes,
      incident.responseNotes,
      incident.photoUris?.length ?? 0,
      incident.responsePhotoUris?.length ?? 0,
    ]),
  ]);
}

export function downloadReportFile(filename: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function display(value: unknown) {
  return value == null || value === '' ? '—' : String(value);
}

function timestampUtc(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : value;
}

function displayDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

function groupCounts<T>(rows: T[], getLabel: (row: T) => string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const label = getLabel(row).trim() || 'Unspecified';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return [...counts].map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function monthSeries<T>(rows: T[], getDate: (row: T) => string, now: Date) {
  const months = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 11 + index, 1));
  const counts = new Map(months.map((month) => [`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`, 0]));
  rows.forEach((row) => {
    const date = new Date(getDate(row));
    if (!Number.isFinite(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return months.map((month) => {
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    return { label: month.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), count: counts.get(key) ?? 0, key };
  });
}

function renderBarChart(title: string, rows: Array<{ label: string; count: number }>, color = '#D45B92') {
  if (!rows.length) return '<p class="empty">No records available for this chart.</p>';
  const labelWidth = 210;
  const chartWidth = 760;
  const barWidth = chartWidth - labelWidth - 55;
  const rowHeight = 34;
  const chartHeight = rows.length * rowHeight + 18;
  const max = Math.max(1, ...rows.map((row) => row.count));
  const bars = rows.map((row, index) => {
    const y = index * rowHeight + 5;
    const width = Math.max(row.count ? 2 : 0, row.count / max * barWidth);
    return `<g><title>${escapeHtml(row.label)}: ${row.count}</title><text class="chart-label" x="0" y="${y + 14}">${escapeHtml(row.label)}</text><rect x="${labelWidth}" y="${y}" width="${barWidth}" height="19" rx="5" class="bar-track"/><rect x="${labelWidth}" y="${y}" width="${width.toFixed(1)}" height="19" rx="5" fill="${color}"/><text class="chart-value" x="${labelWidth + barWidth + 10}" y="${y + 14}">${row.count}</text></g>`;
  }).join('');
  return `<svg class="bar-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="${escapeHtml(title)}">${bars}</svg>`;
}

function renderMonthChart(title: string, rows: Array<{ label: string; count: number }>, color = '#91BCDD') {
  if (!rows.length) return '<p class="empty">No records available for this chart.</p>';
  const width = 760;
  const height = 260;
  const left = 38;
  const top = 18;
  const chartHeight = 180;
  const chartWidth = width - left - 12;
  const max = Math.max(1, ...rows.map((row) => row.count));
  const slot = chartWidth / rows.length;
  const bars = rows.map((row, index) => {
    const barHeight = row.count ? Math.max(2, row.count / max * chartHeight) : 1;
    const x = left + index * slot + slot * 0.2;
    const y = top + chartHeight - barHeight;
    return `<g><title>${escapeHtml(row.label)}: ${row.count}</title><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(slot * 0.6).toFixed(1)}" height="${barHeight.toFixed(1)}" rx="4" fill="${color}"/><text class="chart-value" text-anchor="middle" x="${(x + slot * 0.3).toFixed(1)}" y="${Math.max(12, y - 5).toFixed(1)}">${row.count}</text><text class="chart-axis" text-anchor="middle" x="${(left + index * slot + slot / 2).toFixed(1)}" y="${top + chartHeight + 21}">${escapeHtml(row.label)}</text></g>`;
  }).join('');
  const grid = [0, 0.5, 1].map((fraction) => {
    const y = top + chartHeight - fraction * chartHeight;
    return `<line class="grid-line" x1="${left}" y1="${y}" x2="${width - 10}" y2="${y}"/><text class="chart-axis" text-anchor="end" x="${left - 7}" y="${y + 4}">${Math.round(max * fraction)}</text>`;
  }).join('');
  return `<svg class="month-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">${grid}${bars}</svg>`;
}

function renderTable(headers: string[], rows: Array<Array<unknown>>) {
  if (!rows.length) return '<p class="empty">No records available.</p>';
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(display(cell))}</td>`).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function metricCard(label: string, value: string | number, detail: string) {
  return `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`;
}

export function buildAnalyticsReportHtml(data: AdminSnapshot, options: AnalyticsReportOptions) {
  const now = new Date();
  const incidents = options.includeIncidents ? data.incidents : [];
  const evacuees = options.includeEvacuation ? data.evacuees : [];
  const centers = options.includeEvacuation ? data.centers : [];
  const resolved = incidents.filter((incident) => incident.status.toLowerCase() === 'resolved').length;
  const active = incidents.length - resolved;
  const resolutionRate = incidents.length ? Math.round(resolved / incidents.length * 100) : 0;
  const openCenters = centers.filter((center) => center.status !== 'closed');
  const capacity = openCenters.reduce((total, center) => total + Math.max(0, center.capacity), 0);
  const occupied = openCenters.reduce((total, center) => total + Math.max(0, center.currentOccupancy), 0);
  const utilization = capacity ? Math.round(occupied / capacity * 100) : 0;
  const incidentStatuses = groupCounts(incidents, (incident) => incident.status.replace(/[_-]/g, ' '));
  const incidentTypes = groupCounts(incidents, (incident) => incident.type);
  const incidentMonths = monthSeries(incidents, (incident) =>   timestampUtc(incident.createdAt), now);
  const evacueeMonths = monthSeries(evacuees, (evacuee) => evacuee.createdAt, now);
  const byCenter = groupCounts(evacuees, (evacuee) => evacuee.centerName);
  const byBarangay = groupCounts(evacuees, (evacuee) => evacuee.barangay);
  const ageBands = [
    { label: '0–5', count: evacuees.filter((item) => item.age != null && item.age >= 0 && item.age <= 5).length },
    { label: '6–12', count: evacuees.filter((item) => item.age != null && item.age >= 6 && item.age <= 12).length },
    { label: '13–17', count: evacuees.filter((item) => item.age != null && item.age >= 13 && item.age <= 17).length },
    { label: '18–59', count: evacuees.filter((item) => item.age != null && item.age >= 18 && item.age <= 59).length },
    { label: '60+', count: evacuees.filter((item) => item.age != null && item.age >= 60).length },
    { label: 'Unspecified', count: evacuees.filter((item) => item.age == null || !Number.isFinite(item.age) || item.age < 0).length },
  ];
  const centerUtilization = centers.map((center) => ({
    label: center.name,
    count: center.capacity > 0 ? Math.round(center.currentOccupancy / center.capacity * 100) : 0,
  })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const metrics = [
    ...(options.includeIncidents ? [
      metricCard('Incidents', incidents.length, `${active} active · ${resolved} resolved`),
      metricCard('Resolution rate', `${resolutionRate}%`, 'Resolved incidents / all incidents'),
      metricCard('Active responders', data.activePersonnel, 'Currently active field personnel'),
    ] : []),
    ...(options.includeEvacuation ? [
      metricCard('Evacuee records', evacuees.length, 'Registered evacuees and household members'),
      metricCard('Center utilization', capacity ? `${utilization}%` : '—', `${occupied} occupied of ${capacity} available places`),
      metricCard('Evacuation centers', centers.length, `${openCenters.length} not marked closed`),
    ] : []),
  ].join('');
  const incidentSections = options.includeIncidents ? `
    <section class="section">
      <div class="section-title"><span>01</span><div><h2>Incident analysis</h2><p>Status mix, incident categories, and monthly report volume.</p></div></div>
      <div class="chart-grid">
        <article class="chart-card"><h3>Incidents by status</h3>${renderBarChart('Incidents by status', incidentStatuses)}</article>
        <article class="chart-card"><h3>Incidents by type</h3>${renderBarChart('Incidents by type', incidentTypes, '#A84F7D')}</article>
        <article class="chart-card chart-card-wide"><h3>Monthly incident trend</h3><p class="subtle">Last 12 calendar months, based on report creation date.</p>${renderMonthChart('Monthly incident trend', incidentMonths, '#D45B92')}</article>
      </div>
      <article class="data-card"><h3>Incident status breakdown</h3>${renderTable(['Status', 'Incident count', 'Share'], incidentStatuses.map((row) => [row.label, row.count, incidents.length ? `${Math.round(row.count / incidents.length * 100)}%` : '0%']))}</article>
      <article class="data-card"><h3>Incident type breakdown</h3>${renderTable(['Incident type', 'Incident count', 'Share'], incidentTypes.map((row) => [row.label, row.count, incidents.length ? `${Math.round(row.count / incidents.length * 100)}%` : '0%']))}</article>
      <article class="data-card"><h3>Monthly incident counts</h3>${renderTable(['Month', 'Incident count'], incidentMonths.map((row) => [row.label, row.count]))}</article>
      <article class="data-card"><h3>Detailed incident records</h3>${renderTable(
        ['Incident ID', 'Type', 'Severity', 'Status', 'Reported', 'Location', 'Description', 'Sync status', 'Latitude', 'Longitude', 'Response people', 'Response organizations', 'ETA minutes', 'Action notes', 'Response notes', 'Photo count', 'Response photo count'],
        incidents.map((incident) => [
          incident.id, incident.type, incident.severity, incident.status, displayDate(incident.createdAt), incident.location, incident.description,
          incident.syncStatus, incident.latitude, incident.longitude, incident.responsePeople, incident.responseOrganizations,
          incident.responseEtaMinutes, incident.actionNotes, incident.responseNotes, incident.photoUris?.length ?? 0, incident.responsePhotoUris?.length ?? 0,
        ]),
      )}</article>
    </section>` : '';
  const evacuationSections = options.includeEvacuation ? `
    <section class="section">
      <div class="section-title"><span>${options.includeIncidents ? '02' : '01'}</span><div><h2>Evacuation analysis</h2><p>Registration trends, evacuee distribution, and center capacity.</p></div></div>
      <div class="chart-grid">
        <article class="chart-card chart-card-wide"><h3>Monthly evacuee registrations</h3><p class="subtle">Last 12 calendar months. Counts include household members.</p>${renderMonthChart('Monthly evacuee registrations', evacueeMonths, '#91BCDD')}</article>
        <article class="chart-card"><h3>Registrations by center</h3>${renderBarChart('Evacuee records by center', byCenter, '#6D91AD')}</article>
        <article class="chart-card"><h3>Evacuee age groups</h3>${renderBarChart('Evacuee records by age group', ageBands, '#A84F7D')}</article>
        <article class="chart-card chart-card-wide"><h3>Center occupancy</h3><p class="subtle">Occupied places as a percentage of stated capacity.</p>${renderBarChart('Center occupancy percentages', centerUtilization, '#D45B92')}</article>
      </div>
      <article class="data-card"><h3>Registrations by center</h3>${renderTable(['Evacuation center', 'Evacuee records'], byCenter.map((row) => [row.label, row.count]))}</article>
      <article class="data-card"><h3>Registrations by barangay / address</h3>${renderTable(['Barangay or address', 'Evacuee records'], byBarangay.map((row) => [row.label, row.count]))}</article>
      <article class="data-card"><h3>Monthly registration counts</h3>${renderTable(['Month', 'Evacuee records'], evacueeMonths.map((row) => [row.label, row.count]))}</article>
      <article class="data-card"><h3>Evacuee register details</h3><p class="subtle">Names, contact details, and profile photos are omitted.</p>${renderTable(
        ['Age', 'Barangay / address', 'Evacuation center', 'Status', 'Registered'],
        evacuees.map((evacuee) => [
          evacuee.age,
          evacuee.barangay,
          evacuee.centerName,
          evacuee.status,
          displayDate(evacuee.createdAt),
        ]),
      )}</article>
      <article class="data-card"><h3>Evacuation center capacity</h3>${renderTable(
        ['Center', 'Location', 'Status', 'Capacity', 'Occupancy', 'Available places', 'Utilization'],
        centers.map((center) => [
          center.name, center.location, center.status, center.capacity, center.currentOccupancy,
          Math.max(0, center.capacity - center.currentOccupancy),
          center.capacity ? `${Math.round(center.currentOccupancy / center.capacity * 100)}%` : '—',
        ]),
      )}</article>
    </section>` : '';
  const dataNotice = data.source === 'remote'
    ? 'All requested data sources reported successfully.'
    : 'Some requested data sources were unavailable during export. Treat zero or missing counts as incomplete, not confirmed absence.';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HANDA Operational Analytics</title>
<style>
:root{color-scheme:light;--ink:#25212a;--muted:#706875;--line:#e8e2e7;--surface:#fff;--soft:#faf8fa;--pink:#D45B92;--deep:#A84F7D;--blue:#6D91AD}
*{box-sizing:border-box}body{margin:0;background:#f5f7f9;color:var(--ink);font:14px/1.5 "Segoe UI",Arial,sans-serif}
.report{max-width:1180px;margin:0 auto;padding:32px 28px 56px}
.masthead{padding:27px 30px;border-radius:16px;background:linear-gradient(115deg,#7D567E,#A84F7D 62%,#D45B92);color:#fff}
.brand{font-size:11px;font-weight:800;letter-spacing:2px;opacity:.82}.masthead h1{margin:12px 0 5px;font-size:30px;letter-spacing:-.7px}.masthead p{margin:0;opacity:.88}
.mast-meta{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:18px;font-size:11px}.actions{display:flex;justify-content:flex-end;margin:14px 0}
.actions button{padding:9px 14px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font-weight:700;cursor:pointer}
.notice{padding:12px 14px;margin:14px 0;border:1px solid #f1d7a8;border-radius:9px;color:#795710;background:#fff9ec;font-size:12px}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:18px 0 26px}.metric{display:grid;gap:6px;padding:15px;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:0 3px 12px #29202b08}
.metric span{color:var(--muted);font-size:11px;font-weight:700}.metric strong{font-size:25px;line-height:1.15}.metric small{color:var(--muted);font-size:10px}
.section{margin-top:30px}.section-title{display:flex;align-items:center;gap:12px;margin-bottom:14px}.section-title>span{display:grid;width:36px;height:36px;place-items:center;border-radius:10px;color:var(--deep);background:#fff1f6;font-weight:850}.section-title h2{margin:0;font-size:19px}.section-title p,.subtle{margin:3px 0 0;color:var(--muted);font-size:11px}
.chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.chart-card,.data-card{min-width:0;padding:16px;margin:0 0 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:0 3px 12px #29202b08}
.chart-card h3,.data-card h3{margin:0 0 10px;font-size:13px}.chart-card-wide{grid-column:1/-1}
.bar-chart,.month-chart{display:block;width:100%;height:auto;overflow:visible}.chart-label{fill:#4d4651;font-size:11px}.chart-value{fill:#38313b;font-size:10px;font-weight:700}.chart-axis{fill:#706875;font-size:9px}.bar-track{fill:#f1edf1}.grid-line{stroke:#e8e2e7;stroke-width:1}
.table-wrap{width:100%;overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:10px;text-align:left}th{position:sticky;top:0;padding:9px 8px;border-bottom:1px solid var(--line);color:#665c68;background:#faf8fa;font-size:9px;white-space:nowrap}td{max-width:360px;padding:8px;border-bottom:1px solid #eee9ee;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#fcfbfc}
.empty{padding:20px;color:var(--muted);font-size:11px}.footer{padding-top:18px;margin-top:30px;border-top:1px solid var(--line);color:var(--muted);font-size:10px}.method{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:10px}.method span{padding:9px;border-radius:8px;background:#fff}
@media(max-width:720px){.report{padding:16px 12px 32px}.masthead{padding:20px}.masthead h1{font-size:24px}.chart-grid{grid-template-columns:1fr}.chart-card-wide{grid-column:auto}.chart-card{overflow:hidden}}
@media print{body{background:#fff}.report{max-width:none;padding:0}.masthead{print-color-adjust:exact;-webkit-print-color-adjust:exact}.metric,.chart-card,.data-card{break-inside:avoid;box-shadow:none}.actions{display:none}.table-wrap{overflow:visible}th{position:static}section{break-inside:auto}}
</style>
</head>
<body>
<main class="report">
  <header class="masthead"><div class="brand">HANDA · COMMAND CENTER</div><h1>Operational Analytics Report</h1><p>Incident response and evacuation operations overview</p><div class="mast-meta"><span>Scope: ${escapeHtml(options.scope)}</span><span>Generated: ${escapeHtml(now.toLocaleString())}</span><span>Data status: ${escapeHtml(data.source === 'remote' ? 'Complete' : 'Incomplete')}</span></div></header>
  <div class="actions"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
  ${data.source !== 'remote' ? `<aside class="notice">${escapeHtml(dataNotice)}</aside>` : ''}
  <section class="metrics">${metrics || '<p class="empty">No analytics are available for this account scope.</p>'}</section>
  ${incidentSections}
  ${evacuationSections}
  <footer class="footer"><strong>Definitions and data notes</strong><div class="method"><span>Active incident: any status other than resolved.</span><span>Resolution rate: resolved incidents divided by all incidents.</span><span>Center utilization: occupancy divided by capacity for centers not marked closed.</span><span>Evacuee totals include linked household members; personal names, photos, and contact details are excluded from this report.</span><span>Incident reporter identity and contact details are excluded from exported report data.</span><span>${escapeHtml(dataNotice)}</span></div><p>HANDA operational report · Generated ${escapeHtml(now.toISOString())}</p></footer>
</main>
</body>
</html>`;
}
