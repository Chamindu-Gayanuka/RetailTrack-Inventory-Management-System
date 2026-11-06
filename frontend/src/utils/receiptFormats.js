export const receiptFormats = [
    {id: '80mm', label: '80mm', description: 'Compact receipt', width: 80, printSize: '80mm'},
    {id: 'a5', label: 'A5', description: 'Compact sheet', width: 148, height: 210, printSize: 'A5'},
    {id: 'a4', label: 'A4', description: 'Full page', width: 210, height: 297, printSize: 'A4'},
];

/** @param {string} value */
export function getReceiptFormat(value) {
    return receiptFormats.find((format) => format.id === value) || receiptFormats[0];
}

/** @param {string} value */
export function isReceiptFormat(value) {
    return receiptFormats.some((format) => format.id === value);
}

/**
 * Estimate a safe roll height while keeping fixed A5/A4 pages fixed.
 * @param {import('../types.js').Sale} sale
 * @param {string} [pageSize]
 */
export function getReceiptPageHeight(sale, pageSize = '80mm') {
    const format = getReceiptFormat(pageSize);
    if (format.id !== '80mm') return Number(format.height);
    const itemLines = sale.items.reduce((sum, item) => sum + Math.max(1, Math.ceil(item.name.length / 28)), 0);
    return 165 + sale.items.length * 18 + itemLines * 4 + (Number(sale.refundedTotal || 0) ? 14 : 0);
}