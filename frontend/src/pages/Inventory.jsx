import {useEffect, useMemo, useState} from 'react';
import {
    AlertTriangle,
    ArrowDownLeft,
    ArrowUpRight,
    Boxes,
    CircleAlert,
    CircleDollarSign,
    Download,
    Filter,
    History,
    PackagePlus,
    Plus,
    Search,
    ShoppingCart,
    Warehouse,
} from 'lucide-react';
import {useStore} from '../store-context.js';
import {downloadCsv} from '../utils/downloadCsv.js';
import {downloadPurchaseOrderPdf, downloadReportPdf} from '../utils/pdf.js';
import {currency, dateLabel, getStockStatus, number, relativeTime} from '../data.js';
import {
    CardHeader,
    EmptyState,
    Field,
    Modal,
    PageHeader,
    Pagination,
    StatCard,
    StatusBadge
} from '../components/UI.jsx';
import RestockModal from '../components/RestockModal.jsx';
import ProductImage, {ProductCell} from '../components/ProductImage.jsx';
import useUrlPagination from '../utils/useUrlPagination.js';
import PrettySelect from '../components/PrettySelect.jsx';

/** @param {{ product: import('../types.js').Product | null, onClose: () => void }} props */
function PurchaseOrderModal({product, onClose}) {
    const {notify, createPurchaseOrder, settings} = useStore();
    const [quantity, setQuantity] = useState(1);
    const [supplier, setSupplier] = useState('');
    useEffect(() => {
        if (product) {
            setQuantity(Math.max(product.minStock * 2 - product.stock, product.minStock, 1));
            setSupplier('');
        }
    }, [product]);
    if (!product) return null;
    const submit = (/** @type {import('react').FormEvent<HTMLFormElement>} */ event) => {
        event.preventDefault();
        if (!Number(quantity) || Number(quantity) < 1) {
            notify('Purchase order quantity must be at least 1 unit.', 'error');
            return;
        }
        const order = createPurchaseOrder({productId: product.id, quantity: Number(quantity), supplier});
        if (!order) return;
        downloadPurchaseOrderPdf(order, settings);
        notify(`${order.id} downloaded as PDF.`);
        onClose();
    };
    return (
        <Modal open={Boolean(product)} onClose={onClose} title="Create Purchase Order"
               subtitle={`Prepare a supplier order for ${product.name}.`} footer={<>
            <button className="button button-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" form="purchase-order-form" className="button button-primary"><Download size={16}/>Create
                & Download PDF
            </button>
        </>}>
            <form id="purchase-order-form" className="form-stack" onSubmit={submit}>
                <ProductCell product={product} size="medium" className="purchase-product-summary"/>
                <div className="info-callout">Current stock: <strong>{product.stock} units</strong> · Minimum
                    threshold: <strong>{product.minStock} units</strong></div>
                <Field label="Supplier name" hint="Optional - you can assign a supplier later."><input value={supplier}
                                                                                                       onChange={(event) => setSupplier(event.target.value)}
                                                                                                       placeholder="e.g. Padiyathalawa Traders"/></Field>
                <Field label="Order quantity" required><input type="number" min="1" step="1" value={quantity}
                                                              onChange={(event) => setQuantity(Number(event.target.value))}/></Field>
            </form>
        </Modal>
    );
}

