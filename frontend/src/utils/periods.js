/**
 * @typedef {import('../types.js').PeriodMode} PeriodMode
 * @typedef {import('../types.js').PeriodState} PeriodState
 * @typedef {import('../types.js').PeriodRange} PeriodRange
 * @typedef {import('../types.js').PeriodBucket} PeriodBucket
 */

const pad = (/** @type {number} */ value) => String(value).padStart(2, '0');
const startOfDay = (/** @type {string | number | Date} */ value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};
const addDays = (/** @type {Date} */ date, /** @type {number} */ days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};
const addMonths = (/** @type {Date} */ date, /** @type {number} */ months) => {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
};
const dateKey = (/** @type {Date} */ date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthKey = (/** @type {Date} */ date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const fullDate = (/** @type {Date} */ date) => date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
});
const shortDate = (/** @type {Date} */ date) => date.toLocaleDateString('en-GB', {day: '2-digit', month: 'short'});
const monthName = (/** @type {Date} */ date) => date.toLocaleDateString('en-GB', {month: 'long', year: 'numeric'});

/** @param {string} value */
function parseDateKey(value) {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return startOfDay(new Date());
    return new Date(year, month - 1, day);
}

/** @param {Date} date */
function startOfWeek(date) {
    const start = startOfDay(date);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return start;
}

/**
 * @param {PeriodMode} [mode]
 * @param {Date} [reference]
 * @returns {PeriodState}
 */
export function createPeriodState(mode = 'daily', reference = new Date()) {
    return {
        mode,
        date: dateKey(reference),
        start: dateKey(reference),
        end: dateKey(reference),
        month: monthKey(reference),
        quarter: Math.floor(reference.getMonth() / 3) + 1,
        year: reference.getFullYear(),
    };
}

/**
 * @param {PeriodState} period
 * @param {Date} [now]
 * @returns {PeriodRange}
 */
