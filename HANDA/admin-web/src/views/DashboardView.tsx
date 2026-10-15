import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Building2, CircleCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAdminSnapshot } from '../api';
import type { AdminSnapshot } from '../types';
import { EmptyState, InlineNotice, LoadingState, MetricCard, PageHeading } from '../components/UI';

const emptySnapshot: AdminSnapshot = { incidents: [], evacuees: [], centers: [], activePersonnel: 0, source: 'unavailable' };

export default function DashboardView() {
  const [data, setData] = useState(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const snapshot = await getAdminSnapshot();
      setData(snapshot);
      setError(snapshot.source === 'remote' ? '' : 'Some command data could not be reached. Values shown may be incomplete.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Command data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);
  const activeIncidents = data.incidents.filter((incident) => incident.status !== 'resolved').length;
  const week = useMemo(() => Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - offset));
    const dateKey = date.toISOString().slice(0, 10);
    return { day: date.toLocaleDateString('en', { weekday: 'short' }), count: data.evacuees.filter((item) => item.createdAt.slice(0, 10) === dateKey).length };
  }), [data.evacuees]);
  const maxCount = Math.max(1, ...week.map((point) => point.count));
  const attention = [
    { icon: AlertTriangle, title: 'Active incidents', detail: `${activeIncidents} report${activeIncidents === 1 ? '' : 's'} need response`, to: '/operations', tone: activeIncidents ? 'red' : 'green' },
    { icon: Building2, title: 'Center capacity', detail: `${data.centers.filter((center) => center.status === 'full').length} centers currently full`, to: '/centers', tone: 'amber' },
  ];

  return <div className="page-content dashboard-page">
    <PageHeading eyebrow="COMMAND OVERVIEW" title="Good morning" description="A live view of community readiness and field operations." action={<button className="button-secondary" onClick={() => void refresh()} disabled={loading}><Activity size={16} /> Refresh data</button>} />
    {error && <InlineNotice onRetry={() => void refresh()}>{error}</InlineNotice>}
    {loading ? <LoadingState label="Syncing command data" /> : <>
      <div className="metric-grid">
        <MetricCard label="Registered evacuees" value={data.evacuees.length} detail={data.source === 'remote' ? 'From HANDA records' : 'Data unavailable'} icon={Users} />
        <MetricCard label="Reported incidents" value={data.incidents.length} detail={`${activeIncidents} active response`} icon={AlertTriangle} tone={activeIncidents ? 'red' : 'blue'} />
        <MetricCard label="Evacuation centers" value={data.centers.length} detail={`${data.centers.filter((center) => center.status !== 'closed').length} currently open`} icon={Building2} tone="blue" />
        <MetricCard label="Active personnel" value={data.activePersonnel} detail="Responders on record" icon={CircleCheck} tone="amber" />
      </div>

      <div className="dashboard-grid">
        <section className="surface-panel activity-panel">
          <div className="panel-heading"><div><p className="eyebrow">LAST 7 DAYS</p><h2>Evacuee registrations</h2><p className="panel-subtitle">Daily registrations across the response network</p></div><Link className="text-link" to="/evacuees">View directory <ArrowRight size={15} /></Link></div>
          {data.evacuees.length ? <div className="chart-area" role="img" aria-label="Evacuee registration count over the past seven days">
            {week.map((point) => <div className="chart-column" key={point.day}><span className="chart-count">{point.count}</span><div className="chart-track"><span className="chart-bar" style={{ height: `${Math.max(point.count ? 12 : 4, point.count / maxCount * 100)}%` }} /></div><span className="chart-label">{point.day}</span></div>)}
          </div> : <EmptyState title="No registrations yet" detail="New evacuee registrations will appear here." />}
        </section>

        <section className="surface-panel incident-panel">
          <div className="panel-heading"><div><p className="eyebrow">RESPONSE STATUS</p><h2>Incident overview</h2><p className="panel-subtitle">Current workload</p></div><Link className="icon-link" to="/operations" aria-label="Open operations"><ArrowRight size={17} /></Link></div>
          <div className="incident-total"><strong>{data.incidents.length}</strong><span>reported incidents</span></div>
          <div className="incident-meter"><span style={{ width: `${data.incidents.length ? activeIncidents / data.incidents.length * 100 : 0}%` }} /></div>
          <div className="incident-legend"><span><i className="legend-dot dot-red" /> Active <strong>{activeIncidents}</strong></span><span><i className="legend-dot dot-slate" /> Resolved <strong>{data.incidents.length - activeIncidents}</strong></span></div>
        </section>
      </div>

      <section className="attention-section"><div className="section-heading"><div><p className="eyebrow">PRIORITY CHECK</p><h2>Needs attention</h2></div><Link className="text-link" to="/operations">Open operations <ArrowRight size={15} /></Link></div>
        <div className="attention-list">{attention.map((item) => { const Icon = item.icon; return <Link className="attention-row" key={item.title} to={item.to}><span className={`attention-icon attention-${item.tone}`}><Icon size={18} /></span><span className="attention-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRight size={16} className="attention-arrow" /></Link>; })}</div>
      </section>
    </>}</div>;
}