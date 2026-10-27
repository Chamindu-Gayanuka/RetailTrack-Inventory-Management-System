import { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Boxes,
    ChevronRight,
    CircleDollarSign,
    Eye,
    Package,
    PackagePlus,
    Pencil,
    Plus,
    Power,
    RotateCcw,
    Search,
    SlidersHorizontal,
} from 'lucide-react';
import { useStore } from '../StoreContext.jsx';
import { currency, dateLabel, getStockStatus, number } from '../data.js';
import {
    CardHeader,
    EmptyState,
    Field,
    Modal,
    PageHeader,
    Pagination,
    ProgressBar,
    StatCard,
    StatusBadge,
    Toggle,
} from '../components/UI.jsx';
import RestockModal from '../components/RestockModal.jsx';
import ProductImage, { ProductImageUpload } from '../components/ProductImage.jsx';

function ProductDetail({ product, category, onClose, onEdit, onRestock, canManage, canRestock }) {
    if (!product) return null;
    const status = getStockStatus(product);
    return (
        <Modal
            open={Boolean(product)}
            onClose={onClose}
            title="Product details"
            subtitle="Catalog information and current inventory position."
            size="large"
            footer={<><button className="button button-secondary" onClick={onClose}>Close</button>{canRestock && <button className="button button-secondary" onClick={onRestock}><PackagePlus size={17} />Add stock</button>}{canManage && <button className="button button-primary" onClick={onEdit}><Pencil size={16} />Edit product</button>}</>}
        >
            <div className="product-detail-head">
                <ProductImage product={product} size="large" />
                <div><div className="product-detail-title"><h3>{product.name}</h3><StatusBadge status={status} /></div><p>{product.sku} · {category?.name || 'Uncategorized'}</p></div>
            </div>
            <div className="product-detail-stats">
                <div><span>Selling price</span><strong>{currency(product.price)}</strong></div>
                <div><span>Available stock</span><strong>{number(product.stock)} units</strong></div>
                <div><span>Stock value at cost</span><strong>{currency(product.stock * product.cost)}</strong></div>
            </div>
            <div className="detail-section">
                <div className="detail-section-title"><h4>Stock health</h4><span>Minimum level: {product.minStock} units</span></div>
                <ProgressBar value={product.stock} max={Math.max(product.minStock * 2, product.stock, 1)} color={status === 'in' ? '#2f9d8f' : status === 'low' ? '#e5a43a' : '#df6565'} />
                <div className="stock-health-labels"><span>0</span><span>Minimum {product.minStock}</span><span>{Math.max(product.minStock * 2, product.stock)}+</span></div>
            </div>
            <div className="detail-grid">
                <div><span>Cost price</span><strong>{currency(product.cost)}</strong></div>
                <div><span>Estimated margin</span><strong>{product.price ? Math.round(((product.price - product.cost) / product.price) * 100) : 0}%</strong></div>
                <div><span>Product status</span><strong>{product.active ? 'Active & sellable' : 'Inactive'}</strong></div>
                <div><span>Last updated</span><strong>{dateLabel(product.updatedAt, true)}</strong></div>
            </div>
        </Modal>
    );
}

