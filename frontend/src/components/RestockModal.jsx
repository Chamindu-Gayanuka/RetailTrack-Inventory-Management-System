import {useEffect, useMemo, useState} from 'react';
import {PackagePlus} from 'lucide-react';
import {useStore} from '../StoreContext.jsx';
import {Field, Modal} from './UI.jsx';

export default function RestockModal({open, onClose, product = null}) {
    const {products, restock} = useStore();
    const [productId, setProductId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [note, setNote] = useState('Supplier delivery');
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) {
            setProductId(product?.id || '');
            setQuantity('');
            setNote('Supplier delivery');
            setError('');
        }
    }, [open, product]);

    const selected = useMemo(() => products.find((item) => item.id === productId), [productId, products]);
    const submit = (event) => {
        event.preventDefault();
        if (!selected) {
            setError('Select a product to restock.');
            return;
        }
        if (!Number(quantity) || Number(quantity) <= 0) {
            setError('Enter a quantity greater than zero.');
            return;
        }
        if (restock(productId, Number(quantity), note)) onClose();
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Add stock"
            subtitle="Record an inbound stock movement and update available quantity."
            footer={<>
                <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" form="restock-form" className="button button-primary"><PackagePlus size={17}/>Add
                    stock
                </button>
            </>}
        >
            <form id="restock-form" onSubmit={submit} className="form-stack">
                <Field label="Product" required error={error && !selected ? error : ''}>
                    <select value={productId} onChange={(event) => {
                        setProductId(event.target.value);
                        setError('');
                    }} disabled={Boolean(product)}>
                        <option value="">Select a product</option>
                        {products.filter((item) => item.active).map((item) => <option value={item.id}
                                                                                      key={item.id}>{item.name} · {item.sku}</option>)}
                    </select>
                </Field>
                {selected && (
                    <div className="stock-equation">
                        <div><span>Current stock</span><strong>{selected.stock}</strong></div>
                        <span>+</span>
                        <div><span>Adding</span><strong>{Number(quantity) || 0}</strong></div>
                        <span>=</span>
                        <div className="stock-result">
                            <span>New stock</span><strong>{Number(selected.stock) + (Number(quantity) || 0)}</strong>
                        </div>
                    </div>
                )}
                <div className="form-grid two-columns">
                    <Field label="Quantity to add" required error={error && selected ? error : ''}>
                        <input type="number" min="1" step="1" value={quantity} onChange={(event) => {
                            setQuantity(event.target.value);
                            setError('');
                        }} placeholder="e.g. 50" autoFocus={Boolean(product)}/>
                    </Field>
                    <Field label="Reference">
                        <select value={note} onChange={(event) => setNote(event.target.value)}>
                            <option>Supplier delivery</option>
                            <option>Purchase order</option>
                            <option>Stock correction</option>
                            <option>Customer return</option>
                            <option>Manual stock addition</option>
                        </select>
                    </Field>
                </div>
                <div className="info-callout">This movement will appear in Inventory → Movement History with the current
                    user and timestamp.
                </div>
            </form>
        </Modal>
    );
}