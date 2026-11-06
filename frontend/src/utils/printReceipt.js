import {getReceiptFormat, getReceiptPageHeight} from './receiptFormats.js';

/**
 * Print only the modern receipt using the selected paper size.
 * @param {import('../types.js').Sale} sale
 * @param {string} [pageSize]
 * @returns {boolean}
 */
export function printPosReceipt(sale, pageSize = '80mm') {
    const saleId = sale.id;
    const receipt = document.getElementById('pos-receipt');
    if (!receipt) return false;
    const format = getReceiptFormat(pageSize);
    const padding = format.id === '80mm' ? '5mm 6mm' : format.id === 'a5' ? '8mm 10mm' : '12mm 15mm';
    const accentMargin = format.id === '80mm' ? '-5mm -6mm 5mm' : format.id === 'a5' ? '-8mm -10mm 5mm' : '-12mm -15mm 6mm';
    const pageHeight = getReceiptPageHeight(sale, format.id);
    const pageDimensions = format.id === '80mm' ? `80mm ${pageHeight}mm` : format.printSize;
    const windowWidth = format.id === 'a4' ? 900 : format.id === 'a5' ? 700 : 420;
    const popup = window.open('', '_blank', `width=${windowWidth},height=800`);
    if (!popup) return false;
    popup.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${saleId} - ${format.label} Receipt</title><style>
    @page { size: ${pageDimensions}; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { width: ${format.width}mm; margin: 0; padding: 0; background: #fff; }
    body { color: #1b2638; font-family: Arial, Helvetica, sans-serif; }
    .pos-receipt { width: 100%; margin: 0; padding: ${padding}; color: #1b2638; background: #fff; font-family: Arial, Helvetica, sans-serif; }
    .receipt-accent { height: 2mm; margin: ${accentMargin}; background: linear-gradient(90deg, #3159b8, #5795ec 65%, #79c7d4); }
    .pos-store-head { text-align: center; break-inside: avoid; }
    .receipt-store-mark { width: 10mm; height: 10mm; display: grid; place-items: center; margin: 0 auto 2.5mm; color: #fff; background: #3f6fd6; border-radius: 2.5mm; font-size: 14pt; font-weight: 800; }
    .pos-store-head h2 { margin: 0; color: #17233a; font-size: ${format.id === 'a4' ? '23pt' : '19pt'}; line-height: 1.2; }
    .pos-store-head p { margin: 1.2mm 0 0; color: #6e7b90; font-size: 8.5pt; line-height: 1.4; }
    .receipt-title-block { display: flex; align-items: center; justify-content: space-between; gap: 4mm; margin-top: 5mm; padding-top: 4mm; border-top: 1px solid #e1e7ef; break-inside: avoid; }
    .receipt-title-block > div { display: flex; flex-direction: column; gap: 1mm; }
    .receipt-title-block > div > span { color: #8793a6; font-size: 7pt; font-weight: 800; letter-spacing: .12em; }
    .receipt-title-block > div > strong { color: #273752; font-size: 12pt; }
    .receipt-status { padding: 1.4mm 2.5mm; color: #356dc4; background: #edf4ff; border: 1px solid #dce9fc; border-radius: 6mm; font-size: 7pt; font-weight: 700; }
    .receipt-status.status-pending { color: #a36c18; background: #fff6e5; }
    .receipt-status.status-cancelled { color: #bb535c; background: #fff0f1; }
    .pos-meta { display: grid; grid-template-columns: repeat(${format.id === 'a4' ? 4 : 2}, minmax(0, 1fr)); gap: 2mm; margin: 4mm 0 0; }
    .pos-meta > div { min-width: 0; padding: 2.4mm; background: #f6f8fc; border: 1px solid #edf0f5; border-radius: 2mm; }
    .pos-meta dt { color: #8a96a9; font-size: 6.5pt; font-weight: 700; text-transform: uppercase; }
    .pos-meta dd { margin: 1.2mm 0 0; color: #35445c; font-size: ${format.id === 'a4' ? '9pt' : '8pt'}; font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; }
    .pos-items { margin-top: 5mm; }
    .pos-item-header { display: flex; justify-content: space-between; gap: 4mm; padding: 0 0 2mm; color: #8a96a9; border-bottom: 1px solid #e1e7ef; font-size: 6.5pt; font-weight: 800; text-transform: uppercase; }
    .pos-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 4mm; padding: 3mm 0; border-bottom: 1px solid #e8edf3; break-inside: avoid; }
    .pos-item > div { min-width: 0; }
    .pos-item > div > strong { display: block; color: #2b3a51; font-size: ${format.id === 'a4' ? '10pt' : '8.5pt'}; line-height: 1.35; }
    .pos-item small { display: block; margin-top: 1mm; color: #8792a3; font-size: 7pt; line-height: 1.35; }
    .pos-item > strong { flex-shrink: 0; color: #273752; font-size: ${format.id === 'a4' ? '10pt' : '8.5pt'}; white-space: nowrap; }
    .pos-total-panel { margin-top: 4mm; padding: 3.5mm; background: #f0f5ff; border: 1px solid #dfe9fa; border-radius: 2.5mm; break-inside: avoid; }
    .pos-totals { margin: 0; }
    .pos-totals > div { display: flex; align-items: center; justify-content: space-between; gap: 4mm; }
    .pos-totals > div + div { margin-top: 2mm; padding-top: 2mm; border-top: 1px solid #dfe7f3; }
    .pos-totals dt { color: #526785; font-size: 9pt; font-weight: 700; }
    .pos-totals dd { margin: 0; color: #315fb9; font-size: 15pt; font-weight: 800; }
    .receipt-barcode-panel { margin-top: 4mm; padding: 3mm; border: 1px solid #e1e7ef; border-radius: 2mm; break-inside: avoid; }
    .code39-barcode { margin: 0 auto; text-align: center; }
    .code39-barcode svg { display: block; width: ${format.id === 'a4' ? '85mm' : '62mm'}; max-width: 100%; height: 13mm; margin: 0 auto; fill: #172033; }
    .code39-barcode strong { display: block; margin-top: 1.5mm; color: #536177; font-family: monospace; font-size: 8pt; letter-spacing: 1px; }
    .pos-footer { display: flex; flex-direction: column; gap: 1.2mm; margin-top: 4mm; text-align: center; break-inside: avoid; }
    .pos-footer strong { color: #3d4d65; font-size: 8.5pt; }
    .pos-footer span { color: #8792a3; font-size: 7pt; }
    .pos-footer small { margin-top: 1mm; color: #a0a9b7; font-size: 6.5pt; }
  </style></head><body>${receipt.outerHTML}</body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => {
        popup.print();
        popup.onafterprint = () => popup.close();
    }, 200);
    return true;
}