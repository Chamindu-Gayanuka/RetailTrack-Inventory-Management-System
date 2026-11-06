/**
 * @param {import('../types.js').CustomerReturn[]} returns
 * @param {string} saleId
 * @param {string} productId
 */
export function getReturnedQuantity(returns, saleId, productId) {
    return returns.filter((item) => item.saleId === saleId).reduce((sum, record) => sum + record.items.filter((item) => item.productId === productId).reduce((itemSum, item) => itemSum + Number(item.qty), 0), 0);
}

/**
 * @param {import('../types.js').Sale} sale
 * @param {import('../types.js').CustomerReturn[]} returns
 */
export function getNetSaleItems(sale, returns) {
    return sale.items.map((item) => ({
        ...item,
        qty: Math.max(0, item.qty - getReturnedQuantity(returns, sale.id, item.productId))
    })).filter((item) => item.qty > 0);
}

/**
 * @param {import('../types.js').Sale} sale
 * @param {import('../types.js').CustomerReturn[]} [returns]
 */
export function getNetSaleTotal(sale, returns) {
    if (returns) return getNetSaleItems(sale, returns).reduce((sum, item) => sum + item.qty * item.price, 0);
    return Math.max(0, Number(sale.total) - Number(sale.refundedTotal || 0));
}

/** @param {import('../types.js').Sale[]} sales */
export function getNextSaleNumericId(sales) {
    let numericId = Math.max(1032, ...sales.map((sale) => Number(sale.numericId) || Number(String(sale.id).match(/\d+$/)?.[0]) || 0)) + 1;
    while (sales.some((sale) => sale.id === `SALE-${numericId}`)) numericId += 1;
    return numericId;
}