import { useEffect, useState } from 'react';
import {
    Boxes,
    ChevronRight,
    Layers,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { useStore } from '../StoreContext.jsx';
import { currency, getStockStatus } from '../data.js';
import { Field, Modal, PageHeader, ProgressBar, StatCard } from '../components/UI.jsx';

const palette = ['#6574e8', '#2f9d8f', '#e5a43a', '#de6c75', '#3d9bc2', '#9b6bd6'];

function CategoryForm({ open, onClose, category }) {
    const { categories, addCategory, updateCategory } = useStore();
    const [form, setForm] = useState({ name: '', description: '', color: palette[0] });
    const [error, setError] = useState('');
    useEffect(() => {
        if (open) {
            setForm(category ? { ...category } : { name: '', description: '', color: palette[categories.length % palette.length] });
            setError('');
        }
    }, [open, category, categories.length]);
    const submit = (event) => {
        event.preventDefault();
        if (!form.name.trim()) { setError('Category name is required.'); return; }
        if (categories.some((item) => item.id !== category?.id && item.name.toLowerCase() === form.name.trim().toLowerCase())) { setError('A category with this name already exists.'); return; }
        if (category) updateCategory(category.id, form);
        else addCategory(form);
        onClose();
    };
    return (
        <Modal open={open} onClose={onClose} title={category ? 'Edit category' : 'Create category'} subtitle="Organize related products for easier tracking and reporting." footer={<><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" form="category-form">{category ? 'Save changes' : 'Create category'}</button></>}>
            <form id="category-form" onSubmit={submit} className="form-stack">
                <Field label="Category name" required error={error}><input value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); setError(''); }} placeholder="e.g. Kitchen Essentials" autoFocus /></Field>
                <Field label="Description" hint="A short note about the products in this category."><textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What belongs in this category?" /></Field>
                <Field label="Category color"><div className="color-picker">{palette.map((color) => <button type="button" key={color} className={form.color === color ? 'selected' : ''} style={{ '--swatch': color }} onClick={() => setForm({ ...form, color })} aria-label={`Select color ${color}`} />)}</div></Field>
            </form>
        </Modal>
    );
}

export default function Categories({ navigate }) {
    const { categories, products, deleteCategory } = useStore();
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const totalUnits = products.reduce((sum, product) => sum + product.stock, 0);

    const openEdit = (category) => { setEditing(category); setFormOpen(true); };
    const closeForm = () => { setFormOpen(false); setEditing(null); };

    return (
        <div>
            <PageHeader title="Categories" description="Organize your catalog and understand stock across product groups." actions={<button className="button button-primary" onClick={() => setFormOpen(true)}><Plus size={17} />Add Category</button>} />
            <section className="stats-grid compact-stats category-stats">
                <StatCard icon={Layers} label="Total Categories" value={categories.length} note="Active catalog groups" tone="blue" />
                <StatCard icon={Boxes} label="Products Assigned" value={products.length} note={`${totalUnits.toLocaleString()} total units`} tone="indigo" />
                <StatCard icon={MoreHorizontal} label="Largest Category" value={[...categories].sort((a, b) => products.filter((p) => p.categoryId === b.id).length - products.filter((p) => p.categoryId === a.id).length)[0]?.name || '-'} note="By number of products" tone="green" />
            </section>
            <section className="category-grid">
                {categories.map((category) => {
                    const items = products.filter((product) => product.categoryId === category.id);
                    const units = items.reduce((sum, product) => sum + product.stock, 0);
                    const low = items.filter((product) => product.active && ['low', 'out'].includes(getStockStatus(product))).length;
                    const value = items.reduce((sum, product) => sum + product.stock * product.cost, 0);
                    return (
                        <article className="card category-card" key={category.id} style={{ '--category-color': category.color }}>
                            <div className="category-card-top"><span className="category-icon"><Layers size={23} /></span><div className="row-actions"><button className="icon-button small" onClick={() => openEdit(category)} aria-label={`Edit ${category.name}`}><Pencil size={16} /></button><button className="icon-button small" onClick={() => setDeleting(category)} aria-label={`Delete ${category.name}`}><Trash2 size={16} /></button></div></div>
                            <h2>{category.name}</h2><p>{category.description || 'No category description provided.'}</p>
                            <div className="category-metrics"><div><strong>{items.length}</strong><span>Products</span></div><div><strong>{units.toLocaleString()}</strong><span>Units</span></div><div><strong className={low ? 'text-warning' : ''}>{low}</strong><span>Stock alerts</span></div></div>
                            <div className="category-value"><span>Inventory value</span><strong>{currency(value)}</strong></div>
                            <ProgressBar value={items.length} max={Math.max(products.length, 1)} color={category.color} />
                            <button className="category-view-button" onClick={() => navigate(`products/category/${category.id}`)}>View products <ChevronRight size={16} /></button>
                        </article>
                    );
                })}
                <button className="category-add-card" onClick={() => setFormOpen(true)}><span><Plus size={25} /></span><strong>Create a new category</strong><small>Keep your growing catalog organized</small></button>
            </section>
            <CategoryForm open={formOpen} onClose={closeForm} category={editing} />
            <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete category?" subtitle="This action cannot be undone." footer={<><button className="button button-secondary" onClick={() => setDeleting(null)}>Cancel</button><button className="button button-danger" onClick={() => { if (deleting && deleteCategory(deleting.id)) setDeleting(null); }}>Delete category</button></>}>
                <p className="modal-paragraph">You’re about to delete <strong>{deleting?.name}</strong>. Categories with assigned products cannot be deleted.</p>
            </Modal>
        </div>
    );
}