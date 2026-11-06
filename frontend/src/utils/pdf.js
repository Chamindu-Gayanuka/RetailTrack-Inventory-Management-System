import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {currency, dateLabel} from '../data.js';
import {getCode39Bars} from './barcode.js';
import {getReceiptFormat, getReceiptPageHeight} from './receiptFormats.js';

/**
 * @param {any} doc
 * @param {string} filename
 */
function saveDocument(doc, filename) {
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        const width = doc.internal.pageSize.getWidth();
        const height = doc.internal.pageSize.getHeight();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(110, 118, 130);
        doc.text(`RetailTrack - Page ${page} of ${pages}`, width / 2, height - 7, {align: 'center'});
    }
    doc.save(filename);
}

/**
 * @param {string} title
 * @param {import('../types.js').StoreSettings} settings
 * @param {string} subtitle
 */
function createA4Document(title, settings, subtitle) {
    const doc = /** @type {any} */ (new jsPDF({unit: 'mm', format: 'a4'}));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(31, 45, 65);
    doc.text(title, 15, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 91, 108);
    doc.text(settings.storeName, 15, 25);
    doc.text(subtitle, 15, 31);
    doc.setDrawColor(220, 225, 232);
    doc.line(15, 36, 195, 36);
    return doc;
}

/**
 * @param {any} doc
 * @param {number} y
 * @param {Array<Array<string|number>>} summary
 */
function writeSummary(doc, y, summary) {
    doc.setFontSize(9.5);
    summary.forEach(([label, value], index) => {
        const line = y + index * 5.5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 110, 124);
        doc.text(String(label), 16, line);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(35, 47, 63);
        doc.text(String(value), 195, line, {align: 'right'});
    });
    return y + summary.length * 5.5 + 4;
}

/**
 * @param {{ filename: string, title: string, settings: import('../types.js').StoreSettings, subtitle: string, summary?: Array<Array<string|number>>, head: Array<string>, body: Array<Array<string|number>>, note?: string }} options
 */
export function downloadReportPdf({filename, title, settings, subtitle, summary = [], head, body, note = ''}) {
    const doc = createA4Document(title, settings, subtitle);
    const startY = summary.length ? writeSummary(doc, 44, summary) : 43;
    autoTable(doc, {
        startY,
        head: [head],
        body: body.length ? body : [['No records available', ...head.slice(1).map(() => '-')]],
        theme: 'grid',
        styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: 2.2,
            textColor: [49, 60, 75],
            lineColor: [225, 229, 235],
            lineWidth: 0.1
        },
        headStyles: {fillColor: [43, 65, 94], textColor: 255, fontStyle: 'bold'},
        alternateRowStyles: {fillColor: [247, 249, 252]},
        margin: {left: 15, right: 15, bottom: 15},
    });
    if (note) {
        let y = doc.lastAutoTable.finalY + 7;
        if (y > 275) {
            doc.addPage();
            y = 20;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(105, 114, 127);
        doc.text(doc.splitTextToSize(note, 180), 15, y);
    }
    saveDocument(doc, filename);
}