export default function Products({ navigate, viewId, initialCategory }) {
    const { products, categories, toggleProduct, session } = useStore();
    const canManage = session.role === 'Administrator';
    const canRestock = session.role !== 'Cashier';
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState(initialCategory || 'all');
    const [status, setStatus] = useState('all');
    const [sort, setSort] = useState('name');
    const [page, setPage] = useState(1);
    const [selectedId, setSelectedId] = useState(viewId || null);
    const [restockId, setRestockId] = useState(null);
    const pageSize = 8;

    useEffect(() => { if (viewId) setSelectedId(viewId); }, [viewId]);
    useEffect(() => { setCategory(initialCategory || 'all'); }, [initialCategory]);
    useEffect(() => setPage(1), [search, category, status, sort]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const list = products.filter((product) => {
            const matchesSearch = !term || `${product.name} ${product.sku}`.toLowerCase().includes(term);
            const matchesCategory = category === 'all' || product.categoryId === category;
            const productStatus = getStockStatus(product);
            const matchesStatus = status === 'all' || productStatus === status || (status === 'active' && product.active);
            return matchesSearch && matchesCategory && matchesStatus;
        });
        return list.sort((a, b) => {
            if (sort === 'stock-low') return a.stock - b.stock;
            if (sort === 'stock-high') return b.stock - a.stock;
            if (sort === 'price') return b.price - a.price;
            return a.name.localeCompare(b.name);
        });
    }, [products, search, category, status, sort]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
    const selected = products.find((product) => product.id === selectedId);
    const selectedCategory = categories.find((item) => item.id === selected?.categoryId);
    const categoryName = (id) => categories.find((item) => item.id === id)?.name || 'Uncategorized';
    const reset = () => { setSearch(''); setCategory('all'); setStatus('all'); setSort('name'); };
    const closeDetail = () => { setSelectedId(null); if (viewId) navigate('products'); };

    return (
        <div>
            <PageHeader
                title="Products"
                description={`Manage your catalog of ${products.length} items across ${categories.length} categories`}
                actions={canManage ? <button className="button button-primary" onClick={() => navigate('products/new')}><Plus size={17} />Add Product</button> : <span className="role-view-label">{session.role} · view access</span>}
            />
            <section className="stats-grid compact-stats product-stats">
                <StatCard icon={Package} label="Catalog Items" value={products.length} note={`${products.filter((p) => p.active).length} active products`} tone="blue" />
                <StatCard icon={Boxes} label="Units Available" value={number(products.reduce((sum, p) => sum + p.stock, 0))} note="Across all categories" tone="indigo" />
                <StatCard icon={CircleDollarSign} label="Retail Stock Value" value={currency(products.reduce((sum, p) => sum + p.stock * p.price, 0))} note="At selling price" tone="green" />
            </section>
            <div className="filter-bar">
                <div className="filter-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name / SKU" aria-label="Search products" />{search && <button onClick={() => setSearch('')} aria-label="Clear search">×</button>}</div>
                <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option value="all">All Categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by stock status"><option value="all">All Stock Status</option><option value="in">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option><option value="inactive">Inactive</option></select>
                <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products"><option value="name">Sort: Name A-Z</option><option value="stock-low">Stock: Low to High</option><option value="stock-high">Stock: High to Low</option><option value="price">Price: High to Low</option></select>
                <button className="button button-ghost reset-button" onClick={reset}><RotateCcw size={16} />Reset</button>
            </div>

            <section className="card table-card">
                <div className="table-card-top"><div><SlidersHorizontal size={16} /><span>{filtered.length} products found</span></div><span>Stock levels update automatically after every sale</span></div>
                {visible.length ? <div className="table-wrap"><table className="data-table product-table"><thead><tr><th>SKU</th><th>Product Name</th><th>Category</th><th>Selling Price</th><th>Current Stock</th><th>Minimum Stock</th><th>Stock</th><th className="actions-column">Actions</th></tr></thead><tbody>
                    {visible.map((product) => <tr key={product.id} className={!product.active ? 'inactive-row' : ''}>
                        <td className="monospace muted">{product.sku}</td>
                        <td><button className="product-table-name" onClick={() => setSelectedId(product.id)}><ProductImage product={product} size="small" /><span>{product.name}</span></button></td>
                        <td className="muted">{categoryName(product.categoryId)}</td>
                        <td><strong>{currency(product.price)}</strong></td>
                        <td><strong className={getStockStatus(product) === 'out' ? 'text-danger' : ''}>{number(product.stock)}</strong></td>
                        <td className="muted">{number(product.minStock)}</td>
                        <td><StatusBadge status={getStockStatus(product)} /></td>
                        <td><div className="row-actions">
                            <button className="icon-button small" onClick={() => setSelectedId(product.id)} title="View product" aria-label={`View ${product.name}`}><Eye size={17} /></button>
                            {canManage && <button className="icon-button small" onClick={() => navigate(`products/edit/${product.id}`)} title="Edit product" aria-label={`Edit ${product.name}`}><Pencil size={16} /></button>}
                            {canManage && <button className={`icon-button small ${product.active ? '' : 'power-inactive'}`} onClick={() => toggleProduct(product.id)} title={product.active ? 'Deactivate product' : 'Activate product'} aria-label={product.active ? `Deactivate ${product.name}` : `Activate ${product.name}`}><Power size={17} /></button>}
                        </div></td>
                    </tr>)}
                </tbody></table></div> : <EmptyState title="No products match" description="Adjust your filters or add a new product to the catalog." action={<button className="button button-secondary" onClick={reset}>Clear filters</button>} />}
                <Pagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} total={filtered.length} pageSize={pageSize} />
            </section>

            <ProductDetail
                product={selected}
                category={selectedCategory}
                onClose={closeDetail}
                onEdit={() => navigate(`products/edit/${selected.id}`)}
                onRestock={() => setRestockId(selected.id)}
                canManage={canManage}
                canRestock={canRestock}
            />
            {canRestock && <RestockModal open={Boolean(restockId)} product={products.find((p) => p.id === restockId)} onClose={() => setRestockId(null)} />}
        </div>
    );
}

const blankProduct = {
    name: '', sku: '', categoryId: '', price: '', cost: '', minStock: 8, stock: '', active: true, image: '',
};

