import { useEffect, useId } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Info,
    PackageSearch,
    X,
    XCircle,
} from 'lucide-react';
import { number, statusLabel } from '../data.js';
import { useStore } from '../store-context.js';

let activeModalLocks = 0;
let previousBodyOverflow = '';
let previousHtmlOverflow = '';

/** @param {{ title: import('react').ReactNode, description?: import('react').ReactNode, eyebrow?: import('react').ReactNode, actions?: import('react').ReactNode, breadcrumb?: import('react').ReactNode }} props */
export function PageHeader({ title, description = '', eyebrow = null, actions = null, breadcrumb = null }) {
    return (
        <div className="page-heading">
            <div>
                {(breadcrumb || eyebrow) && <div className="breadcrumb">{breadcrumb || eyebrow}</div>}
                <h1>{title}</h1>
                {description && <p>{description}</p>}
            </div>
            {actions && <div className="page-actions">{actions}</div>}
        </div>
    );
}

/** @param {{ status: string, children?: import('react').ReactNode, dot?: boolean }} props */
export function StatusBadge({ status, children = null, dot = true }) {
    const key = String(status).toLowerCase().replaceAll(' ', '-');
    return (
        <span className={`badge badge-${key}`}>
            {dot && <span className="badge-dot" />}
            {children || statusLabel[status] || status}
        </span>
    );
}

/** @param {{ icon: import('react').ComponentType<{ size?: number, strokeWidth?: number }>, label: import('react').ReactNode, value: import('react').ReactNode, note?: import('react').ReactNode, tone?: string, trend?: string | null, onClick?: (() => void) | null }} props */
export function StatCard({ icon: Icon, label, value, note = null, tone = 'blue', trend = null, onClick = null }) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag className={`stat-card ${onClick ? 'stat-card-button' : ''}`} onClick={onClick || undefined}>
            <div className={`stat-icon stat-${tone}`}><Icon size={19} strokeWidth={1.9} /></div>
            <div className="stat-copy">
                <span className="stat-label">{label}</span>
                <strong className="stat-value">{value}</strong>
                {(note || trend) && (
                    <span className={`stat-note ${trend === 'down' ? 'note-danger' : trend === 'up' ? 'note-positive' : ''}`}>
                        {note}
                    </span>
                )}
            </div>
        </Tag>
    );
}

/** @param {{ title: import('react').ReactNode, subtitle?: import('react').ReactNode, action?: import('react').ReactNode }} props */
export function CardHeader({ title, subtitle = '', action = null }) {
    return (
        <div className="card-header">
            <div>
                <h2>{title}</h2>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {action && <div className="card-header-action">{action}</div>}
        </div>
    );
}

