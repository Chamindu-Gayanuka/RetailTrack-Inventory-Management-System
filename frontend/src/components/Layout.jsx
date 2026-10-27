import {useEffect, useMemo, useRef, useState} from 'react';
import {
    BarChart3,
    Bell,
    Box,
    ChevronDown,
    ChevronRight,
    CircleAlert,
    Layers,
    LayoutDashboard,
    LogOut,
    Menu,
    Package,
    PackageOpen,
    Search,
    Settings,
    ShoppingCart,
    SlidersHorizontal,
    Tag,
    UserRound,
    Users,
    Warehouse,
    X,
} from 'lucide-react';
import {currency, getStockStatus, relativeTime} from '../data.js';
import {useStore} from '../StoreContext.jsx';
import {Avatar, ToastViewport} from './UI.jsx';

const allRoles = ['Administrator', 'Inventory Staff', 'Cashier'];
const adminAndStaff = ['Administrator', 'Inventory Staff'];
const adminAndCashier = ['Administrator', 'Cashier'];
const navigation = [
    {id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: allRoles},
    {id: 'products', label: 'Products', icon: Package, roles: allRoles},
    {id: 'categories', label: 'Categories', icon: Layers, roles: ['Administrator']},
    {id: 'inventory', label: 'Inventory', icon: Warehouse, roles: adminAndStaff},
    {id: 'sales', label: 'Sales', icon: Tag, roles: adminAndCashier},
    {id: 'reports', label: 'Report & Analytics', icon: BarChart3, roles: adminAndStaff},
    {id: 'users', label: 'Users', icon: Users, roles: ['Administrator']},
    {id: 'settings', label: 'Settings', icon: Settings, roles: ['Administrator']},
];

function Brand() {
    return (
        <div className="brand">
            <span className="brand-mark"><PackageOpen size={25} strokeWidth={1.8}/></span>
            <div><strong>RetailTrack</strong><span>Inventory Management System</span></div>
        </div>
    );
}

function SidebarSearch({navigate, onClose}) {
    const {products, sales, session} = useStore();
    const [query, setQuery] = useState('');
    const term = query.trim().toLowerCase();
    const menuResults = term ? navigation.filter((item) => item.roles.includes(session.role) && item.label.toLowerCase().includes(term)).slice(0, 3) : [];
    const productResults = term ? products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(term)).slice(0, 4) : [];
    const saleResults = term && session.role !== 'Inventory Staff' ? sales.filter((sale) => `${sale.id} ${sale.customer}`.toLowerCase().includes(term)).slice(0, 3) : [];
    const resultCount = menuResults.length + productResults.length + saleResults.length;
    const select = (path) => {
        navigate(path);
        setQuery('');
        onClose();
    };
    return (
        <div className="sidebar-search-area">
            <div className="sidebar-search-input">
                <Search size={18}/>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search…"
                       aria-label="Search from side menu"/>
                {query &&
                    <button onClick={() => setQuery('')} aria-label="Clear sidebar search"><X size={14}/></button>}
            </div>
            {term && (
                <div className="sidebar-search-results">
                    {menuResults.length > 0 &&
                        <div className="sidebar-result-group"><span>Menu</span>{menuResults.map((item) => {
                            const Icon = item.icon;
                            return <button key={item.id} onClick={() => select(item.id)}><Icon
                                size={15}/><strong>{item.label}</strong><ChevronRight size={13}/></button>;
                        })}</div>}
                    {productResults.length > 0 &&
                        <div className="sidebar-result-group"><span>Products</span>{productResults.map((product) =>
                            <button key={product.id} onClick={() => select(`products/view/${product.id}`)}><Package
                                size={15}/><span><strong>{product.name}</strong><small>{product.sku} · {product.stock} units</small></span><ChevronRight
                                size={13}/></button>)}</div>}
                    {saleResults.length > 0 &&
                        <div className="sidebar-result-group"><span>Sales</span>{saleResults.map((sale) => <button
                            key={sale.id} onClick={() => select(`sales/view/${sale.id}`)}><Tag
                            size={15}/><span><strong>{sale.id}</strong><small>{sale.customer} · {currency(sale.total)}</small></span><ChevronRight
                            size={13}/></button>)}</div>}
                    {!resultCount && <div className="sidebar-search-empty">No matches for “{query}”</div>}
                </div>
            )}
        </div>
    );
}

