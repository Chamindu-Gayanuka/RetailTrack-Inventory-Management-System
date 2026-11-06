import {currency, dateLabel} from '../data.js';
import {getReceiptFormat} from '../utils/receiptFormats.js';
import Code39Barcode from './Code39Barcode.jsx';

/** @param {{ sale: import('../types.js').Sale, settings: import('../types.js').StoreSettings, format?: string }} props */
export default function PosReceipt({sale, settings, format = '80mm'}) {
    const refunded = Number(sale.refundedTotal || 0);
    const pageFormat = getReceiptFormat(format).id;
    return (
        <article className={`pos-receipt receipt-format-${pageFormat}`} id="pos-receipt" data-page-size={pageFormat}
                 aria-label={`Sales receipt ${sale.id}`}>
            <div className="receipt-accent"/>
            <header className="pos-store-head">
                <span className="receipt-store-mark">{settings.storeName?.slice(0, 1) || 'R'}</span>
                <h2>{settings.storeName}</h2>
                <p>{settings.address || settings.location}</p>
                <p>Tel: {settings.phone}</p>
            </header>
            <section className="receipt-title-block">
                <div><span>SALES RECEIPT</span><strong>{sale.id}</strong></div>
                <span className={`receipt-status status-${sale.status.toLowerCase()}`}>{sale.status}</span>
            </section>
            <dl className="pos-meta">
                <div>
                    <dt>Date</dt>
                    <dd>{dateLabel(sale.createdAt, true)}</dd>
                </div>
                <div>
                    <dt>Customer</dt>
                    <dd>{sale.customer}</dd>
                </div>
                <div>
                    <dt>Cashier</dt>
                    <dd>{sale.cashier}</dd>
                </div>
                <div>
                    <dt>Payment</dt>
                    <dd>{sale.payment}</dd>
                </div>
            </dl>
            <section className="pos-items" aria-label="Purchased items">
                <div className="pos-item-header"><span>Item details</span><span>Amount</span></div>
                {sale.items.map((item) => <div className="pos-item" key={item.productId}>
                    <div><strong>{item.name}</strong><small>{item.sku} - {item.qty} x {currency(item.price)}</small>
                    </div>
                    <strong>{currency(item.qty * item.price)}</strong>
                </div>)}
            </section>
            <section className="pos-total-panel">
                <dl className="pos-totals">
                    <div>
                        <dt>Total</dt>
                        <dd>{currency(sale.total)}</dd>
                    </div>
                    {refunded > 0 && <>
                        <div>
                            <dt>Returned</dt>
                            <dd>-{currency(refunded)}</dd>
                        </div>
                        <div className="pos-grand-total">
                            <dt>Net total</dt>
                            <dd>{currency(sale.total - refunded)}</dd>
                        </div>
                    </>}
                </dl>
            </section>
            <div className="receipt-barcode-panel"><Code39Barcode value={sale.id}/></div>
            <footer className="pos-footer"><strong>Thank you for your purchase</strong><span>Keep this receipt for your records</span><small>Powered
                by RetailTrack</small></footer>
        </article>
    );
}