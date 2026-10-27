import {useEffect, useId} from 'react';
import {AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, PackageSearch, X, XCircle,} from 'lucide-react';
import {number, statusLabel} from '../data.js';
import {useStore} from '../StoreContext.jsx';

let activeModalLocks = 0;
let previousBodyOverflow = '';
let previousHtmlOverflow = '';

export function PageHeader({title, description, eyebrow, actions, breadcrumb}) {
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

export function StatusBadge({status, children, dot = true}) {
    const key = String(status).toLowerCase().replaceAll(' ', '-');
    return (
        <span className={`badge badge-${key}`}>
      {dot && <span className="badge-dot"/>}
            {children || statusLabel[status] || status}
    </span>
    );
}

export function StatCard({icon: Icon, label, value, note, tone = 'blue', trend, onClick}) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag className={`stat-card ${onClick ? 'stat-card-button' : ''}`} onClick={onClick}>
            <div className={`stat-icon stat-${tone}`}><Icon size={19} strokeWidth={1.9}/></div>
            <div className="stat-copy">
                <span className="stat-label">{label}</span>
                <strong className="stat-value">{value}</strong>
                {(note || trend) && (
                    <span
                        className={`stat-note ${trend === 'down' ? 'note-danger' : trend === 'up' ? 'note-positive' : ''}`}>
            {note}
          </span>
                )}
            </div>
        </Tag>
    );
}

export function CardHeader({title, subtitle, action}) {
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

export function Modal({open, onClose, title, subtitle, children, footer, size = 'medium'}) {
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
        const onKey = (event) => {
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
                    <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X
                        size={20}/></button>
                </header>
                <div className="modal-body">{children}</div>
                {footer && <footer className="modal-footer">{footer}</footer>}
            </section>
        </div>
    );
}

export function Field({label, error, hint, required, children, className = ''}) {
    return (
        <div className={`form-field ${error ? 'field-error' : ''} ${className}`}>
            {label && <label>{label}{required && <span className="required"> *</span>}</label>}
            {children}
            {error ? <span className="field-message error-message"><XCircle size={13}/>{error}</span> : hint ?
                <span className="field-message">{hint}</span> : null}
        </div>
    );
}

export function Toggle({checked, onChange, label, description, disabled = false}) {
    return (
        <label className={`toggle-row ${disabled ? 'disabled' : ''}`}>
      <span>
        {label && <strong>{label}</strong>}
          {description && <small>{description}</small>}
      </span>
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}
                   disabled={disabled}/>
            <span className="toggle-track" aria-hidden="true"><span/></span>
        </label>
    );
}

export function Pagination({page, pageCount, onPageChange, total, pageSize}) {
    if (pageCount <= 1 && !total) return null;
    const pages = Array.from({length: pageCount}, (_, index) => index + 1);
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
                    <button className="page-button" disabled={page === 1} onClick={() => onPageChange(page - 1)}
                            aria-label="Previous page"><ChevronLeft size={17}/></button>
                    {visible.map((item, index) => (
                        <span key={item} className="page-number-wrap">
              {index > 0 && item - visible[index - 1] > 1 && <span className="page-ellipsis">…</span>}
                            <button className={`page-button ${item === page ? 'active' : ''}`}
                                    onClick={() => onPageChange(item)}>{item}</button>
            </span>
                    ))}
                    <button className="page-button" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}
                            aria-label="Next page"><ChevronRight size={17}/></button>
                </nav>
            )}
        </div>
    );
}

export function EmptyState({
                               title = 'Nothing found',
                               description = 'Try changing your search or filters.',
                               action,
                               icon: Icon = PackageSearch
                           }) {
    return (
        <div className="empty-state">
            <div className="empty-icon"><Icon size={27}/></div>
            <h3>{title}</h3>
            <p>{description}</p>
            {action}
        </div>
    );
}