function Sidebar({route, navigate, open, onClose}) {
    const {products, settings, session} = useStore();
    const lowCount = products.filter((product) => product.active && ['low', 'out'].includes(getStockStatus(product))).length;
    return (
        <>
            <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
                <div className="sidebar-top">
                    <Brand/>
                    <button className="sidebar-close" onClick={onClose} aria-label="Close navigation"><X size={20}/>
                    </button>
                </div>
                <nav className="sidebar-nav">
                    <SidebarSearch navigate={navigate} onClose={onClose}/>
                    <div className="nav-spacer"/>
                    {navigation.filter((item) => item.roles.includes(session.role)).map((item) => {
                        const active = route === item.id || route.startsWith(`${item.id}/`);
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                className={`nav-item ${active ? 'active' : ''}`}
                                onClick={() => {
                                    navigate(item.id);
                                    onClose();
                                }}
                                aria-current={active ? 'page' : undefined}
                            >
                                <Icon size={19} strokeWidth={active ? 2.1 : 1.8}/>
                                <span>{item.label}</span>
                                {item.id === 'inventory' && lowCount > 0 &&
                                    <span className="nav-count">{lowCount}</span>}
                            </button>
                        );
                    })}
                </nav>
                <div className="sidebar-bottom">
                    {session.role !== 'Cashier' && <button className="sidebar-alert" onClick={() => {
                        navigate('inventory/alerts');
                        onClose();
                    }}>
                        <span className="sidebar-alert-icon"><CircleAlert size={18}/></span>
                        <span><strong>{lowCount} stock alerts</strong><small>Review items that need attention</small></span>
                        <ChevronRight size={16}/>
                    </button>}
                    <div className="store-identity">
                        <span className="store-monogram">{settings.storeName?.slice(0, 1) || 'A'}</span>
                        <div><strong>{settings.storeName}</strong><span>{settings.location}</span></div>
                        <span className="online-dot" title="System online"/>
                    </div>
                </div>
            </aside>
            {open && <button className="sidebar-overlay" onClick={onClose} aria-label="Close navigation overlay"/>}
        </>
    );
}

function SearchBox({navigate, mobile = false}) {
    const {products, sales, session} = useStore();
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        const focusSearch = () => inputRef.current?.focus();
        const keyHandler = (event) => {
            if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                event.preventDefault();
                inputRef.current?.focus();
            }
            if (event.key === 'Escape') {
                setQuery('');
                inputRef.current?.blur();
            }
        };
        window.addEventListener('retailtrack:focus-search', focusSearch);
        window.addEventListener('keydown', keyHandler);
        return () => {
            window.removeEventListener('retailtrack:focus-search', focusSearch);
            window.removeEventListener('keydown', keyHandler);
        };
    }, []);

    useEffect(() => {
        const close = (event) => {
            if (!containerRef.current?.contains(event.target)) setFocused(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const results = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return {products: [], sales: []};
        return {
            products: products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(term)).slice(0, 5),
            sales: session.role === 'Inventory Staff' ? [] : sales.filter((sale) => `${sale.id} ${sale.customer}`.toLowerCase().includes(term)).slice(0, 3),
        };
    }, [products, query, sales, session.role]);

    const hasResults = results.products.length > 0 || results.sales.length > 0;
    const select = (path) => {
        navigate(path);
        setQuery('');
        setFocused(false);
        inputRef.current?.blur();
    };

    return (
        <div className={`global-search ${mobile ? 'mobile-search' : ''}`} ref={containerRef}>
            <Search size={20}/>
            <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setFocused(true)}
                placeholder="Search products, SKUs, orders…"
                aria-label="Global search"
            />
            {query ?
                <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={16}/>
                </button> : <kbd>/</kbd>}
            {focused && query.trim() && (
                <div className="search-results popover">
                    {hasResults ? (
                        <>
                            {results.products.length > 0 &&
                                <div className="search-group"><span className="search-group-title">Products</span>
                                    {results.products.map((product) => (
                                        <button key={product.id} onClick={() => select(`products/view/${product.id}`)}>
                                            <span className="search-result-icon"><Box size={17}/></span>
                                            <span><strong>{product.name}</strong><small>{product.sku} · {product.stock} in stock</small></span>
                                            <span className="search-result-value">{currency(product.price)}</span>
                                        </button>
                                    ))}
                                </div>}
                            {results.sales.length > 0 &&
                                <div className="search-group"><span className="search-group-title">Sales</span>
                                    {results.sales.map((sale) => (
                                        <button key={sale.id} onClick={() => select(`sales/view/${sale.id}`)}>
                                            <span className="search-result-icon sale"><ShoppingCart size={17}/></span>
                                            <span><strong>{sale.id}</strong><small>{sale.customer}</small></span>
                                            <span className="search-result-value">{currency(sale.total)}</span>
                                        </button>
                                    ))}
                                </div>}
                        </>
                    ) : <div className="search-no-results"><Search size={22}/><strong>No results for
                        “{query}”</strong><span>Try a product name, SKU or sale ID.</span></div>}
                </div>
            )}
        </div>
    );
}

