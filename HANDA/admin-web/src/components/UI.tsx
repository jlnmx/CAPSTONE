import type { ComponentType, ReactNode } from 'react';
import { AlertTriangle, ArrowUpRight, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>;
}

export function MetricCard({ label, value, detail, icon: Icon, tone = 'green' }: { label: string; value: string | number; detail: string; icon: LucideIcon; tone?: 'green' | 'blue' | 'amber' | 'red' }) {
  return <section className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={18} strokeWidth={1.8} /></span></div><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></section>;
}

export function InlineNotice({ children, tone = 'warning', onRetry }: { children: ReactNode; tone?: 'warning' | 'error' | 'success'; onRetry?: () => void }) {
  const Icon = tone === 'error' ? AlertTriangle : tone === 'success' ? ArrowUpRight : AlertTriangle;
  return <div className={`inline-notice notice-${tone}`}><Icon size={17} /><span>{children}</span>{onRetry && <button className="notice-retry" onClick={onRetry}><RefreshCw size={14} /> Retry</button>}</div>;
}

export function LoadingState({ label = 'Loading records' }: { label?: string }) {
  return <div className="loading-state"><span className="loader" /><span>{label}</span></div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-mark"><RefreshCw size={19} /></span><strong>{title}</strong><span>{detail}</span></div>;
}