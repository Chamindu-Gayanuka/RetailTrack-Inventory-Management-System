import { useEffect, useRef, useState } from 'react';
import {
    BarChart3,
    CalendarDays,
    CalendarRange,
    Check,
    ChevronDown,
    Clock3,
    Layers,
    RotateCcw,
    Sigma,
    X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { createPeriodState, getPeriodRange } from '../utils/periods.js';
import useFloatingMenu from '../utils/useFloatingMenu.js';

/** @typedef {import('../types.js').PeriodMode} PeriodMode */
/** @typedef {import('../types.js').PeriodState} PeriodState */

const periodOptions = [
    { mode: 'daily', label: 'Daily', description: 'Today’s activity', icon: Clock3 },
    { mode: 'date', label: 'Date', description: 'One specific day', icon: CalendarDays },
    { mode: 'range', label: 'Date Range', description: 'Choose start and end dates', icon: CalendarRange },
    { mode: 'weekly', label: 'Weekly', description: 'A Monday to Sunday week', icon: CalendarDays },
    { mode: 'monthly', label: 'Monthly', description: 'One calendar month', icon: CalendarDays },
    { mode: 'quarterly', label: 'Quarterly', description: 'A three-month quarter', icon: Layers },
    { mode: 'yearly', label: 'Yearly', description: 'One calendar year', icon: BarChart3 },
    { mode: 'all', label: 'All Time (Net)', description: 'Net totals across all records', icon: Sigma },
];

/** @param {{ value: PeriodState, onChange: (period: PeriodState) => void, label?: string, className?: string }} props */
export default function PeriodFilter({ value, onChange, label = 'Filter by period', className = '' }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value);
    const rootRef = useRef(/** @type {HTMLDivElement | null} */(null));
    const triggerRef = useRef(/** @type {HTMLButtonElement | null} */(null));
    const menuRef = useRef(/** @type {HTMLDivElement | null} */(null));
    const range = getPeriodRange(value);
    const menuStyle = useFloatingMenu(open, triggerRef, menuRef, `${draft.mode}-${open}`, { minWidth: 280, maxWidth: 370, maxHeight: 610 });
    const needsDetails = !['daily', 'all'].includes(draft.mode);
    const valid = draft.mode === 'range'
        ? Boolean(draft.start && draft.end && draft.start <= draft.end)
        : draft.mode === 'quarterly' || draft.mode === 'yearly'
            ? draft.year >= 1900 && draft.year <= 2100
            : draft.mode === 'monthly' ? Boolean(draft.month) : Boolean(draft.date);

    useEffect(() => {
        if (!open) return undefined;
        const close = (/** @type {MouseEvent} */ event) => {
            const target = /** @type {Node | null} */ (event.target);
            if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const chooseMode = (/** @type {PeriodMode} */ mode) => {
        const next = createPeriodState(mode);
        setDraft(next);
        if (mode === 'daily' || mode === 'all') {
            onChange(next);
            setOpen(false);
            triggerRef.current?.focus({ preventScroll: true });
        }
    };

    const update = (/** @type {keyof PeriodState} */ key, /** @type {string | number} */ nextValue) => {
        setDraft((current) => ({ ...current, [key]: nextValue }));
    };

    const apply = () => {
        if (!valid) return;
        onChange(draft);
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
    };

    return (
        <div className={`period-filter ${className}`} ref={rootRef} onKeyDown={(event) => {
            if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
            if (event.key === 'Tab') setOpen(false);
        }}>
            <button type="button" className={`period-filter-trigger ${open ? 'open' : ''}`} ref={triggerRef} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => {
                if (!open) setDraft(value);
                setOpen((current) => !current);
            }}>
                <CalendarDays size={18} />
                <span><strong>{range.shortLabel}</strong><small>{range.detail}</small></span>
                <ChevronDown size={16} className={open ? 'rotate' : ''} />
            </button>
            {open && createPortal(
                <div className="period-menu" ref={menuRef} role="dialog" aria-label="Period filter options" style={menuStyle}>
                    <div className="period-menu-head"><div><strong>Filter by period</strong><span>Choose a reporting time frame</span></div><button type="button" onClick={() => setOpen(false)} aria-label="Close period filter"><X size={17} /></button></div>
                    <div className="period-options">
                        {periodOptions.map((option) => {
                            const Icon = option.icon;
                            const selected = draft.mode === option.mode;
                            return <button type="button" key={option.mode} className={selected ? 'selected' : ''} onClick={() => chooseMode(/** @type {PeriodMode} */(option.mode))} aria-pressed={selected}>
                                <span className="period-option-icon"><Icon size={17} /></span>
                                <span><strong>{option.label}</strong><small>{option.description}</small></span>
                                {selected && <Check size={16} className="period-option-check" />}
                            </button>;
                        })}
                    </div>
                    {needsDetails && <div className="period-custom-panel">
                        {draft.mode === 'date' && <label>Select date<input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} /></label>}
                        {draft.mode === 'range' && <div className="period-range-grid"><label>Start date<input type="date" value={draft.start} max={draft.end || undefined} onChange={(event) => update('start', event.target.value)} /></label><label>End date<input type="date" value={draft.end} min={draft.start || undefined} onChange={(event) => update('end', event.target.value)} /></label></div>}
                        {draft.mode === 'weekly' && <label>Choose any day in the week<input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} /></label>}
                        {draft.mode === 'monthly' && <label>Choose month<input type="month" value={draft.month} onChange={(event) => update('month', event.target.value)} /></label>}
                        {draft.mode === 'quarterly' && <><div className="period-quarter-field"><span>Quarter</span><div className="period-quarter-options">{[1, 2, 3, 4].map((quarter) => <button type="button" key={quarter} className={draft.quarter === quarter ? 'active' : ''} onClick={() => update('quarter', quarter)}>Q{quarter}</button>)}</div></div><label>Year<input type="number" min="1900" max="2100" step="1" value={draft.year} onChange={(event) => update('year', Number(event.target.value))} /></label></>}
                        {draft.mode === 'yearly' && <label>Year<input type="number" min="1900" max="2100" step="1" value={draft.year} onChange={(event) => update('year', Number(event.target.value))} /></label>}
                        {!valid && <p className="period-validation">Choose a valid date range with the end date on or after the start date.</p>}
                        <div className="period-preview"><span>Selected period</span><strong>{getPeriodRange(draft).detail}</strong></div>
                    </div>}
                    {needsDetails && <div className="period-menu-footer"><button type="button" className="button button-ghost" onClick={() => setDraft(createPeriodState(draft.mode))}><RotateCcw size={15} />Reset</button><button type="button" className="button button-primary" onClick={apply} disabled={!valid}>Apply Filter</button></div>}
                </div>,
                document.body,
            )}
        </div>
    );
}