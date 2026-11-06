const knownPrefixes = {plastic: 'PL', school: 'ST', paper: 'PP', household: 'HE'};

/**
 * Generate the next unique, human-readable SKU for a catalog category.
 * @param {import('../types.js').Product[]} products
 * @param {import('../types.js').Category[]} categories
 * @param {string} categoryId
 * @param {string} [excludeProductId]
 */
export function generateProductSku(products, categories, categoryId, excludeProductId = '') {
    const category = categories.find((item) => item.id === categoryId);
    const generatedPrefix = (category?.name || 'Product').replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase().padEnd(2, 'R');
    const prefix = knownPrefixes[/** @type {keyof typeof knownPrefixes} */ (categoryId)] || generatedPrefix || 'PR';
    const matcher = new RegExp(`^${prefix}-(\\d+)$`, 'i');
    const highest = products.filter((product) => product.id !== excludeProductId).reduce((max, product) => {
        const match = String(product.sku).match(matcher);
        return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    let sequence = highest + 1;
    let candidate = `${prefix}-${String(sequence).padStart(3, '0')}`;
    while (products.some((product) => product.id !== excludeProductId && product.sku.toLowerCase() === candidate.toLowerCase())) {
        sequence += 1;
        candidate = `${prefix}-${String(sequence).padStart(3, '0')}`;
    }
    return candidate;
}