/** @param {any} data */
export function downloadBusinessPdf(data) {
    const {settings, products, categories, sales, returns, purchaseOrders, transactions, users} = data;
    const doc = createA4Document('Business Data Export', settings, `Generated ${dateLabel(new Date(), true)}`);
    let y = writeSummary(doc, 44, [
        ['Products', products.length], ['Categories', categories.length], ['Sales', sales.length], ['Customer returns', returns.length],
        ['Purchase orders', purchaseOrders.length], ['Inventory movements', transactions.length], ['User accounts', users.length],
    ]);
    const section = (/** @type {string} */ title, /** @type {string[]} */ head, /** @type {Array<Array<string|number>>} */ body) => {
        if (y > 245) {
            doc.addPage();
            y = 20;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(35, 47, 63);
        doc.text(title, 15, y + 3);
        autoTable(doc, {
            startY: y + 7,
            head: [head],
            body: body.length ? body : [['No records', ...head.slice(1).map(() => '-')]],
            theme: 'striped',
            styles: {font: 'helvetica', fontSize: 7.8, cellPadding: 1.8, lineColor: [230, 233, 238], lineWidth: 0.08},
            headStyles: {fillColor: [52, 76, 106], textColor: 255},
            margin: {left: 15, right: 15, bottom: 15},
        });
        y = doc.lastAutoTable.finalY + 10;
    };
    section('Products', ['SKU', 'Product', 'Category', 'Stock', 'Minimum', 'Retail value'], products.map((/** @type {any} */ product) => [product.sku, product.name, categories.find((/** @type {any} */ category) => category.id === product.categoryId)?.name || '-', product.stock, product.minStock, currency(product.stock * product.price)]));
    section('Sales', ['Sale ID', 'Customer', 'Date', 'Status', 'Total', 'Returned'], sales.map((/** @type {any} */ sale) => [sale.id, sale.customer, dateLabel(sale.createdAt, true), sale.status, currency(sale.total), currency(sale.refundedTotal || 0)]));
    section('Customer Returns', ['Return ID', 'Sale ID', 'Customer', 'Date', 'Refund'], returns.map((/** @type {any} */ item) => [item.id, item.saleId, item.customer, dateLabel(item.createdAt, true), currency(item.total)]));
    section('Purchase Orders', ['Order ID', 'Product', 'Supplier', 'Quantity', 'Created'], purchaseOrders.map((/** @type {any} */ order) => [order.id, order.productName, order.supplier || 'To be assigned', order.quantity, dateLabel(order.createdAt, true)]));
    section('Inventory Movements', ['Movement ID', 'Product ID', 'Type', 'Quantity', 'Date'], transactions.map((/** @type {any} */ item) => [item.id, item.productId, item.type, item.quantity, dateLabel(item.createdAt, true)]));
    section('User Accounts', ['Name', 'Email', 'Role', 'Status'], users.map((/** @type {any} */ user) => [user.name, user.email, user.role, user.active ? 'Active' : 'Inactive']));
    saveDocument(doc, `retailtrack-business-data-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * @param {any} order
 * @param {import('../types.js').StoreSettings} settings
 */
export function downloadPurchaseOrderPdf(order, settings) {
    const doc = createA4Document('PURCHASE ORDER', settings, `${settings.address || settings.location} - ${settings.phone}`);
    let y = writeSummary(doc, 45, [
        ['Order ID', order.id], ['Created', dateLabel(order.createdAt, true)], ['Supplier', order.supplier || 'To be assigned'], ['Created by', order.createdBy],
    ]);
    autoTable(doc, {
        startY: y + 3,
        head: [['SKU', 'Product', 'Current stock', 'Minimum', 'Order quantity', 'Unit cost', 'Estimated amount']],
        body: [[order.sku, order.productName, order.currentStock, order.minStock, order.quantity, currency(order.unitCost), currency(order.quantity * order.unitCost)]],
        theme: 'grid',
        styles: {font: 'helvetica', fontSize: 9, cellPadding: 3},
        headStyles: {fillColor: [43, 65, 94], textColor: 255},
        margin: {left: 15, right: 15},
    });
    y = doc.lastAutoTable.finalY + 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Total estimated cost: ${currency(order.quantity * order.unitCost)}`, 195, y, {align: 'right'});
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 110, 124);
    doc.text('Please confirm availability, final pricing and the delivery date before supplying this order.', 15, y + 15);
    doc.text('Authorized by: ______________________________', 15, y + 38);
    doc.text('Supplier confirmation: ______________________________', 105, y + 38);
    saveDocument(doc, `${order.id}-${order.sku}.pdf`);
}

/**
 * @param {import('../types.js').Sale} sale
 * @param {import('../types.js').StoreSettings} settings
 * @param {ReturnType<typeof getReceiptFormat>} format
 * @param {number} pageHeight
 */
