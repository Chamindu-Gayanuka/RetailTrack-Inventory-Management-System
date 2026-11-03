import { useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowRight,
    Banknote,
    BarChart3,
    Boxes,
    ChevronRight,
    CircleDollarSign,
    ClipboardList,
    Package,
    PackagePlus,
    Plus,
    ShoppingCart,
    Tag,
} from 'lucide-react';
import { useStore } from '../store-context.js';
import {
    currency,
    dateLabel,
    getStockStatus,
    number,
    relativeTime,
} from '../data.js';
import { BarChart, CardHeader, DonutChart, EmptyState, PageHeader, StatCard, StatusBadge } from '../components/UI.jsx';
import RestockModal from '../components/RestockModal.jsx';
import ProductImage from '../components/ProductImage.jsx';
import PeriodFilter from '../components/PeriodFilter.jsx';
import { buildPeriodBuckets, createPeriodState, getPeriodRange, isDateInPeriod } from '../utils/periods.js';

/** @param {{ navigate: (path: string) => void }} props */
export default function Dashboard({ navigate }) {
    const { products, categories, sales, transactions, session, settings } = useStore();
    const [period, setPeriod] = useState(() => createPeriodState('weekly'));
    const [restockOpen, setRestockOpen] = useState(false);
    const periodRange = getPeriodRange(period);
    const periodSales = useMemo(() => sales.filter((sale) => isDateInPeriod(sale.createdAt, period)), [sales, period]);
    const completedPeriodSales = useMemo(() => periodSales.filter((sale) => sale.status === 'Completed'), [periodSales]);
    const periodTransactions = useMemo(() => transactions.filter((transaction) => isDateInPeriod(transaction.createdAt, period)), [transactions, period]);

    const stats = useMemo(() => {
        const active = products.filter((product) => product.active);
        return {
            active: active.length,
            units: active.reduce((sum, product) => sum + Number(product.stock), 0),
            periodRevenue: completedPeriodSales.reduce((sum, sale) => sum + sale.total, 0),
            periodOrders: completedPeriodSales.length,
            low: active.filter((product) => ['low', 'out'].includes(getStockStatus(product))).length,
            value: active.reduce((sum, product) => sum + product.stock * product.cost, 0),
        };
    }, [products, completedPeriodSales]);

    const chartData = useMemo(() => buildPeriodBuckets(period, sales).map((bucket) => {
        const matching = completedPeriodSales.filter((sale) => new Date(sale.createdAt) >= bucket.start && new Date(sale.createdAt) < bucket.end);
        return { label: bucket.label, value: matching.reduce((sum, sale) => sum + sale.total, 0), orders: matching.length };
    }), [period, sales, completedPeriodSales]);

    const activeProducts = products.filter((product) => product.active);
    const critical = activeProducts.filter((product) => product.stock > 0 && product.stock <= Math.max(2, product.minStock * 0.25)).length;
    const out = activeProducts.filter((product) => product.stock === 0).length;
    const low = activeProducts.filter((product) => product.stock > 0 && product.stock <= product.minStock).length - critical;
    const donutData = [
        { label: 'In Stock', value: activeProducts.length - low - critical - out, color: '#7165e3' },
        { label: 'Low Stock', value: low, color: '#54bfa6' },
        { label: 'Out of Stock', value: out, color: '#ef8585' },
        { label: 'Critical', value: critical, color: '#40b8c4' },
    ];

    const lowProducts = activeProducts
        .filter((product) => ['low', 'out'].includes(getStockStatus(product)))
        .sort((a, b) => (a.stock / (a.minStock || 1)) - (b.stock / (b.minStock || 1)))
        .slice(0, 5);

    return (
        <div className="dashboard-page">
            <PageHeader
                title="Dashboard"
                description={`Welcome back ${session.name.split(' ')[0]}. Here’s how ${settings.storeName} is doing today.`}
                actions={<>
                    <PeriodFilter value={period} onChange={setPeriod} label="Dashboard period" />
                    {session.role === 'Inventory Staff' ? <button className="button button-primary" onClick={() => setRestockOpen(true)}><PackagePlus size={17} />Add Stock</button> : <button className="button button-primary" onClick={() => navigate('sales/new')}><Plus size={17} />New Sale</button>}
                </>}
            />

            <section className="stats-grid dashboard-stats">
                <StatCard icon={Package} label="Active Products" value={number(stats.active)} note={`Across ${categories.length} categories`} tone="blue" onClick={() => navigate('products')} />
                <StatCard icon={Boxes} label="Units in Stock" value={number(stats.units)} note="Live available quantity" tone="indigo" onClick={() => navigate(session.role === 'Cashier' ? 'products' : 'inventory')} />
                <StatCard icon={Banknote} label={period.mode === 'daily' ? 'Today’s Sales' : `${periodRange.shortLabel} Sales`} value={currency(stats.periodRevenue)} note={`${stats.periodOrders} completed orders`} tone="green" trend="up" onClick={() => navigate('sales')} />
                <StatCard icon={AlertTriangle} label="Low Stock Products" value={number(stats.low)} note="Needs reordering" tone="amber" trend="down" onClick={() => navigate(session.role === 'Cashier' ? 'products' : 'inventory/alerts')} />
                {session.role === 'Cashier' ? <StatCard icon={Tag} label="Sales Records" value={periodSales.length} note={periodRange.shortLabel} tone="cyan" onClick={() => navigate('sales')} /> : <StatCard icon={CircleDollarSign} label="Inventory Value" value={currency(stats.value)} note="At cost price" tone="cyan" onClick={() => navigate('reports')} />}
            </section>

            <section className="dashboard-chart-grid">
                <div className="card sales-chart-card">
                    <CardHeader
                        title="Sales Movement"
                        subtitle={`Revenue for ${periodRange.label}`}
                        action={<span className="chart-legend"><i style={{ background: '#4b7bec' }} />Revenue</span>}
                    />
                    <BarChart data={chartData} />
                </div>
                <div className="card stock-chart-card">
                    <CardHeader title="Stock by Status" subtitle="Current inventory health" action={<button className="text-button" onClick={() => navigate('inventory')}>Details <ChevronRight size={14} /></button>} />
                    <DonutChart data={donutData} centerValue={stats.active} />
                </div>
            </section>

            <section className="dashboard-middle-grid">
                <div className="card low-stock-card">
                    <CardHeader title="Low Stock Alert" subtitle="Products below their minimum threshold" action={<button className="text-button" onClick={() => navigate(session.role === 'Cashier' ? 'products' : 'inventory/alerts')}>View all <ArrowRight size={14} /></button>} />
                    {lowProducts.length ? <div className="table-wrap"><table className="data-table compact-table"><thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Minimum</th><th>Status</th></tr></thead><tbody>
                        {lowProducts.map((product) => {
                            const isCritical = product.stock === 0 || product.stock <= Math.max(2, product.minStock * 0.25);
                            return <tr key={product.id} onClick={() => navigate(`products/view/${product.id}`)} className="clickable-row"><td data-label="Product" data-wide="true"><div className="product-name-cell"><ProductImage product={product} size="small" /><span className={`product-indicator ${isCritical ? 'danger' : 'warning'}`} /><strong>{product.name}</strong></div></td><td data-label="SKU" className="muted monospace">{product.sku}</td><td data-label="Stock"><strong className={isCritical ? 'text-danger' : ''}>{product.stock}</strong></td><td data-label="Minimum" className="muted">{product.minStock}</td><td data-label="Status"><StatusBadge status={product.stock === 0 ? 'out' : isCritical ? 'critical' : 'low'}>{isCritical && product.stock > 0 ? 'Critical' : undefined}</StatusBadge></td></tr>;
                        })}
                    </tbody></table></div> : <EmptyState title="Stock levels look healthy" description="No products are below their minimum stock level." />}
                </div>

                <div className="dashboard-side-stack">
                    <div className="card transaction-card">
                        <CardHeader title="Recent Transactions" action={<button className="icon-button small" onClick={() => navigate(session.role === 'Cashier' ? 'sales' : 'inventory/history')} aria-label="View transactions"><ChevronRight size={17} /></button>} />
                        <div className="transaction-list">
                            {periodTransactions.slice(0, 4).map((transaction) => {
                                const product = products.find((item) => item.id === transaction.productId);
                                return (
                                    <div className="transaction-item" key={transaction.id}>
                                        <ProductImage product={product} size="small" />
                                        <div><strong>{transaction.title}</strong><span>{transaction.quantity} units · {relativeTime(transaction.createdAt)}</span></div>
                                        <span className={`transaction-type ${transaction.type}`}>{transaction.type === 'inbound' ? 'Inbound' : 'Outbound'}</span>
                                    </div>
                                );
                            })}
                            {!periodTransactions.length && <div className="transaction-empty">No transactions in this period.</div>}
                        </div>
                    </div>
                    <div className="card quick-actions-card">
                        <CardHeader title="Quick Actions" />
                        <div className="quick-actions">
                            {session.role === 'Administrator' && <button onClick={() => navigate('products/new')}><span className="quick-icon blue"><Plus size={21} /></span><span>Add Product</span></button>}
                            {session.role !== 'Cashier' && <button onClick={() => setRestockOpen(true)}><span className="quick-icon green"><PackagePlus size={20} /></span><span>Add Stock</span></button>}
                            {session.role !== 'Inventory Staff' && <button onClick={() => navigate('sales/new')}><span className="quick-icon amber"><ShoppingCart size={20} /></span><span>New Sale</span></button>}
                            {session.role !== 'Cashier' && <button onClick={() => navigate('reports')}><span className="quick-icon teal"><BarChart3 size={20} /></span><span>View Reports</span></button>}
                            {session.role === 'Cashier' && <button onClick={() => navigate('products')}><span className="quick-icon green"><Package size={20} /></span><span>Check Stock</span></button>}
                            {session.role === 'Cashier' && <button onClick={() => navigate('sales')}><span className="quick-icon teal"><ClipboardList size={20} /></span><span>Sales History</span></button>}
                        </div>
                    </div>
                </div>
            </section>

            <section className="card recent-sales-card">
                <CardHeader title="Recent Sales" subtitle={`Latest transactions · ${periodRange.detail}`} action={<button className="button button-secondary button-small" onClick={() => navigate('sales')}>View all sales <ArrowRight size={15} /></button>} />
                {periodSales.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Sale ID</th><th>Customer</th><th>Items</th><th>Date</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>
                    {periodSales.slice(0, 5).map((sale) => <tr key={sale.id} className="clickable-row" onClick={() => navigate(`sales/view/${sale.id}`)}><td data-label="Sale ID"><button className="table-link">{sale.id}</button></td><td data-label="Customer"><strong>{sale.customer}</strong></td><td data-label="Items" className="muted">{sale.items.reduce((sum, item) => sum + item.qty, 0)} items</td><td data-label="Date" className="muted">{dateLabel(sale.createdAt, true)}</td><td data-label="Amount"><strong>{currency(sale.total)}</strong></td><td data-label="Status"><StatusBadge status={sale.status} /></td><td data-label="View"><ChevronRight size={16} className="muted" /></td></tr>)}
                </tbody></table></div> : <EmptyState title="No sales in this period" description="Choose another period or record a new sale." />}
            </section>

            {session.role !== 'Cashier' && <RestockModal open={restockOpen} onClose={() => setRestockOpen(false)} />}
        </div>
    );
}