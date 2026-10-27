import { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Banknote,
    Check,
    ChevronRight,
    CircleDollarSign,
    Clock3,
    Download,
    Minus,
    Package,
    Plus,
    Printer,
    ReceiptText,
    Search,
    ShoppingCart,
    Trash2,
    UserRound,
    WalletCards,
} from 'lucide-react';
import { useStore, downloadCsv } from '../StoreContext.jsx';
import { currency, dateLabel, number } from '../data.js';
import { EmptyState, Field, Modal, PageHeader, Pagination, StatCard, StatusBadge } from '../components/UI.jsx';

const sameDay = (value) => {
    const date = new Date(value);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
};

function SaleDetail({ sale, onClose }) {
    const { completeSale, cancelSale, session } = useStore();
    if (!sale) return null;
    return (
        <Modal open={Boolean(sale)} onClose={onClose} title={sale.id} subtitle={`Recorded on ${dateLabel(sale.createdAt, true)}`} size="large" footer={<><button className="button button-secondary" onClick={() => window.print()}><Printer size={16} />Print receipt</button>{sale.status === 'Pending' && session.role !== 'Inventory Staff' && <><button className="button button-danger-outline" onClick={() => cancelSale(sale.id)}>Cancel Order</button><button className="button button-primary" onClick={() => completeSale(sale.id)}><Check size={16} />Complete Pending Sale</button></>}<button className="button button-secondary" onClick={onClose}>Done</button></>}>
            <div className="receipt-head"><div className="receipt-icon"><ReceiptText size={28} /></div><div><h3>{sale.customer}</h3><p>Cashier: {sale.cashier}</p></div><StatusBadge status={sale.status} /></div>
            <div className="receipt-meta"><div><span>Payment method</span><strong>{sale.payment}</strong></div><div><span>Items</span><strong>{sale.items.reduce((sum, item) => sum + item.qty, 0)} units</strong></div><div><span>Order status</span><strong>{sale.status}</strong></div></div>
            <div className="table-wrap receipt-table"><table className="data-table"><thead><tr><th>Product</th><th>Unit price</th><th>Qty</th><th>Amount</th></tr></thead><tbody>{sale.items.map((item) => <tr key={item.productId}><td><div className="primary-cell"><strong>{item.name}</strong><span>{item.sku}</span></div></td><td>{currency(item.price)}</td><td>{item.qty}</td><td><strong>{currency(item.qty * item.price)}</strong></td></tr>)}</tbody></table></div>
            <div className="receipt-total"><span>Total received</span><strong>{currency(sale.total)}</strong></div>
            <div className="info-callout">Completed sales automatically deduct the listed quantities from available inventory.</div>
        </Modal>
    );
}