function Notifications({navigate}) {
    const {products, sales, session} = useStore();
    const [open, setOpen] = useState(false);
    const [unread, setUnread] = useState(2);
    const ref = useRef(null);
    const alerts = session.role === 'Cashier' ? [] : products.filter((product) => product.active && ['out', 'low'].includes(getStockStatus(product))).slice(0, 3);
    useEffect(() => {
        const close = (event) => {
            if (!ref.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);
    return (
        <div className="dropdown-anchor" ref={ref}>
            <button className={`topbar-icon ${open ? 'selected' : ''}`} onClick={() => setOpen(!open)}
                    aria-label="Notifications">
                <Bell size={20}/>{unread > 0 && <span className="notification-badge">{unread}</span>}
            </button>
            {open && (
                <div className="popover notification-panel">
                    <div className="popover-title">
                        <div><strong>Notifications</strong><span>Latest activity across your store</span></div>
                        <button onClick={() => setUnread(0)}>Mark all read</button>
                    </div>
                    <div className="notification-list">
                        {alerts.map((product, index) => (
                            <button key={product.id} onClick={() => {
                                navigate('inventory/alerts');
                                setOpen(false);
                            }}>
                                <span
                                    className={`notification-icon ${product.stock === 0 ? 'danger' : 'warning'}`}><CircleAlert
                                    size={18}/></span>
                                <span><strong>{product.stock === 0 ? 'Out of stock' : 'Low stock'} · {product.name}</strong><small>{product.stock} units remaining · minimum {product.minStock}</small></span>
                                {index < unread && <i/>}
                            </button>
                        ))}
                        {sales[0] && session.role !== 'Inventory Staff' && <button onClick={() => {
                            navigate(`sales/view/${sales[0].id}`);
                            setOpen(false);
                        }}>
                            <span className="notification-icon success"><ShoppingCart size={18}/></span>
                            <span><strong>New sale {sales[0].id}</strong><small>{currency(sales[0].total)} · {relativeTime(sales[0].createdAt)}</small></span>
                        </button>}
                    </div>
                    <button className="popover-footer" onClick={() => {
                        navigate(session.role === 'Cashier' ? 'sales' : 'inventory/alerts');
                        setOpen(false);
                    }}>{session.role === 'Cashier' ? 'View sales history' : 'View all stock alerts'} <ChevronRight
                        size={15}/></button>
                </div>
            )}
        </div>
    );
}

function ProfileMenu({navigate, onSignOut}) {
    const {session} = useStore();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const close = (event) => {
            if (!ref.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);
    const go = (path) => {
        navigate(path);
        setOpen(false);
    };
    return (
        <div className="dropdown-anchor profile-anchor" ref={ref}>
            <button className="profile-button" onClick={() => setOpen(!open)} aria-expanded={open}>
                <Avatar name={session.name} src={session.avatar}/>
                <span
                    className="profile-button-copy"><strong>{session.name}</strong><small>{session.role === 'Administrator' ? 'Admin' : session.role}</small></span>
                <ChevronDown size={15} className={open ? 'rotate' : ''}/>
            </button>
            {open && (
                <div className="popover profile-menu">
                    <div className="profile-menu-head"><Avatar name={session.name} src={session.avatar} size="large"/>
                        <div><strong>{session.name}</strong><span>{session.email}</span></div>
                    </div>
                    <div className="menu-separator"/>
                    <button onClick={() => go('profile')}><UserRound size={17}/>My profile</button>
                    {session.role === 'Administrator' &&
                        <button onClick={() => go('settings')}><SlidersHorizontal size={17}/>Account settings</button>}
                    <div className="menu-separator"/>
                    <button className="danger-menu-item" onClick={onSignOut}><LogOut size={17}/>Sign out</button>
                </div>
            )}
        </div>
    );
}

function Topbar({route, navigate, onSignOut, onMenu}) {
    const {session} = useStore();
    return (
        <header className="topbar">
            <div className="topbar-left">
                <button className="mobile-menu-button" onClick={onMenu} aria-label="Open navigation"><Menu size={22}/>
                </button>
                <SearchBox navigate={navigate}/></div>
            <div className="topbar-actions">
                <Notifications navigate={navigate}/>
                {session.role === 'Administrator' &&
                    <button className="topbar-icon desktop-gear" onClick={() => navigate('settings')}
                            aria-label="Settings"><Settings size={20}/></button>}
                <span className="topbar-divider"/>
                <ProfileMenu navigate={navigate} onSignOut={onSignOut} route={route}/>
            </div>
        </header>
    );
}

export default function Layout({children, route, navigate, onSignOut}) {
    const [mobileOpen, setMobileOpen] = useState(false);
    useEffect(() => setMobileOpen(false), [route]);
    return (
        <div className="app-shell">
            <Sidebar route={route} navigate={navigate} open={mobileOpen} onClose={() => setMobileOpen(false)}/>
            <div className="app-main">
                <Topbar route={route} navigate={navigate} onSignOut={onSignOut} onMenu={() => setMobileOpen(true)}/>
                <main className="page-content">{children}</main>
                <footer className="app-footer"><span>RetailTrack · Inventory Management System</span><span>Ape Kade - Padiyathalawa</span>
                </footer>
            </div>
            <ToastViewport/>
        </div>
    );
}