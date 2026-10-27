export const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-LK', {maximumFractionDigits: 0})}`;
export const number = (value) => Number(value || 0).toLocaleString('en-LK');

export const dateLabel = (value, withTime = false) => {
    if (!value) return '-';
    const date = new Date(value);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(withTime ? {hour: '2-digit', minute: '2-digit'} : {}),
    });
};

export const relativeTime = (value) => {
    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.max(0, Math.floor(diff / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
};

export const daysAgo = (days, hour = 10, minute = 0) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
};

export const seedCategories = [
    {
        id: 'plastic',
        name: 'Plastic Items',
        description: 'Buckets, chairs, storage and everyday plastic goods.',
        color: '#6574e8'
    },
    {
        id: 'school',
        name: 'School Supplies',
        description: 'Books, stationery and learning essentials.',
        color: '#2f9d8f'
    },
    {
        id: 'household',
        name: 'Household Essentials',
        description: 'Daily household and cleaning products.',
        color: '#e5a43a'
    },
    {
        id: 'paper',
        name: 'Paper & Packaging',
        description: 'Paper bundles, wrapping and packing supplies.',
        color: '#de6c75'
    },
];

export const seedProducts = [
    ['p1', 'PL-001', 'Plastic Bucket 10L', 'plastic', 450, 285, 45, 10],
    ['p2', 'PL-002', 'Plastic Chair (Standard)', 'plastic', 1250, 790, 7, 12],
    ['p3', 'PL-003', 'Plastic Lunch Box', 'plastic', 380, 220, 62, 15],
    ['p4', 'PL-004', 'Water Jug 2L', 'plastic', 550, 340, 0, 8],
    ['p5', 'PL-005', 'Storage Container 5L', 'plastic', 890, 560, 24, 10],
    ['p6', 'PL-006', 'Plastic Basin 12L', 'plastic', 420, 255, 31, 10],
    ['p7', 'PL-007', 'Dish Rack', 'plastic', 1450, 940, 18, 5],
    ['p8', 'PL-008', 'Plastic Waste Bin', 'plastic', 780, 490, 9, 10],
    ['p9', 'ST-001', 'A4 Drawing Book', 'school', 240, 145, 0, 10],
    ['p10', 'ST-002', 'Pencil Box (Packet of 12)', 'school', 1680, 1120, 4, 5],
    ['p11', 'ST-003', 'Blue Ballpoint Pen', 'school', 60, 32, 12, 15],
    ['p12', 'PP-001', 'A4 Paper Bundle 80GSM', 'paper', 1450, 1080, 8, 50],
    ['p13', 'ST-004', 'School Books 200Pgs', 'school', 320, 205, 14, 40],
    ['p14', 'ST-005', 'Bristol Board - White', 'school', 95, 54, 19, 45],
    ['p15', 'ST-006', 'Colour Pencils (12 Pack)', 'school', 650, 410, 36, 12],
    ['p16', 'ST-007', 'Geometry Box', 'school', 780, 510, 22, 8],
    ['p17', 'ST-008', 'Glue Stick 20g', 'school', 180, 105, 54, 20],
    ['p18', 'ST-009', 'Exercise Book 80 Pages', 'school', 140, 82, 86, 30],
    ['p19', 'ST-010', 'Safety Scissors', 'school', 350, 205, 17, 8],
    ['p20', 'HH-001', '1L Water Bottle', 'household', 120, 68, 11, 30],
    ['p21', 'PP-002', 'Brown Paper Bundles', 'paper', 550, 355, 5, 25],
    ['p22', 'HH-002', 'Hand Wash 500ml', 'household', 620, 390, 28, 12],
    ['p23', 'HH-003', 'Floor Mop', 'household', 1150, 760, 16, 6],
    ['p24', 'HH-004', 'Kitchen Towel Roll', 'household', 290, 175, 42, 15],
    ['p25', 'PP-003', 'Gift Wrapper Roll', 'paper', 380, 225, 27, 10],
    ['p26', 'PP-004', 'Packing Tape', 'paper', 310, 185, 33, 12],
    ['p27', 'ST-011', 'Whiteboard Marker', 'school', 220, 130, 6, 10],
    ['p28', 'ST-012', 'Plastic File Holder', 'school', 890, 560, 20, 8],
    ['p29', 'HH-005', 'Steel Flask 750ml', 'household', 1890, 1270, 13, 5],
    ['p30', 'HH-006', 'Insulated Lunch Bag', 'household', 1350, 880, 0, 6],
    ['p31', 'PL-009', 'Disposable Cups (50 Pack)', 'plastic', 420, 260, 38, 12],
].map(([id, sku, name, categoryId, price, cost, stock, minStock], index) => ({
    id, sku, name, categoryId, price, cost, stock, minStock,
    active: true,
    updatedAt: daysAgo(index % 7, 9 + (index % 5), 15),
    createdAt: daysAgo(90 + index),
}));

export const getStockStatus = (product) => {
    if (!product.active) return 'inactive';
    if (Number(product.stock) === 0) return 'out';
    if (Number(product.stock) <= Number(product.minStock)) return 'low';
    return 'in';
};

export const getSeverity = (product) => {
    if (Number(product.stock) === 0) return 'critical';
    if (Number(product.stock) <= Number(product.minStock)) return 'low';
    return 'healthy';
};

export const statusLabel = {
    in: 'In Stock',
    low: 'Low Stock',
    out: 'Out of Stock',
    inactive: 'Inactive',
    critical: 'Critical',
    Completed: 'Completed',
    Pending: 'Pending',
    Cancelled: 'Cancelled',
    Active: 'Active',
};

const productById = Object.fromEntries(seedProducts.map((p) => [p.id, p]));
const makeSale = (numericId, customer, createdAt, itemRows, status = 'Completed', payment = 'Cash') => {
    const items = itemRows.map(([productId, qty]) => {
        const product = productById[productId];
        return {productId, name: product.name, sku: product.sku, qty, price: product.price};
    });
    return {
        id: `SALE-${numericId}`,
        numericId,
        customer,
        createdAt,
        items,
        total: items.reduce((sum, item) => sum + item.qty * item.price, 0),
        status,
        payment,
        cashier: 'Chamindu Gayanuka',
    };
};

export const seedSales = [
    makeSale(1032, 'Nadeesha Perera', daysAgo(0, 11, 24), [['p5', 4], ['p15', 2]]),
    makeSale(1031, 'Kasun Rathnayake', daysAgo(0, 9, 58), [['p2', 4], ['p12', 3], ['p18', 10]]),
    makeSale(1030, 'Amal Wijesinghe', daysAgo(0, 8, 42), [['p7', 3], ['p3', 5], ['p11', 10]]),
    makeSale(1029, 'Chathura Madushan', daysAgo(1, 18, 15), [['p1', 3], ['p16', 2], ['p6', 2]], 'Pending'),
    makeSale(1028, 'Gayan Bandara', daysAgo(1, 14, 30), [['p6', 1], ['p22', 1]]),
    makeSale(1027, 'Ishara Fernando', daysAgo(1, 11, 12), [['p29', 2], ['p24', 4]]),
    makeSale(1026, 'Saman Kumara', daysAgo(2, 16, 45), [['p23', 3], ['p20', 12], ['p26', 4]]),
    makeSale(1025, 'Dilshan Silva', daysAgo(2, 10, 20), [['p28', 4], ['p19', 3], ['p17', 5]]),
    makeSale(1024, 'Walk-in Customer', daysAgo(3, 15, 8), [['p31', 8], ['p25', 5], ['p21', 2]]),
    makeSale(1023, 'Mahesh Jayasinghe', daysAgo(4, 12, 30), [['p8', 3], ['p4', 2], ['p3', 4]]),
    makeSale(1022, 'Walk-in Customer', daysAgo(5, 9, 15), [['p18', 20], ['p14', 15], ['p11', 20]]),
    makeSale(1021, 'Ruwan Dissanayake', daysAgo(6, 14, 5), [['p27', 8], ['p13', 6], ['p10', 2]]),
];

export const seedTransactions = [
    {
        id: 'tx1',
        type: 'outbound',
        title: 'Sale #SALE-1032',
        productId: 'p5',
        quantity: 4,
        createdAt: daysAgo(0, 11, 24),
        note: 'Sale completed'
    },
    {
        id: 'tx2',
        type: 'inbound',
        title: 'Restock A4 Paper Bundle',
        productId: 'p12',
        quantity: 30,
        createdAt: daysAgo(0, 10, 24),
        note: 'Supplier delivery'
    },
    {
        id: 'tx3',
        type: 'outbound',
        title: 'Sale #SALE-1031',
        productId: 'p2',
        quantity: 4,
        createdAt: daysAgo(0, 9, 58),
        note: 'Sale completed'
    },
    {
        id: 'tx4',
        type: 'inbound',
        title: 'Restock School Books',
        productId: 'p13',
        quantity: 50,
        createdAt: daysAgo(1, 15, 20),
        note: 'Weekly stock order'
    },
    {
        id: 'tx5',
        type: 'outbound',
        title: 'Sale #SALE-1028',
        productId: 'p6',
        quantity: 1,
        createdAt: daysAgo(1, 14, 30),
        note: 'Sale completed'
    },
    {
        id: 'tx6',
        type: 'inbound',
        title: 'Restock Plastic Buckets',
        productId: 'p1',
        quantity: 24,
        createdAt: daysAgo(2, 9, 10),
        note: 'Supplier delivery'
    },
];

export const seedUsers = [
    {
        id: 'u1',
        name: 'Chamindu Gayanuka',
        email: 'chamindu@apekade.lk',
        phone: '+94 76 294 4551',
        role: 'Administrator',
        active: true,
        lastActive: daysAgo(0, 11, 42)
    },
    {
        id: 'u2',
        name: 'Sandun Madushan',
        email: 'sandun@apekade.lk',
        phone: '+94 71 438 2094',
        role: 'Inventory Staff',
        active: true,
        lastActive: daysAgo(0, 10, 15)
    },
    {
        id: 'u3',
        name: 'Chathuranga Sampath',
        email: 'chathuranga@apekade.lk',
        phone: '+94 77 890 1245',
        role: 'Cashier',
        active: true,
        lastActive: daysAgo(1, 17, 30)
    },
    {
        id: 'u4',
        name: 'Dilwan Thennakoon',
        email: 'dilwan@apekade.lk',
        phone: '+94 75 622 8103',
        role: 'Inventory Staff',
        active: true,
        lastActive: daysAgo(2, 14, 5)
    },
    {
        id: 'u5',
        name: 'Nimal Perera',
        email: 'nimal@apekade.lk',
        phone: '+94 70 552 7642',
        role: 'Cashier',
        active: false,
        lastActive: daysAgo(18, 9, 20)
    },
];

export const initialProfile = {
    name: 'Chamindu Gayanuka',
    email: 'chamindu@apekade.lk',
    phone: '+94 76 294 4551',
    role: 'Administrator',
    avatar: '',
};

export const demoAccounts = [
    {
        userId: 'u1',
        name: 'Chamindu Gayanuka',
        email: 'chamindu@apekade.lk',
        password: 'demo1234',
        role: 'Administrator',
        avatar: ''
    },
    {
        userId: 'u2',
        name: 'Sandun Madushan',
        email: 'sandun@apekade.lk',
        password: 'demo1234',
        role: 'Inventory Staff',
        avatar: null
    },
    {
        userId: 'u3',
        name: 'Chathuranga Sampath',
        email: 'chathuranga@apekade.lk',
        password: 'demo1234',
        role: 'Cashier',
        avatar: null
    },
];

export const rolePermissions = {
    Administrator: ['Full Inventory Access', 'User Management', 'Financial Reporting', 'Audit Logs'],
    'Inventory Staff': ['View Products', 'Add and Update Stock', 'View Stock Alerts', 'Inventory Summaries'],
    Cashier: ['Search Products', 'Check Available Stock', 'Process Customer Sales', 'View Sales History'],
};

export const initialSettings = {
    storeName: 'Ape Kade',
    location: 'Padiyathalawa',
    phone: '+94 55 224 6800',
    email: 'hello@apekade.lk',
    currency: 'Sri Lankan Rupee (LKR)',
    lowStockAlerts: true,
    saleNotifications: true,
    weeklySummary: true,
    emailAlerts: false,
};

export const salesWeek = [
    {label: 'Mon', value: 18500, orders: 12},
    {label: 'Tue', value: 21800, orders: 15},
    {label: 'Wed', value: 19600, orders: 13},
    {label: 'Thu', value: 24800, orders: 18},
    {label: 'Fri', value: 21500, orders: 16},
    {label: 'Sat', value: 28700, orders: 22},
    {label: 'Sun', value: 26450, orders: 19},
];

export const salesMonth = [
    {label: 'Week 1', value: 112400, orders: 84},
    {label: 'Week 2', value: 126800, orders: 91},
    {label: 'Week 3', value: 118200, orders: 87},
    {label: 'Week 4', value: 141600, orders: 103},
];