export default function Sales({ navigate, viewId }) {
    const { sales, notify, session } = useStore();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [period, setPeriod] = useState('all');
    const [page, setPage] = useState(1);
    const [selectedId, setSelectedId] = useState(viewId || null);
    const pageSize = 8;
    useEffect(() => { if (viewId) setSelectedId(viewId); }, [viewId]);
    useEffect(() => setPage(1), [search, status, period]);

    const filtered = useMemo(() => sales.filter((sale) => {
        const term = search.trim().toLowerCase();
        const matchesSearch = !term || `${sale.id} ${sale.customer}`.toLowerCase().includes(term);
        const matchesStatus = status === 'all' || sale.status === status;
        const age = (Date.now() - new Date(sale.createdAt).getTime()) / 86400000;
        const matchesPeriod = period === 'all' || (period === 'today' ? sameDay(sale.createdAt) : age <= Number(period));
        return matchesSearch && matchesStatus && matchesPeriod;
    }), [sales, search, status, period]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
    const selected = sales.find((sale) => sale.id === selectedId);
    const completed = sales.filter((sale) => sale.status === 'Completed');
    const todayRevenue = completed.filter((sale) => sameDay(sale.createdAt)).reduce((sum, sale) => sum + sale.total, 0);
    const totalRevenue = completed.reduce((sum, sale) => sum + sale.total, 0);

    const exportSales = () => {
        downloadCsv('retailtrack-sales.csv', [['Sale ID', 'Customer', 'Date', 'Items', 'Payment', 'Status', 'Total (LKR)'], ...filtered.map((sale) => [sale.id, sale.customer, dateLabel(sale.createdAt, true), sale.items.reduce((sum, item) => sum + item.qty, 0), sale.payment, sale.status, sale.total])]);
        notify('Sales report exported as CSV.');
    };

    return (
        <div>
            <PageHeader title="Sales" description="Record customer sales and review every transaction from one place." actions={session.role === 'Inventory Staff' ? <span className="role-view-label">Read-only sales information</span> : <><button className="button button-secondary" onClick={exportSales}><Download size={16} />Export</button><button className="button button-primary" onClick={() => navigate('sales/new')}><Plus size={17} />New Sale</button></>} />
            <section className="stats-grid compact-stats sales-stats">
                <StatCard icon={Banknote} label="Today’s Revenue" value={currency(todayRevenue)} note={`${completed.filter((sale) => sameDay(sale.createdAt)).length} completed sales`} tone="green" />
                <StatCard icon={ReceiptText} label="Total Transactions" value={sales.length} note="All recorded orders" tone="blue" />
                <StatCard icon={CircleDollarSign} label="Average Sale" value={currency(completed.length ? totalRevenue / completed.length : 0)} note="Across completed orders" tone="indigo" />
                <StatCard icon={Clock3} label="Pending Orders" value={sales.filter((sale) => sale.status === 'Pending').length} note="Awaiting completion" tone="amber" />
            </section>
            <div className="filter-bar"><div className="filter-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sale ID or customer" /></div><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">All Time</option><option value="today">Today</option><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option></select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All Statuses</option><option>Completed</option><option>Pending</option><option>Cancelled</option></select><span className="filter-spacer" /><span className="filter-note">{currency(filtered.filter((sale) => sale.status === 'Completed').reduce((sum, sale) => sum + sale.total, 0))} in filtered sales</span></div>
            <section className="card table-card">
                {visible.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Sale ID</th><th>Customer</th><th>Items</th><th>Payment</th><th>Date</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>
                    {visible.map((sale) => <tr key={sale.id} className="clickable-row" onClick={() => setSelectedId(sale.id)}><td><button className="table-link">{sale.id}</button></td><td><div className="customer-cell"><span>{sale.customer.slice(0, 1)}</span><strong>{sale.customer}</strong></div></td><td className="muted">{sale.items.reduce((sum, item) => sum + item.qty, 0)} units</td><td className="muted">{sale.payment}</td><td className="muted">{dateLabel(sale.createdAt, true)}</td><td><strong>{currency(sale.total)}</strong></td><td><StatusBadge status={sale.status} /></td><td><ChevronRight size={16} className="muted" /></td></tr>)}
                </tbody></table></div> : <EmptyState title="No sales found" description="Try a different filter or record your first sale." action={session.role !== 'Inventory Staff' ? <button className="button button-primary" onClick={() => navigate('sales/new')}>New Sale</button> : null} icon={ReceiptText} />}
                <Pagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} total={filtered.length} pageSize={pageSize} />
            </section>
            <SaleDetail sale={selected} onClose={() => { setSelectedId(null); if (viewId) navigate('sales'); }} />
        </div>
    );
}