/** @param {{ open: boolean, onClose: () => void, title: import('react').ReactNode, subtitle?: import('react').ReactNode, children?: import('react').ReactNode, footer?: import('react').ReactNode, size?: string }} props */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'medium' }) {
    const titleId = useId();
    useEffect(() => {
        if (!open) return undefined;
        if (activeModalLocks === 0) {
            previousBodyOverflow = document.body.style.overflow;
            previousHtmlOverflow = document.documentElement.style.overflow;
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        }
        activeModalLocks += 1;
        const onKey = (/** @type {KeyboardEvent} */ event) => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            activeModalLocks = Math.max(0, activeModalLocks - 1);
            if (activeModalLocks === 0) {
                document.body.style.overflow = previousBodyOverflow;
                document.documentElement.style.overflow = previousHtmlOverflow;
            }
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!open) return null;
    return (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
            <section className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <header className="modal-header">
                    <div>
                        <h2 id={titleId}>{title}</h2>
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                    <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
                </header>
                <div className="modal-body">{children}</div>
                {footer && <footer className="modal-footer">{footer}</footer>}
            </section>
        </div>
    );
}

/** @param {{ label?: import('react').ReactNode, error?: import('react').ReactNode, hint?: import('react').ReactNode, required?: boolean, children?: import('react').ReactNode, className?: string }} props */
export function Field({ label, error, hint, required, children, className = '' }) {
    return (
        <div className={`form-field ${error ? 'field-error' : ''} ${className}`}>
            {label && <label>{label}{required && <span className="required"> *</span>}</label>}
            {children}
            {error ? <span className="field-message error-message"><XCircle size={13} />{error}</span> : hint ? <span className="field-message">{hint}</span> : null}
        </div>
    );
}

/** @param {{ checked: boolean, onChange: (checked: boolean) => void, label?: import('react').ReactNode, description?: import('react').ReactNode, disabled?: boolean }} props */
export function Toggle({ checked, onChange, label, description, disabled = false }) {
    return (
        <label className={`toggle-row ${disabled ? 'disabled' : ''}`}>
            <span>
                {label && <strong>{label}</strong>}
                {description && <small>{description}</small>}
            </span>
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
            <span className="toggle-track" aria-hidden="true"><span /></span>
        </label>
    );
}

/** @param {{ page: number, pageCount: number, onPageChange: (page: number) => void, total?: number, pageSize: number }} props */
export function Pagination({ page, pageCount, onPageChange, total, pageSize }) {
    if (pageCount <= 1 && !total) return null;
    const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
    const visible = pages.filter((item) => pageCount <= 6 || item === 1 || item === pageCount || Math.abs(item - page) <= 1);
    return (
        <div className="pagination-wrap">
            {typeof total === 'number' && (
                <span className="pagination-summary">
                    Showing {total ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, total)} of {total} records
                </span>
            )}
            {pageCount > 1 && (
                <nav className="pagination" aria-label="Pagination">
                    <button className="page-button" disabled={page === 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button>
                    {visible.map((item, index) => (
                        <span key={item} className="page-number-wrap">
                            {index > 0 && item - visible[index - 1] > 1 && <span className="page-ellipsis">…</span>}
                            <button className={`page-button ${item === page ? 'active' : ''}`} onClick={() => onPageChange(item)} aria-label={`Page ${item}`} aria-current={item === page ? 'page' : undefined}>{item}</button>
                        </span>
                    ))}
                    <button className="page-button" disabled={page === pageCount} onClick={() => onPageChange(page + 1)} aria-label="Next page"><ChevronRight size={17} /></button>
                </nav>
            )}
        </div>
    );
}

/** @param {{ title?: string, description?: string, action?: import('react').ReactNode, icon?: import('react').ComponentType<{ size?: number }> }} props */
export function EmptyState({ title = 'Nothing found', description = 'Try changing your search or filters.', action, icon: Icon = PackageSearch }) {
    return (
        <div className="empty-state">
            <div className="empty-icon"><Icon size={27} /></div>
            <h3>{title}</h3>
            <p>{description}</p>
            {action}
        </div>
    );
}

/** @param {{ name?: string, src?: string | null, size?: string }} props */
export function Avatar({ name = '', src, size = 'medium' }) {
    const initials = name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
    return (
        <span className={`avatar avatar-${size}`}>
            <span>{initials}</span>
            {src && <img src={src} alt={name} onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
        </span>
    );
}

/** @param {{ data: Array<{ label: string, value: number, orders?: number }>, color?: string, valuePrefix?: string, height?: number }} props */
export function BarChart({ data, color = '#4b7bec', valuePrefix = 'Rs. ', height = 320 }) {
    const width = 760;
    const margin = { top: 22, right: 16, bottom: 42, left: 62 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const values = data.map((item) => Number(item.value) || 0);
    const highest = Math.max(0, ...values) * 1.12;
    const lowest = Math.min(0, ...values) * 1.12;
    const magnitude = Math.max(Math.abs(highest), Math.abs(lowest), 1);
    const step = Math.max(1000, Math.ceil(magnitude / 4 / 5000) * 5000);
    const positiveSteps = Math.max(1, Math.ceil(highest / step));
    const negativeSteps = lowest < 0 ? Math.max(1, Math.ceil(Math.abs(lowest) / step)) : 0;
    const upper = positiveSteps * step;
    const lower = -negativeSteps * step;
    const ticks = Array.from({ length: positiveSteps + negativeSteps + 1 }, (_, index) => lower + index * step);
    const yFor = (/** @type {number} */ value) => margin.top + ((upper - value) / (upper - lower)) * innerHeight;
    const zeroY = yFor(0);
    const slot = innerWidth / Math.max(data.length, 1);
    const barWidth = Math.min(54, slot * 0.54);
    const compact = (/** @type {number} */ value) => Math.abs(value) >= 1000 ? `${value / 1000}k` : String(Math.round(value));
    return (
        <div className="bar-chart" style={{ minHeight: height }}>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ height }} role="img" aria-label="Sales bar chart" preserveAspectRatio="xMidYMid meet">
                {ticks.map((tick) => {
                    const y = yFor(tick);
                    return (
                        <g key={tick}>
                            <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="var(--border)" strokeDasharray={tick === 0 ? '0' : '4 5'} />
                            <text x={margin.left - 12} y={y + 4} textAnchor="end" className="chart-axis-label">{compact(tick)}</text>
                        </g>
                    );
                })}
                {data.map((item, index) => {
                    const valueY = yFor(item.value);
                    const barHeight = Math.abs(valueY - zeroY);
                    const x = margin.left + slot * index + (slot - barWidth) / 2;
                    const y = item.value >= 0 ? valueY : zeroY;
                    return (
                        <g key={item.label} className="chart-bar">
                            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 2)} rx="7" fill={color}>
                                <title>{item.label}: {valuePrefix}{number(item.value)}{item.orders ? ` · ${item.orders} orders` : ''}</title>
                            </rect>
                            <text x={x + barWidth / 2} y={margin.top + innerHeight + 25} textAnchor="middle" className="chart-axis-label chart-x-label">{item.label}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

/** @param {{ data: Array<{ label: string, value: number, color: string }>, centerLabel?: string, centerValue?: import('react').ReactNode, size?: number }} props */
export function DonutChart({ data, centerLabel = 'ITEMS', centerValue, size = 230 }) {
    const radius = 67;
    const circumference = 2 * Math.PI * radius;
    const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
    let offset = 0;
    return (
        <div className="donut-layout">
            <div className="donut-chart" style={{ width: size, height: size }}>
                <svg viewBox="0 0 180 180" role="img" aria-label="Inventory status donut chart">
                    <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--border)" strokeWidth="23" />
                    {data.filter((item) => item.value > 0).map((item) => {
                        const length = (item.value / total) * circumference;
                        const currentOffset = offset;
                        offset += length;
                        return (
                            <circle
                                key={item.label}
                                cx="90" cy="90" r={radius} fill="none" stroke={item.color} strokeWidth="23"
                                strokeDasharray={`${Math.max(0, length - 1.5)} ${circumference - Math.max(0, length - 1.5)}`}
                                strokeDashoffset={-currentOffset}
                                transform="rotate(-90 90 90)"
                            >
                                <title>{item.label}: {item.value}</title>
                            </circle>
                        );
                    })}
                    <text x="90" y="84" textAnchor="middle" className="donut-label">{centerLabel}</text>
                    <text x="90" y="105" textAnchor="middle" className="donut-value">{centerValue ?? total}</text>
                </svg>
            </div>
            <div className="donut-legend">
                {data.map((item) => (
                    <div key={item.label}><span className="legend-dot" style={{ background: item.color }} /><span>{item.label}</span><strong>{item.value}</strong></div>
                ))}
            </div>
        </div>
    );
}

/** @param {{ value: number, max?: number, color?: string }} props */
export function ProgressBar({ value, max = 100, color = '#2f6fed' }) {
    const percentage = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
    return <div className="progress-track"><span style={{ width: `${percentage}%`, background: color }} /></div>;
}

export function ToastViewport() {
    const { toasts, dismissToast } = useStore();
    /** @type {Record<string, import('react').ComponentType<{ size?: number }>>} */
    const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
    return (
        <div className="toast-viewport" aria-live="polite">
            {toasts.map((toast) => {
                const Icon = icons[toast.type] || CheckCircle2;
                return (
                    <div className={`toast toast-${toast.type}`} key={toast.id}>
                        <Icon size={20} />
                        <div><strong>{toast.title || (toast.type === 'error' ? 'Something needs attention' : toast.type === 'info' ? 'Updated' : 'Success')}</strong><p>{toast.message}</p></div>
                        <button onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification"><X size={16} /></button>
                    </div>
                );
            })}
        </div>
    );
}