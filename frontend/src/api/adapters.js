/**
 * Converts API records into the shapes the pages already use, and form data into API payloads.
 * The pages never see UUIDs for sales, returns or purchase orders: they keep using the printed
 * document numbers (SALE-1041, RET-1004, PO-000004) as `id`, and the real id is kept as `uuid`.
 */

/** @param {any} user */
export function adaptUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.roleLabel,
        active: user.active,
        emailVerified: user.emailVerified,
        lastActive: user.lastActive || user.createdAt,
        avatar: user.avatar || null,
    };
}

/** @param {any} product */
export function adaptProduct(product) {
    return {
        ...product,
        // Cashiers do not receive the cost price from the API.
        cost: product.cost ?? 0,
        image: product.image || '',
    };
}

/** @param {any} sale */
export function adaptSale(sale) {
    return {
        id: sale.saleNumber,
        uuid: sale.id,
        numericId: sale.numericId,
        customer: sale.customer,
        items: sale.items.map((/** @type {any} */ item) => ({
            productId: item.productId,
            name: item.name,
            sku: item.sku,
            qty: item.qty,
            price: item.price,
        })),
        total: sale.total,
        payment: sale.paymentLabel,
        status: sale.statusLabel,
        cashier: sale.cashier,
        createdAt: sale.createdAt,
        ...(sale.completedAt ? {completedAt: sale.completedAt} : {}),
        ...(sale.refundedTotal ? {refundedTotal: sale.refundedTotal} : {}),
        ...(sale.returnStatusLabel ? {returnStatus: sale.returnStatusLabel} : {}),
    };
}

/** @param {any} record */
export function adaptReturn(record) {
    return {
        id: record.returnNumber,
        uuid: record.id,
        numericId: record.numericId,
        saleId: record.saleId, // already the printed sale number
        customer: record.customer,
        items: record.items.map((/** @type {any} */ item) => ({
            productId: item.productId,
            name: item.name,
            sku: item.sku,
            qty: item.qty,
            price: item.price,
        })),
        total: record.total,
        reason: record.reason,
        processedBy: record.processedBy,
        createdAt: record.createdAt,
    };
}

/** @param {any} order */
export function adaptPurchaseOrder(order) {
    return {
        id: order.poNumber,
        uuid: order.id,
        numericId: order.numericId,
        productId: order.productId,
        sku: order.sku,
        productName: order.productName,
        supplier: order.supplier || '',
        quantity: order.quantity,
        currentStock: order.currentStock,
        minStock: order.minStock,
        unitCost: order.unitCost,
        status: order.statusLabel,
        createdBy: order.createdBy,
        createdAt: order.createdAt,
    };
}

/** @param {any} tx */
export function adaptTransaction(tx) {
    return {
        id: tx.id,
        type: tx.type,
        title: tx.title,
        productId: tx.productId,
        quantity: tx.quantity,
        createdAt: tx.createdAt,
        note: tx.note || tx.reason || '',
    };
}

/** @param {any} settings */
export function adaptSettings(settings) {
    const {updatedAt: _updatedAt, ...rest} = settings;
    return rest;
}

/** Form values from the product page → API body. @param {any} data */
export function toProductBody(data) {
    /** @type {Record<string, unknown>} */
    const body = {
        name: String(data.name || '').trim(),
        categoryId: data.categoryId,
        price: Number(data.price),
        cost: Number(data.cost || 0),
        minStock: Number(data.minStock || 0),
    };
    if (data.sku && String(data.sku).trim()) body.sku = String(data.sku).trim();
    if (data.description !== undefined) body.description = data.description;
    if (data.image !== undefined) body.image = data.image || null;
    return body;
}

/** @param {string} roleLabel */
export function toRoleCode(roleLabel) {
    if (roleLabel === 'Administrator') return 'ADMIN';
    if (roleLabel === 'Inventory Staff') return 'INVENTORY_STAFF';
    return 'CASHIER';
}