export function NewSale({ navigate }) {
    const { products, categories, createSale } = useStore();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [cart, setCart] = useState([]);
    const [customer, setCustomer] = useState('');
    const [payment, setPayment] = useState('Cash');
    const [error, setError] = useState('');

    const availableProducts = useMemo(() => products.filter((product) => {
        const term = search.trim().toLowerCase();
        return product.active && (!term || `${product.name} ${product.sku}`.toLowerCase().includes(term)) && (category === 'all' || product.categoryId === category);
    }), [products, search, category]);

    const getProduct = (id) => products.find((product) => product.id === id);
    const cartRows = cart.map((item) => ({ ...item, product: getProduct(item.productId) })).filter((item) => item.product);
    const total = cartRows.reduce((sum, item) => sum + item.qty * item.product.price, 0);
    const totalUnits = cart.reduce((sum, item) => sum + item.qty, 0);

    const add = (product) => {
        setError('');
        if (product.stock <= 0) { setError(`${product.name} is out of stock.`); return; }
        const existing = cart.find((item) => item.productId === product.id);
        if (existing && existing.qty >= product.stock) { setError(`Only ${product.stock} units of ${product.name} are available.`); return; }
        setCart((current) => existing ? current.map((item) => item.productId === product.id ? { ...item, qty: item.qty + 1 } : item) : [...current, { productId: product.id, qty: 1 }]);
    };
    const updateQuantity = (productId, quantity) => {
        const product = getProduct(productId);
        const qty = Number(quantity);
        if (qty > product.stock) { setError(`Only ${product.stock} units of ${product.name} are available.`); return; }
        setError('');
        if (qty <= 0) setCart((current) => current.filter((item) => item.productId !== productId));
        else setCart((current) => current.map((item) => item.productId === productId ? { ...item, qty } : item));
    };
    const complete = (status = 'Completed') => {
        if (!cart.length) { setError('Add at least one product before completing the sale.'); return; }
        const sale = createSale({ customer, items: cart, payment, status });
        if (sale) navigate(`sales/view/${sale.id}`);
    };

    return (
        <div className="new-sale-page">
            <PageHeader breadcrumb={<><button onClick={() => navigate('sales')}>Sales</button><ChevronRight size={13} /><span>New Sale</span></>} title="New Sale" description="Search products, build the order and update stock in one step." actions={<button className="button button-secondary" onClick={() => navigate('sales')}><ArrowLeft size={16} />Back to sales</button>} />
            <div className="sale-builder-grid">
                <section className="card product-picker-card">
                    <div className="sale-picker-heading"><div><h2>Select Products</h2><p>Choose from active products with available stock.</p></div><span>{availableProducts.length} products</span></div>
                    <div className="sale-product-search"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by product name or SKU…" autoFocus /></div>
                    <div className="category-chips"><button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>All products</button>{categories.map((item) => <button key={item.id} className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>{item.name}</button>)}</div>
                    <div className="sale-product-list">
                        {availableProducts.map((product) => {
                            const inCart = cart.find((item) => item.productId === product.id)?.qty || 0;
                            return <button className={`sale-product-row ${product.stock === 0 ? 'out-of-stock' : ''}`} key={product.id} onClick={() => add(product)} disabled={product.stock === 0}>
                                <span className="sale-product-icon"><Package size={20} /></span>
                                <span className="sale-product-copy"><strong>{product.name}</strong><small>{product.sku} · {categories.find((item) => item.id === product.categoryId)?.name}</small></span>
                                <span className="sale-product-stock"><strong>{product.stock} in stock</strong><small>{inCart ? `${inCart} in cart` : currency(product.price)}</small></span>
                                <span className="sale-product-add">{inCart ? <span>{inCart}</span> : <Plus size={17} />}</span>
                            </button>;
                        })}
                        {!availableProducts.length && <EmptyState title="No products found" description="Try another product name, SKU or category." />}
                    </div>
                </section>

                <aside className="card sale-cart-card">
                    <div className="sale-cart-heading"><div><span className="cart-heading-icon"><ShoppingCart size={20} /></span><div><h2>Current Sale</h2><p>{totalUnits} units selected</p></div></div>{cart.length > 0 && <button className="text-button text-danger" onClick={() => setCart([])}>Clear</button>}</div>
                    <Field label="Customer name"><div className="input-with-icon"><UserRound size={17} /><input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Walk-in Customer" /></div></Field>
                    <div className="cart-lines">
                        {cartRows.length ? cartRows.map(({ product, qty }) => <div className="cart-line" key={product.id}>
                            <div className="cart-line-top"><div><strong>{product.name}</strong><span>{currency(product.price)} each</span></div><button className="icon-button small" onClick={() => updateQuantity(product.id, 0)} aria-label={`Remove ${product.name}`}><Trash2 size={15} /></button></div>
                            <div className="cart-line-bottom"><div className="quantity-stepper"><button onClick={() => updateQuantity(product.id, qty - 1)}><Minus size={14} /></button><input type="number" min="1" max={product.stock} value={qty} onChange={(event) => updateQuantity(product.id, event.target.value)} aria-label={`Quantity of ${product.name}`} /><button onClick={() => updateQuantity(product.id, qty + 1)}><Plus size={14} /></button></div><strong>{currency(product.price * qty)}</strong></div>
                        </div>) : <div className="cart-empty"><span><ShoppingCart size={27} /></span><h3>Your sale is empty</h3><p>Select products from the list to start building this order.</p></div>}
                    </div>
                    {error && <div className="sale-error">{error}</div>}
                    <div className="payment-section"><label>Payment method</label><div className="payment-options">{['Cash', 'Card', 'Other'].map((method) => <button key={method} className={payment === method ? 'active' : ''} onClick={() => setPayment(method)}>{method === 'Cash' ? <Banknote size={17} /> : <WalletCards size={17} />}{method}{payment === method && <Check size={13} />}</button>)}</div></div>
                    <div className="sale-summary"><div><span>Subtotal</span><strong>{currency(total)}</strong></div><div><span>Tax</span><span>Not applied</span></div><div className="sale-total"><span>Total</span><strong>{currency(total)}</strong></div></div>
                    <button className="button button-primary complete-sale-button" onClick={() => complete('Completed')} disabled={!cart.length}><Check size={18} />Complete Sale · {currency(total)}</button>
                    <button className="button button-secondary save-pending-button" onClick={() => complete('Pending')} disabled={!cart.length}>Save as Pending</button>
                    <p className="sale-stock-note">Completed sales update inventory immediately. Pending sales do not change stock.</p>
                </aside>
            </div>
        </div>
    );
}