function createReceiptPdf(sale, settings, format, pageHeight) {
    const compact = format.id === '80mm';
    const width = format.width;
    const margin = compact ? 6 : format.id === 'a5' ? 11 : 14;
    const contentWidth = width - margin * 2;
    const refunded = Number(sale.refundedTotal || 0);
    const height = pageHeight;
    const doc = /** @type {any} */ (new jsPDF({unit: 'mm', format: compact ? [width, pageHeight] : format.id}));
    const center = width / 2;
    const markRadius = compact ? 3.2 : 4;
    const addressFont = compact ? 7.5 : 8.5;
    const itemFont = compact ? 8.5 : format.id === 'a5' ? 9.5 : 10.5;
    let y = compact ? 7 : format.id === 'a5' ? 10 : 12;

    const ensureSpace = (/** @type {number} */ needed) => {
        if (compact || y + needed <= height - 10) return;
        doc.addPage();
        doc.setFillColor(63, 111, 214);
        doc.rect(0, 0, width, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(82, 103, 133);
        doc.text(`${sale.id} - continued`, margin, 9);
        y = 16;
    };
    const fitFont = (/** @type {string} */ text, /** @type {number} */ maxWidth, /** @type {number} */ start, /** @type {number} */ minimum = 8) => {
        let size = start;
        doc.setFontSize(size);
        while (doc.getTextWidth(text) > maxWidth && size > minimum) {
            size -= 0.5;
            doc.setFontSize(size);
        }
        return size;
    };

    doc.setFillColor(63, 111, 214);
    doc.rect(0, 0, width, 2, 'F');
    doc.setFillColor(49, 89, 184);
    doc.circle(center, y + markRadius, markRadius, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compact ? 10 : 12);
    doc.setTextColor(255, 255, 255);
    doc.text(settings.storeName?.slice(0, 1).toUpperCase() || 'R', center, y + markRadius + 1.3, {align: 'center'});

    const storeName = settings.storeName || 'RetailTrack';
    const storeFont = fitFont(storeName, contentWidth, compact ? 16 : format.id === 'a5' ? 19 : 22, 12);
    const storeLines = doc.splitTextToSize(storeName, contentWidth);
    const storeLineHeight = storeFont * 0.3528 * 1.15;
    const storeTop = y + markRadius * 2 + 3;
    doc.setTextColor(23, 35, 58);
    doc.text(storeLines, center, storeTop, {align: 'center', baseline: 'top', lineHeightFactor: 1.15});
    y = storeTop + storeLines.length * storeLineHeight + 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(addressFont);
    doc.setTextColor(110, 123, 144);
    const addressLines = doc.splitTextToSize(settings.address || settings.location, contentWidth);
    const addressLineHeight = addressFont * 0.3528 * 1.3;
    doc.text(addressLines, center, y, {align: 'center', baseline: 'top', lineHeightFactor: 1.3});
    y += addressLines.length * addressLineHeight + 1;
    doc.text(`Tel: ${settings.phone}`, center, y, {align: 'center', baseline: 'top'});
    y += addressLineHeight + 5;

    doc.setDrawColor(225, 231, 239);
    doc.line(margin, y, width - margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(135, 147, 166);
    doc.text('SALES RECEIPT', margin, y + 6);
    doc.setFontSize(7.5);
    const statusWidth = Math.max(20, doc.getTextWidth(sale.status) + 7);
    doc.setFillColor(237, 244, 255);
    doc.roundedRect(width - margin - statusWidth, y + 2, statusWidth, 7, 2, 2, 'F');
    doc.setTextColor(53, 109, 196);
    doc.text(sale.status, width - margin - statusWidth / 2, y + 6.5, {align: 'center'});
    doc.setFontSize(12);
    doc.setTextColor(39, 55, 82);
    const saleIdLines = doc.splitTextToSize(sale.id, Math.max(20, contentWidth - statusWidth - 4));
    doc.text(saleIdLines, margin, y + 12, {lineHeightFactor: 1.1});
    y += saleIdLines.length > 1 ? 16 + (saleIdLines.length - 1) * 4 : 15;

    const meta = [['Date', dateLabel(sale.createdAt, true)], ['Customer', sale.customer], ['Cashier', sale.cashier], ['Payment', sale.payment]];
    const columns = format.id === 'a4' ? 4 : 2;
    const gap = 2;
    const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
    const metaFont = compact ? 7.2 : 8.5;
    const metaLineHeight = metaFont * 0.3528 * 1.15;
    for (let row = 0; row < meta.length; row += columns) {
        const values = meta.slice(row, row + columns).map(([, value]) => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(metaFont);
            return doc.splitTextToSize(String(value), cardWidth - 4);
        });
        const lineCount = Math.max(...values.map((lines) => lines.length));
        const cardHeight = Math.max(compact ? 13.5 : 14.5, 9 + lineCount * metaLineHeight);
        ensureSpace(cardHeight + gap);
        meta.slice(row, row + columns).forEach(([label], index) => {
            const x = margin + index * (cardWidth + gap);
            doc.setFillColor(246, 248, 252);
            doc.setDrawColor(237, 240, 245);
            doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(138, 150, 169);
            doc.text(String(label).toUpperCase(), x + 2, y + 4);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(metaFont);
            doc.setTextColor(53, 68, 92);
            doc.text(values[index], x + 2, y + 7.5, {baseline: 'top', lineHeightFactor: 1.15});
        });
        y += cardHeight + gap;
    }
    y += 2;

    ensureSpace(9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(138, 150, 169);
    doc.text('ITEM DETAILS', margin, y);
    doc.text('AMOUNT', width - margin, y, {align: 'right'});
    doc.setDrawColor(225, 231, 239);
    doc.line(margin, y + 2, width - margin, y + 2);
    y += 7;

    sale.items.forEach((item) => {
        const amount = currency(item.qty * item.price);
        doc.setFont('helvetica', 'bold');
        const amountFont = fitFont(amount, contentWidth * 0.38, itemFont, 7);
        const amountWidth = doc.getTextWidth(amount);
        const nameWidth = Math.max(18, contentWidth - amountWidth - 4);
        doc.setFontSize(itemFont);
        const nameLines = doc.splitTextToSize(item.name, nameWidth);
        const nameLineHeight = itemFont * 0.3528 * 1.2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(compact ? 6.8 : 7.5);
        const detailLines = doc.splitTextToSize(`${item.sku} - ${item.qty} x ${currency(item.price)}`, contentWidth);
        const detailLineHeight = compact ? 3 : 3.3;
        const needed = nameLines.length * nameLineHeight + detailLines.length * detailLineHeight + 7;
        ensureSpace(needed);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(itemFont);
        doc.setTextColor(43, 58, 81);
        doc.text(nameLines, margin, y, {baseline: 'top', lineHeightFactor: 1.2});
        doc.setFontSize(amountFont);
        doc.text(amount, width - margin, y, {align: 'right', baseline: 'top'});
        y += nameLines.length * nameLineHeight + 1;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(compact ? 6.8 : 7.5);
        doc.setTextColor(135, 146, 163);
        doc.text(detailLines, margin, y, {baseline: 'top', lineHeightFactor: 1.15});
        y += detailLines.length * detailLineHeight + 2;
        doc.setDrawColor(232, 237, 243);
        doc.line(margin, y, width - margin, y);
        y += 3;
    });

    const totalHeight = refunded ? 31 : 18;
    ensureSpace(totalHeight + 4);
    doc.setFillColor(240, 245, 255);
    doc.setDrawColor(223, 233, 250);
    doc.roundedRect(margin, y, contentWidth, totalHeight, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(82, 103, 133);
    doc.text('Total', margin + 4, y + 8);
    fitFont(currency(sale.total), contentWidth - 30, compact ? 14 : 15, 10);
    doc.setTextColor(49, 95, 185);
    doc.text(currency(sale.total), width - margin - 4, y + 9, {align: 'right'});
    if (refunded) {
        doc.setFontSize(8);
        doc.setTextColor(82, 103, 133);
        doc.text('Returned', margin + 4, y + 17);
        doc.text(`-${currency(refunded)}`, width - margin - 4, y + 17, {align: 'right'});
        doc.setFontSize(10);
        doc.setTextColor(36, 75, 150);
        doc.text('Net total', margin + 4, y + 26);
        doc.text(currency(sale.total - refunded), width - margin - 4, y + 26, {align: 'right'});
    }
    y += totalHeight + 4;

    ensureSpace(34);
    doc.setDrawColor(225, 231, 239);
    doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'S');
    const barcode = getCode39Bars(sale.id);
    const barcodeWidth = Math.min(contentWidth - 12, compact ? 62 : 85);
    const scale = barcodeWidth / barcode.width;
    const barcodeX = center - barcodeWidth / 2;
    doc.setFillColor(23, 32, 51);
    barcode.bars.forEach((bar) => doc.rect(barcodeX + bar.x * scale, y + 3, bar.width * scale, 11, 'F'));
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(83, 97, 119);
    doc.text(sale.id, center, y + 19, {align: 'center'});
    y += 31;

    ensureSpace(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(61, 77, 101);
    doc.text('Thank you for your purchase', center, y, {align: 'center'});
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(135, 146, 163);
    doc.text('Keep this receipt for your records', center, y + 5, {align: 'center'});
    doc.setFontSize(6.5);
    doc.text('Powered by RetailTrack', center, y + 11, {align: 'center'});

    if (!compact && doc.getNumberOfPages() > 1) {
        const pages = doc.getNumberOfPages();
        for (let page = 1; page <= pages; page += 1) {
            doc.setPage(page);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(135, 146, 163);
            doc.text(`${sale.id} - Page ${page} of ${pages}`, center, height - 6, {align: 'center'});
        }
    }
    return {doc, finalY: y};
}

/**
 * @param {import('../types.js').Sale} sale
 * @param {import('../types.js').StoreSettings} settings
 * @param {string} [pageSize]
 */
export function downloadReceiptPdf(sale, settings, pageSize = '80mm') {
    const format = getReceiptFormat(pageSize);
    let result;
    if (format.id === '80mm') {
        const measured = createReceiptPdf(sale, settings, format, getReceiptPageHeight(sale, format.id));
        const exactHeight = Math.max(100, Math.ceil(measured.finalY + 17));
        result = createReceiptPdf(sale, settings, format, exactHeight);
    } else {
        result = createReceiptPdf(sale, settings, format, Number(format.height));
    }
    result.doc.save(`${sale.id}-receipt-${format.id}.pdf`);
}