export function getPeriodRange(period, now = new Date()) {
    /** @type {{ start: Date | null, end: Date | null, label: string, shortLabel: string, detail: string }} */
    let result;
    if (period.mode === 'all') {
        result = {
            start: null,
            end: null,
            label: 'All Time (Net)',
            shortLabel: 'All Time (Net)',
            detail: 'Net totals across all records'
        };
    } else if (period.mode === 'date') {
        const start = parseDateKey(period.date);
        const detail = fullDate(start);
        result = {start, end: addDays(start, 1), label: `Date - ${detail}`, shortLabel: 'Date', detail};
    } else if (period.mode === 'range') {
        const first = parseDateKey(period.start);
        const last = parseDateKey(period.end);
        const start = first <= last ? first : last;
        const endDate = first <= last ? last : first;
        const end = addDays(endDate, 1);
        const detail = start.getTime() === endDate.getTime() ? fullDate(start) : `${shortDate(start)} - ${fullDate(endDate)}`;
        result = {
            start,
            end,
            label: `Date Range - ${fullDate(start)} to ${fullDate(endDate)}`,
            shortLabel: 'Date Range',
            detail
        };
    } else if (period.mode === 'weekly') {
        const start = startOfWeek(parseDateKey(period.date));
        const endDate = addDays(start, 6);
        const detail = `${shortDate(start)} - ${fullDate(endDate)}`;
        result = {start, end: addDays(start, 7), label: `Weekly - ${detail}`, shortLabel: 'Weekly', detail};
    } else if (period.mode === 'monthly') {
        const [year, month] = period.month.split('-').map(Number);
        const start = year && month ? new Date(year, month - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
        const detail = monthName(start);
        result = {start, end: addMonths(start, 1), label: `Monthly - ${detail}`, shortLabel: 'Monthly', detail};
    } else if (period.mode === 'quarterly') {
        const year = Math.max(1900, Math.min(2100, Number(period.year) || now.getFullYear()));
        const quarter = Math.max(1, Math.min(4, Number(period.quarter) || 1));
        const start = new Date(year, (quarter - 1) * 3, 1);
        const detail = `Q${quarter} ${year}`;
        result = {start, end: addMonths(start, 3), label: `Quarterly - ${detail}`, shortLabel: 'Quarterly', detail};
    } else if (period.mode === 'yearly') {
        const year = Math.max(1900, Math.min(2100, Number(period.year) || now.getFullYear()));
        const start = new Date(year, 0, 1);
        const detail = String(year);
        result = {start, end: new Date(year + 1, 0, 1), label: `Yearly - ${detail}`, shortLabel: 'Yearly', detail};
    } else {
        const start = startOfDay(now);
        const detail = `Today · ${fullDate(start)}`;
        result = {
            start,
            end: addDays(start, 1),
            label: `Daily - Today, ${fullDate(start)}`,
            shortLabel: 'Daily',
            detail
        };
    }
    return result;
}

/**
 * @param {string | number | Date} value
 * @param {PeriodState} period
 */
export function isDateInPeriod(value, period) {
    const {start, end} = getPeriodRange(period);
    if (!start || !end) return true;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date >= start && date < end;
}

/**
 * Create readable chart buckets for the selected period. All-time charts use
 * the earliest available record and adapt their granularity to the time span.
 *
 * @param {PeriodState} period
 * @param {Array<{ createdAt: string }>} records
 * @returns {PeriodBucket[]}
 */
export function buildPeriodBuckets(period, records) {
    const range = getPeriodRange(period);
    const now = new Date();
    let start = range.start ? new Date(range.start) : null;
    const end = range.end ? new Date(range.end) : addDays(startOfDay(now), 1);

    if (!start) {
        const timestamps = records.map((record) => new Date(record.createdAt).getTime()).filter(Number.isFinite);
        start = timestamps.length ? startOfDay(Math.min(...timestamps)) : addDays(startOfDay(now), -6);
        if (start > now) start = addDays(startOfDay(now), -6);
    }

    if (period.mode === 'daily' || period.mode === 'date') {
        const day = startOfDay(start);
        return Array.from({length: 8}, (_, index) => {
            const bucketStart = new Date(day);
            bucketStart.setHours(index * 3);
            const bucketEnd = new Date(day);
            bucketEnd.setHours((index + 1) * 3);
            return {start: bucketStart, end: bucketEnd, label: `${pad(index * 3)}:00`};
        });
    }

    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    let unit = 'day';
    if (period.mode === 'monthly') unit = 'week';
    else if (period.mode === 'quarterly' || period.mode === 'yearly') unit = 'month';
    else if (period.mode === 'range' || period.mode === 'all') unit = days <= 14 ? 'day' : days <= 90 ? 'week' : days <= 730 ? 'month' : 'year';

    /** @type {PeriodBucket[]} */
    const buckets = [];
    if (unit === 'day') {
        for (let cursor = startOfDay(start); cursor < end; cursor = addDays(cursor, 1)) {
            buckets.push({
                start: new Date(cursor),
                end: addDays(cursor, 1),
                label: period.mode === 'weekly' ? cursor.toLocaleDateString('en-US', {weekday: 'short'}) : shortDate(cursor),
            });
        }
    } else if (unit === 'week') {
        const first = period.mode === 'monthly' ? startOfDay(start) : startOfWeek(start);
        for (let cursor = first; cursor < end; cursor = addDays(cursor, 7)) {
            buckets.push({start: new Date(cursor), end: addDays(cursor, 7), label: shortDate(cursor)});
        }
    } else if (unit === 'month') {
        const first = new Date(start.getFullYear(), start.getMonth(), 1);
        for (let cursor = first; cursor < end; cursor = addMonths(cursor, 1)) {
            buckets.push({
                start: new Date(cursor),
                end: addMonths(cursor, 1),
                label: cursor.toLocaleDateString('en-GB', period.mode === 'all' && days > 365 ? {
                    month: 'short',
                    year: '2-digit'
                } : {month: 'short'}),
            });
        }
    } else {
        const first = new Date(start.getFullYear(), 0, 1);
        for (let cursor = first; cursor < end; cursor = new Date(cursor.getFullYear() + 1, 0, 1)) {
            buckets.push({
                start: new Date(cursor),
                end: new Date(cursor.getFullYear() + 1, 0, 1),
                label: String(cursor.getFullYear())
            });
        }
    }
    return buckets;
}