export function Avatar({name = '', src, size = 'medium'}) {
    const initials = name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
    return (
        <span className={`avatar avatar-${size}`}>
      <span>{initials}</span>
            {src && <img src={src} alt={name} onError={(event) => {
                event.currentTarget.style.display = 'none';
            }}/>}
    </span>
    );
}

export function BarChart({data, color = '#4b7bec', valuePrefix = 'Rs. ', height = 255}) {
    const width = 720;
    const margin = {top: 18, right: 12, bottom: 36, left: 55};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = 190;
    const maxValue = Math.max(...data.map((item) => item.value), 1) * 1.12;
    const tickMax = Math.ceil(maxValue / 5000) * 5000;
    const ticks = [0, 1, 2, 3, 4].map((index) => (tickMax / 4) * index);
    const slot = innerWidth / Math.max(data.length, 1);
    const barWidth = Math.min(48, slot * 0.54);
    const compact = (value) => value >= 1000 ? `${value / 1000}k` : String(Math.round(value));
    return (
        <div className="bar-chart" style={{minHeight: height}}>
            <svg viewBox={`0 0 ${width} 250`} role="img" aria-label="Sales bar chart"
                 preserveAspectRatio="xMidYMid meet">
                {ticks.map((tick) => {
                    const y = margin.top + innerHeight - (tick / tickMax) * innerHeight;
                    return (
                        <g key={tick}>
                            <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#e8edf4"
                                  strokeDasharray={tick === 0 ? '0' : '4 5'}/>
                            <text x={margin.left - 12} y={y + 4} textAnchor="end"
                                  className="chart-axis-label">{compact(tick)}</text>
                        </g>
                    );
                })}
                {data.map((item, index) => {
                    const barHeight = (item.value / tickMax) * innerHeight;
                    const x = margin.left + slot * index + (slot - barWidth) / 2;
                    const y = margin.top + innerHeight - barHeight;
                    return (
                        <g key={item.label} className="chart-bar">
                            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 2)} rx="7" fill={color}>
                                <title>{item.label}: {valuePrefix}{number(item.value)}{item.orders ? ` · ${item.orders} orders` : ''}</title>
                            </rect>
                            <text x={x + barWidth / 2} y={margin.top + innerHeight + 25} textAnchor="middle"
                                  className="chart-axis-label chart-x-label">{item.label}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

export function DonutChart({data, centerLabel = 'ITEMS', centerValue, size = 190}) {
    const radius = 67;
    const circumference = 2 * Math.PI * radius;
    const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
    let offset = 0;
    return (
        <div className="donut-layout">
            <div className="donut-chart" style={{width: size, height: size}}>
                <svg viewBox="0 0 180 180" role="img" aria-label="Inventory status donut chart">
                    <circle cx="90" cy="90" r={radius} fill="none" stroke="#edf1f6" strokeWidth="23"/>
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
                    <div key={item.label}><span className="legend-dot"
                                                style={{background: item.color}}/><span>{item.label}</span><strong>{item.value}</strong>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ProgressBar({value, max = 100, color = '#2f6fed'}) {
    const percentage = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
    return <div className="progress-track"><span style={{width: `${percentage}%`, background: color}}/></div>;
}

export function ToastViewport() {
    const {toasts, dismissToast} = useStore();
    const icons = {success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle};
    return (
        <div className="toast-viewport" aria-live="polite">
            {toasts.map((toast) => {
                const Icon = icons[toast.type] || CheckCircle2;
                return (
                    <div className={`toast toast-${toast.type}`} key={toast.id}>
                        <Icon size={20}/>
                        <div>
                            <strong>{toast.title || (toast.type === 'error' ? 'Something needs attention' : toast.type === 'info' ? 'Updated' : 'Success')}</strong>
                            <p>{toast.message}</p></div>
                        <button onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification"><X size={16}/>
                        </button>
                    </div>
                );
            })}
        </div>
    );
}