export type Role = 'Administrator' | 'Inventory Staff' | 'Cashier';

export type PeriodMode = 'daily' | 'date' | 'range' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'all';

export interface PeriodState {
    mode: PeriodMode;
    date: string;
    start: string;
    end: string;
    month: string;
    quarter: number;
    year: number;
}

export interface PeriodRange {
    start: Date | null;
    end: Date | null;
    label: string;
    shortLabel: string;
    detail: string;
}

export interface PeriodBucket {
    start: Date;
    end: Date;
    label: string;
}

export interface Product {
    id: string;
    sku: string;
    name: string;
    categoryId: string;
    price: number;
    cost: number;
    stock: number;
    minStock: number;
    active: boolean;
    image?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
}

export interface Category {
    id: string;
    name: string;
    description?: string;
    color?: string;
    [key: string]: unknown;
}

export interface SaleItem {
    productId: string;
    name: string;
    sku: string;
    qty: number;
    price: number;
}

export interface Sale {
    id: string;
    numericId: number;
    customer: string;
    items: SaleItem[];
    total: number;
    payment: string;
    status: string;
    cashier: string;
    createdAt: string;
    completedAt?: string;
}

export interface InventoryTransaction {
    id: string;
    type: string;
    title: string;
    productId: string;
    quantity: number;
    createdAt: string;
    note?: string;
}

export interface UserAccount {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: Role;
    active: boolean;
    emailVerified?: boolean;
    lastActive?: string;
    avatar?: string | null;
}

export interface DemoAccount {
    userId: string;
    name: string;
    email: string;
    password: string;
    role: Role;
    avatar?: string | null;
}

export interface Session {
    userId: string;
    name: string;
    email: string;
    role: Role;
    avatar?: string | null;
    remember: boolean;
}

export interface Profile {
    name: string;
    email: string;
    phone?: string;
    role: Role;
    avatar?: string | null;
    emailVerified?: boolean;
    [key: string]: unknown;
}

export interface StoreSettings {
    storeName: string;
    location: string;
    phone: string;
    email: string;
    currency: string;
    lowStockAlerts: boolean;
    saleNotifications: boolean;
    weeklySummary: boolean;
    emailAlerts: boolean;
}

export interface ToastMessage {
    id: string;
    message: string;
    type: string;
    title?: string;
}

/**
 * Protected views always receive a signed-in session. The login screen only
 * reads settings and is rendered outside those protected views.
 */
export interface StoreValue {
    products: Product[];
    categories: Category[];
    sales: Sale[];
    transactions: InventoryTransaction[];
    users: UserAccount[];
    profile: Profile;
    settings: StoreSettings;
    session: Session;
    toasts: ToastMessage[];
    notify: (message: string, type?: string, title?: string) => string;
    login: (account: DemoAccount, remember?: boolean) => void;
    logout: () => void;
    [key: string]: any;
}