import {useMemo, useState} from 'react';
import {CalendarDays, Check, CircleDollarSign, Download, PackageCheck, ReceiptText, Search, Undo2} from 'lucide-react';
import {useStore} from '../store-context.js';
import {currency, dateLabel} from '../data.js';
import {EmptyState, Field, Modal, PageHeader, Pagination, StatCard, StatusBadge} from '../components/UI.jsx';
import PrettySelect from '../components/PrettySelect.jsx';
import useUrlPagination from '../utils/useUrlPagination.js';
import {getReturnedQuantity} from '../utils/sales.js';
import {downloadReportPdf} from '../utils/pdf.js';

/** @param {string | number | Date} value */
const localDateKey = (value) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** @param {{ navigate: (path: string, options?: { replace?: boolean }) => void }} props */
export default function Returns({navigate}) {
    const {sales, returns, createReturn, notify, settings} = useStore();
    const [search, setSearch] = useState('');
    const [date, setDate] = useState('');
    const [selectedSaleId, setSelectedSaleId] = useState(/** @type {string | null} */ (null));
    const [quantities, setQuantities] = useState(/** @type {Record<string, number>} */ ({}));
    const [reason, setReason] = useState('Damaged item');
    const selectedSale = sales.find((sale) => sale.id === selectedSaleId);

    const filteredSales = useMemo(() => sales.filter((sale) => {
        if (sale.status !== 'Completed') return false;
        const term = search.trim().toLowerCase();
        const searchable = `${sale.id} ${sale.customer} ${dateLabel(sale.createdAt, true)} ${sale.items.map((item) => `${item.name} ${item.sku}`).join(' ')}`.toLowerCase();
        return (!term || searchable.includes(term)) && (!date || localDateKey(sale.createdAt) === date);
    }), [sales, search, date]);
    const pageSize = 8;
    const pageCount = Math.max(1, Math.ceil(filteredSales.length / pageSize));
    const [page, setPage] = useUrlPagination(navigate, pageCount, JSON.stringify([search, date]));
    const visible = filteredSales.slice((page - 1) * pageSize, page * pageSize);
    const refundTotal = selectedSale ? selectedSale.items.reduce((sum, item) => sum + (quantities[item.productId] || 0) * item.price, 0) : 0;

    const openReturn = (/** @type {import('../types.js').Sale} */ sale) => {
        setSelectedSaleId(sale.id);
        setQuantities({});
        setReason('Damaged item');
    };
    const closeReturn = () => {
        setSelectedSaleId(null);
        setQuantities({});
    };
    const toggleItem = (/** @type {string} */ productId, /** @type {boolean} */ checked) => {
        setQuantities((current) => {
            const next = {...current};
            if (checked) next[productId] = 1;
            else delete next[productId];
            return next;
        });
    };
    const processReturn = () => {
        if (!selectedSale) return;
        const items = Object.entries(quantities).filter(([, qty]) => qty > 0).map(([productId, qty]) => ({
            productId,
            qty
        }));
        const record = createReturn({saleId: selectedSale.id, reason, items});
        if (record) closeReturn();
    };
    const exportReturns = () => {
        downloadReportPdf({
            filename: 'retailtrack-customer-returns.pdf',
            title: 'Customer Returns',
            settings,
            subtitle: `Generated ${dateLabel(new Date(), true)}`,
            summary: [['Return records', returns.length], ['Total refunded', currency(returns.reduce((sum, item) => sum + item.total, 0))]],
            head: ['Return ID', 'Sale ID', 'Customer', 'Date', 'Items', 'Reason', 'Refund'],
            body: returns.map((record) => [record.id, record.saleId, record.customer, dateLabel(record.createdAt, true), record.items.reduce((sum, item) => sum + item.qty, 0), record.reason, currency(record.total)])
        });
        notify('Customer returns exported as PDF.');
    };

    return (
        <div>
            <PageHeader title="Customer Returns"
                        description="Find the original sale, select returned items and restock them with a complete audit trail."
                        actions={<button className="button button-secondary" onClick={exportReturns}><Download
                            size={16}/>Export PDF</button>}/>
            <section className="stats-grid compact-stats return-stats">
                <StatCard icon={Undo2} label="Return Records" value={returns.length} note="Processed customer returns"
                          tone="blue"/>
                <StatCard icon={CircleDollarSign} label="Total Refunded"
                          value={currency(returns.reduce((sum, item) => sum + item.total, 0))} note="Across all returns"
                          tone="green"/>
                <StatCard icon={PackageCheck} label="Items Restocked"
                          value={returns.reduce((sum, record) => sum + record.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0)}
                          note="Units returned to inventory" tone="indigo"/>
            </section>
            <div className="filter-bar return-filter-bar">
                <div className="filter-search"><Search size={18}/><input value={search}
                                                                         onChange={(event) => setSearch(event.target.value)}
                                                                         placeholder="Search sale ID, customer, product or date"
                                                                         aria-label="Search sales for return"/></div>
                <div className="input-with-icon return-date-filter"><CalendarDays size={16}/><input type="date"
                                                                                                    value={date}
                                                                                                    onChange={(event) => setDate(event.target.value)}
                                                                                                    aria-label="Filter sales by date"/>
                </div>
                {(search || date) && <button className="button button-ghost" onClick={() => {
                    setSearch('');
                    setDate('');
                }}>Clear filters</button>}
            </div>
            <section className="card table-card">
                {visible.length ? <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                        <tr>
                            <th>Sale ID</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Items</th>
                            <th>Net Amount</th>
                            <th>Return Status</th>
                            <th>Action</th>
                        </tr>
                        </thead>
                        <tbody>
                        {visible.map((sale) => {
                            const fullyReturned = sale.items.every((item) => getReturnedQuantity(returns, sale.id, item.productId) >= item.qty);
                            return <tr key={sale.id}>
                                <td data-label="Sale ID"><strong className="monospace">{sale.id}</strong></td>
                                <td data-label="Customer" data-wide="true"><strong>{sale.customer}</strong></td>
                                <td data-label="Date" className="muted">{dateLabel(sale.createdAt, true)}</td>
                                <td data-label="Items">{sale.items.reduce((sum, item) => sum + item.qty, 0)} units</td>
                                <td data-label="Net Amount">
                                    <strong>{currency(sale.total - Number(sale.refundedTotal || 0))}</strong></td>
                                <td data-label="Return Status">{sale.returnStatus ? <StatusBadge
                                        status={sale.returnStatus === 'Returned' ? 'out' : 'attention'}>{sale.returnStatus}</StatusBadge> :
                                    <span className="muted">No returns</span>}</td>
                                <td data-label="Action">
                                    <button className="button button-secondary button-small"
                                            onClick={() => openReturn(sale)} disabled={fullyReturned}><Undo2
                                        size={14}/>{fullyReturned ? 'Fully Returned' : 'Process Return'}</button>
                                </td>
                            </tr>;
                        })}
                        </tbody>
                    </table>
                </div> : <EmptyState title="No matching completed sales"
                                     description="Search by sale ID, customer name, product or sale date."
                                     icon={ReceiptText}/>}
                <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={filteredSales.length}
                            pageSize={pageSize}/>
            </section>

            <section className="card table-card return-history-card">
                <div className="card-header">
                    <div><h2>Return History</h2><p>Latest refunds and inventory adjustments</p></div>
                </div>
                {returns.length ? <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                        <tr>
                            <th>Return ID</th>
                            <th>Sale ID</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Items</th>
                            <th>Reason</th>
                            <th>Refund</th>
                            <th>Processed By</th>
                        </tr>
                        </thead>
                        <tbody>{returns.slice(0, 10).map((record) => <tr key={record.id}>
                            <td data-label="Return ID"><strong>{record.id}</strong></td>
                            <td data-label="Sale ID" className="monospace">{record.saleId}</td>
                            <td data-label="Customer" data-wide="true">{record.customer}</td>
                            <td data-label="Date" className="muted">{dateLabel(record.createdAt, true)}</td>
                            <td data-label="Items">{record.items.reduce((sum, item) => sum + item.qty, 0)} units</td>
                            <td data-label="Reason" data-wide="true">{record.reason}</td>
                            <td data-label="Refund"><strong>{currency(record.total)}</strong></td>
                            <td data-label="Processed By">{record.processedBy}</td>
                        </tr>)}</tbody>
                    </table>
                </div> : <EmptyState title="No returns processed"
                                     description="Select a completed sale above to process the first customer return."
                                     icon={Undo2}/>}
            </section>

            <Modal open={Boolean(selectedSale)} onClose={closeReturn}
                   title={`Return items from ${selectedSale?.id || ''}`}
                   subtitle={selectedSale ? `${selectedSale.customer} - ${dateLabel(selectedSale.createdAt, true)}` : ''}
                   size="large" footer={<>
                <button className="button button-secondary" onClick={closeReturn}>Cancel</button>
                <button className="button button-primary" onClick={processReturn} disabled={!refundTotal}><Check
                    size={16}/>Process Return - {currency(refundTotal)}</button>
            </>}>
                {selectedSale && <div className="return-form">
                    <div className="info-callout">Select only the items and quantities returned by the customer.
                        Quantities cannot exceed the remaining unreturned units.
                    </div>
                    <div className="return-item-list">{selectedSale.items.map((item) => {
                        const alreadyReturned = getReturnedQuantity(returns, selectedSale.id, item.productId);
                        const remaining = item.qty - alreadyReturned;
                        const selected = quantities[item.productId] !== undefined;
                        return <div className={`return-item-row ${selected ? 'selected' : ''}`} key={item.productId}>
                            <label className="return-item-check"><input type="checkbox" checked={selected}
                                                                        onChange={(event) => toggleItem(item.productId, event.target.checked)}
                                                                        disabled={!remaining}/><span><strong>{item.name}</strong><small>{item.sku} - Sold {item.qty} at {currency(item.price)} each</small></span></label>
                            <span
                                className="return-remaining">{remaining} returnable{alreadyReturned ? ` - ${alreadyReturned} already returned` : ''}</span>
                            <input type="number" min="1" max={remaining} step="1"
                                   value={selected ? quantities[item.productId] : ''}
                                   onChange={(event) => setQuantities((current) => ({
                                       ...current,
                                       [item.productId]: Math.min(remaining, Math.max(1, Number(event.target.value)))
                                   }))} disabled={!selected || !remaining}
                                   aria-label={`Return quantity for ${item.name}`}/>
                            <strong>{currency((selected ? quantities[item.productId] : 0) * item.price)}</strong>
                        </div>;
                    })}</div>
                    <Field label="Return reason" required><PrettySelect value={reason}
                                                                        onChange={(event) => setReason(event.target.value)}>
                        <option>Damaged item</option>
                        <option>Incorrect item</option>
                        <option>Customer changed mind</option>
                        <option>Quality issue</option>
                        <option>Other</option>
                    </PrettySelect></Field>
                    <div className="return-refund-summary">
                        <span>Refund total</span><strong>{currency(refundTotal)}</strong></div>
                </div>}
            </Modal>
        </div>
    );
}