/** @param {{ navigate: (path: string) => void, section?: string }} props */
export default function Inventory({navigate, section = 'current'}) {
    const {products, categories, transactions, notify, settings} = useStore();
    const [tab, setTab] = useState(section);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [severity, setSeverity] = useState('all');
    const [restockOpen, setRestockOpen] = useState(false);
    const [restockProduct, setRestockProduct] = useState(/** @type {import('../types.js').Product | null} */ (null));
    const [purchaseProduct, setPurchaseProduct] = useState(/** @type {import('../types.js').Product | null} */ (null));
    const pageSize = 10;

    useEffect(() => setTab(section), [section]);
    const changeTab = (/** @type {string} */ value) => {
        setTab(value);
        navigate(value === 'current' ? 'inventory' : `inventory/${value}`);
    };
    const openRestock = (/** @type {import('../types.js').Product | null} */ product = null) => {
        setRestockProduct(product);
        setRestockOpen(true);
    };

    const activeProducts = products.filter((product) => product.active);
    const lowProducts = activeProducts.filter((product) => ['low', 'out'].includes(getStockStatus(product)));
    const stats = {
        units: activeProducts.reduce((sum, product) => sum + product.stock, 0),
        value: activeProducts.reduce((sum, product) => sum + product.stock * product.cost, 0),
        low: lowProducts.filter((product) => product.stock > 0).length,
        out: lowProducts.filter((product) => product.stock === 0).length,
    };

    const filtered = useMemo(() => products.filter((product) => {
        const term = search.trim().toLowerCase();
        return (!term || `${product.name} ${product.sku}`.toLowerCase().includes(term)) && (status === 'all' || getStockStatus(product) === status);
    }), [products, search, status]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const [page, setPage] = useUrlPagination(navigate, pageCount, JSON.stringify([search, status, tab]));
    const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
    const categoryName = (/** @type {string} */ id) => categories.find((category) => category.id === id)?.name || '-';

    const alerts = lowProducts.filter((product) => {
        const level = product.stock === 0 ? 'critical' : product.stock <= Math.max(2, product.minStock * 0.35) ? 'warning' : 'attention';
        return severity === 'all' || severity === level;
    }).sort((a, b) => a.stock / (a.minStock || 1) - b.stock / (b.minStock || 1));

    const exportInventory = () => {
        downloadCsv('retailtrack-inventory.csv', [
            ['SKU', 'Product', 'Category', 'Available Stock', 'Minimum Stock', 'Cost Price', 'Stock Value', 'Status'],
            ...filtered.map((product) => [product.sku, product.name, categoryName(product.categoryId), product.stock, product.minStock, product.cost, product.stock * product.cost, getStockStatus(product)]),
        ]);
        notify('Inventory report exported as CSV.');
    };
    const exportInventoryPdf = () => {
        downloadReportPdf({
            filename: 'retailtrack-inventory.pdf',
            title: 'Inventory Report',
            settings,
            subtitle: `Generated ${dateLabel(new Date(), true)}`,
            summary: [['Products', filtered.length], ['Stock value at cost', currency(filtered.reduce((sum, product) => sum + product.stock * product.cost, 0))]],
            head: ['SKU', 'Product', 'Category', 'Stock', 'Minimum', 'Cost price', 'Stock value', 'Status'],
            body: filtered.map((product) => [product.sku, product.name, categoryName(product.categoryId), product.stock, product.minStock, currency(product.cost), currency(product.stock * product.cost), getStockStatus(product)])
        });
        notify('Inventory report exported as PDF.');
    };

    return (
        <div>
            <PageHeader
                title={tab === 'alerts' ? 'Stock Alerts' : tab === 'history' ? 'Inventory Movements' : 'Inventory'}
                description={tab === 'alerts' ? 'Real-time inventory monitoring for Ape Kade' : tab === 'history' ? 'A complete audit trail of inbound and outbound stock.' : 'Monitor stock levels, record additions and keep every unit accounted for.'}
                actions={<>
                    <button className="button button-secondary" onClick={exportInventory}><Download size={16}/>CSV
                    </button>
                    <button className="button button-secondary" onClick={exportInventoryPdf}><Download size={16}/>PDF
                    </button>
                    <button className="button button-primary" onClick={() => openRestock()}><PackagePlus size={17}/>Add
                        Stock
                    </button>
                </>}
            />
            <section className="stats-grid compact-stats inventory-stats">
                <StatCard icon={Boxes} label="Units in Stock" value={number(stats.units)}
                          note={`${activeProducts.length} active products`} tone="blue"/>
                <StatCard icon={CircleDollarSign} label="Inventory Value" value={currency(stats.value)}
                          note="At cost price" tone="green"/>
                <StatCard icon={AlertTriangle} label="Low Stock" value={stats.low} note="At or below minimum"
                          tone="amber" onClick={() => changeTab('alerts')}/>
                <StatCard icon={CircleAlert} label="Out of Stock" value={stats.out} note="Immediate action needed"
                          tone="red" onClick={() => changeTab('alerts')}/>
            </section>
            <div className="tabs-bar">
                <button className={tab === 'current' ? 'active' : ''} onClick={() => changeTab('current')}><Warehouse
                    size={17}/>Current Stock
                </button>
                <button className={tab === 'alerts' ? 'active' : ''} onClick={() => changeTab('alerts')}><CircleAlert
                    size={17}/>Stock Alerts<span className="tab-count">{lowProducts.length}</span></button>
                <button className={tab === 'history' ? 'active' : ''} onClick={() => changeTab('history')}><History
                    size={17}/>Movement History
                </button>
            </div>

            {tab === 'current' && <>
                <div className="filter-bar inventory-filter">
                    <div className="filter-search"><Search size={18}/><input value={search}
                                                                             onChange={(event) => setSearch(event.target.value)}
                                                                             placeholder="Search product or SKU"/></div>
                    <PrettySelect value={status} onChange={(event) => setStatus(event.target.value)}>
                        <option value="all">All Stock Status</option>
                        <option value="in">In Stock</option>
                        <option value="low">Low Stock</option>
                        <option value="out">Out of Stock</option>
                        <option value="inactive">Inactive</option>
                    </PrettySelect><span className="filter-spacer"/><span className="filter-note"><span
                    className="live-dot"/>Live stock quantities</span></div>
                <section className="card table-card">
                    {visible.length ? <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                            <tr>
                                <th>Product</th>
                                <th>Category</th>
                                <th>Available</th>
                                <th>Minimum</th>
                                <th>Stock Level</th>
                                <th>Status</th>
                                <th>Last Updated</th>
                                <th/>
                            </tr>
                            </thead>
                            <tbody>
                            {visible.map((product) => {
                                const stockStatus = getStockStatus(product);
                                const stockPercent = Math.min(100, (product.stock / Math.max(product.minStock * 2, 1)) * 100);
                                return <tr key={product.id}>
                                    <td data-label="Product" data-wide="true"><ProductCell product={product}/></td>
                                    <td data-label="Category" className="muted">{categoryName(product.categoryId)}</td>
                                    <td data-label="Available"><strong>{product.stock} units</strong></td>
                                    <td data-label="Minimum" className="muted">{product.minStock}</td>
                                    <td data-label="Stock Level">
                                        <div className="stock-level-bar"><span><i
                                            className={`stock-level-${stockStatus}`}
                                            style={{width: `${stockPercent}%`}}/></span><small>{Math.round(stockPercent)}%</small>
                                        </div>
                                    </td>
                                    <td data-label="Status"><StatusBadge status={stockStatus}/></td>
                                    <td data-label="Last Updated"
                                        className="muted">{relativeTime(product.updatedAt)}</td>
                                    <td data-label="Action">
                                        <button className="button button-secondary button-small"
                                                onClick={() => openRestock(product)} disabled={!product.active}><Plus
                                            size={14}/>Restock
                                        </button>
                                    </td>
                                </tr>;
                            })}
                            </tbody>
                        </table>
                    </div> : <EmptyState title="No inventory records found"
                                         description="Try changing your search or stock filter."/>}
                    <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={filtered.length}
                                pageSize={pageSize}/>
                </section>
            </>}

            {tab === 'alerts' && <>
                <div className="alert-toolbar">
                    <div className="alert-summary-callout"><span><AlertTriangle size={19}/></span>
                        <div><strong>{stats.out + stats.low} products need your attention</strong><p>Restock critical
                            items first to avoid missed sales.</p></div>
                    </div>
                    <div className="select-with-icon"><Filter size={16}/><PrettySelect value={severity}
                                                                                       onChange={(event) => setSeverity(event.target.value)}>
                        <option value="all">Filter by Severity</option>
                        <option value="critical">Critical · Out of stock</option>
                        <option value="warning">Warning · Very low</option>
                        <option value="attention">Attention · Low stock</option>
                    </PrettySelect></div>
                </div>
                <div className="stock-alert-list">
                    {alerts.map((product) => {
                        const level = product.stock === 0 ? 'critical' : product.stock <= Math.max(2, product.minStock * 0.35) ? 'warning' : 'attention';
                        const suggested = Math.max(product.minStock * 2 - product.stock, product.minStock);
                        return <article className={`card stock-alert-card alert-${level}`} key={product.id}>
                            <div className="stock-alert-main"><ProductImage product={product} size="medium"/>
                                <div>
                                    <div className="stock-alert-title"><h2>{product.name}</h2><StatusBadge
                                        status={level === 'critical' ? 'critical' : level === 'warning' ? 'low' : 'attention'}>{level === 'critical' ? 'CRITICAL' : level === 'warning' ? 'LOW STOCK' : 'ATTENTION'}</StatusBadge>
                                    </div>
                                    <p><strong>{product.stock} units remaining</strong><span/>Minimum
                                        threshold: {product.minStock} units</p>
                                    <small>Updated {relativeTime(product.updatedAt)} · Suggested
                                        restock: {suggested} units</small></div>
                            </div>
                            <div className="stock-alert-actions">
                                <button
                                    className={`button ${level === 'critical' ? 'button-danger' : 'button-primary'}`}
                                    onClick={() => level === 'critical' ? setPurchaseProduct(product) : openRestock(product)}>{level === 'critical' ?
                                    <ShoppingCart size={16}/> : <PackagePlus
                                        size={16}/>}{level === 'critical' ? 'Create Purchase Order' : 'Quick Restock'}</button>
                                <button className="button button-secondary"
                                        onClick={() => level === 'critical' ? openRestock(product) : navigate(`products/view/${product.id}`)}>{level === 'critical' ? 'Quick Restock' : 'View Product'}</button>
                            </div>
                        </article>;
                    })}
                    {!alerts.length && <div className="card"><EmptyState title="No alerts at this severity"
                                                                         description="Your inventory is healthy, or you can choose a different filter."/>
                    </div>}
                </div>
            </>}

            {tab === 'history' && <section className="card table-card">
                <CardHeader title="Stock Movement Ledger" subtitle={`${transactions.length} recent inventory events`}/>
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                        <tr>
                            <th>Movement</th>
                            <th>Product</th>
                            <th>Type</th>
                            <th>Quantity</th>
                            <th>Reference</th>
                            <th>Date & Time</th>
                        </tr>
                        </thead>
                        <tbody>
                        {transactions.map((transaction) => {
                            const product = products.find((item) => item.id === transaction.productId);
                            return <tr key={transaction.id}>
                                <td data-label="Movement" data-wide="true">
                                    <div className="movement-title"><span
                                        className={`transaction-icon ${transaction.type}`}>{transaction.type === 'inbound' ?
                                        <ArrowDownLeft size={16}/> :
                                        <ArrowUpRight size={16}/>}</span><strong>{transaction.title}</strong></div>
                                </td>
                                <td data-label="Product" data-wide="true"><ProductCell product={product}
                                                                                       name={product?.name || 'Removed product'}
                                                                                       sku={product?.sku || '-'}/></td>
                                <td data-label="Type"><span
                                    className={`transaction-type ${transaction.type}`}>{transaction.type}</span></td>
                                <td data-label="Quantity"><strong
                                    className={transaction.type === 'inbound' ? 'text-positive' : 'text-danger'}>{transaction.type === 'inbound' ? '+' : '-'}{transaction.quantity}</strong>
                                </td>
                                <td data-label="Reference" data-wide="true" className="muted">{transaction.note}</td>
                                <td data-label="Date & Time"
                                    className="muted">{dateLabel(transaction.createdAt, true)}</td>
                            </tr>;
                        })}
                        </tbody>
                    </table>
                </div>
            </section>}

            <RestockModal open={restockOpen} product={restockProduct} onClose={() => setRestockOpen(false)}/>
            <PurchaseOrderModal product={purchaseProduct} onClose={() => setPurchaseProduct(null)}/>
        </div>
    );
}