export function ProductForm({ navigate, productId }) {
    const { products, categories, addProduct, updateProduct } = useStore();
    const existing = products.find((product) => product.id === productId);
    const [form, setForm] = useState(() => existing ? { ...existing } : blankProduct);
    const [errors, setErrors] = useState({});
    const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: '' })); };

    const validate = () => {
        const next = {};
        if (!form.name.trim()) next.name = 'Product name is required.';
        if (!form.sku.trim()) next.sku = 'SKU / product code is required.';
        if (products.some((product) => product.id !== productId && product.sku.toLowerCase() === form.sku.trim().toLowerCase())) next.sku = `SKU “${form.sku}” already exists in the system.`;
        if (!form.categoryId) next.categoryId = 'Select a category.';
        if (form.price === '' || Number(form.price) < 0) next.price = form.price === '' ? 'Selling price is required.' : 'Price cannot be a negative value.';
        if (Number(form.cost) < 0) next.cost = 'Cost price cannot be negative.';
        if (Number(form.minStock) < 0) next.minStock = 'Minimum stock cannot be negative.';
        if (!existing && Number(form.stock) < 0) next.stock = 'Initial stock cannot be negative.';
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const submit = (event) => {
        event.preventDefault();
        if (!validate()) return;
        const payload = { ...form, sku: form.sku.trim().toUpperCase(), name: form.name.trim(), stock: existing ? existing.stock : Number(form.stock || 0) };
        if (existing) updateProduct(existing.id, payload);
        else addProduct(payload);
        navigate('products');
    };

    if (productId && !existing) return <EmptyState title="Product not found" description="This product may have been removed." action={<button className="button button-primary" onClick={() => navigate('products')}>Back to products</button>} />;

    return (
        <div className="product-form-page">
            <PageHeader
                breadcrumb={<><button onClick={() => navigate('products')}>Products</button><ChevronRight size={13} /><span>{existing ? 'Edit Product' : 'Add New Product'}</span></>}
                title={existing ? 'Edit Product' : 'Create New Product'}
                description={existing ? `Update catalog details for ${existing.name}.` : 'Add a new item to the Ape Kade inventory catalog.'}
                actions={<button className="button button-secondary" onClick={() => navigate('products')}><ArrowLeft size={16} />Back to products</button>}
            />
            <form className="card product-form-card" onSubmit={submit} noValidate>
                <div className="product-form-grid">
                    <section className="form-section">
                        <div className="form-section-heading"><span>01</span><div><h2>Identity & Classification</h2><p>Basic details used to identify this product.</p></div></div>
                        <Field label="Product Name" required error={errors.name}><input value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="e.g. Plastic Lunch Box" /></Field>
                        <Field label="SKU / Product Code" required error={errors.sku} hint="Use a unique code such as PL-010."><input className="monospace" value={form.sku} onChange={(event) => set('sku', event.target.value)} placeholder="e.g. PL-010" /></Field>
                        <Field label="Category" required error={errors.categoryId}><select value={form.categoryId} onChange={(event) => set('categoryId', event.target.value)}><option value="">Select a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></Field>
                        <ProductImageUpload value={form.image || ''} onChange={(image) => set('image', image)} />
                        <div className="active-toggle-field"><Toggle checked={form.active} onChange={(value) => set('active', value)} label="Set product as Active" description="Active products can be selected when recording a sale." /></div>
                    </section>
                    <section className="form-section">
                        <div className="form-section-heading"><span>02</span><div><h2>Pricing & Stock Control</h2><p>Set retail pricing and alert thresholds.</p></div></div>
                        <div className="form-grid two-columns">
                            <Field label="Selling Price (Rs)" required error={errors.price}><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => set('price', event.target.value)} placeholder="0.00" /></Field>
                            <Field label="Cost Price (Rs)" error={errors.cost}><input type="number" min="0" step="0.01" value={form.cost} onChange={(event) => set('cost', event.target.value)} placeholder="0.00" /></Field>
                        </div>
                        <Field label="Minimum Stock Level" required error={errors.minStock} hint="Triggers a low-stock alert when quantity reaches this value."><input type="number" min="0" step="1" value={form.minStock} onChange={(event) => set('minStock', event.target.value)} /></Field>
                        {existing ? <Field label="Current Available Stock" hint="Use Add Stock or a completed sale to change inventory quantity."><div className="readonly-input"><strong>{existing.stock} units</strong><StatusBadge status={getStockStatus(existing)} /></div></Field> : <Field label="Initial Available Stock" error={errors.stock} hint="Leave empty to initialize with 0 units."><input type="number" min="0" step="1" value={form.stock} onChange={(event) => set('stock', event.target.value)} placeholder="Enter starting quantity" /></Field>}
                        {form.price > 0 && form.cost >= 0 && <div className="margin-preview"><span>Estimated gross margin</span><strong>{Math.max(0, Math.round(((Number(form.price) - Number(form.cost || 0)) / Number(form.price)) * 100))}%</strong><small>{currency(Number(form.price) - Number(form.cost || 0))} per unit</small></div>}
                    </section>
                </div>
                <div className="form-card-footer"><span>All changes are saved to this browser’s demo database.</span><div><button type="button" className="button button-secondary" onClick={() => navigate('products')}>Cancel</button><button type="submit" className="button button-primary">{existing ? 'Save Changes' : 'Save Product'}<ChevronRight size={16} /></button></div></div>
            </form>
        </div>
    );
}