import {useEffect, useMemo, useRef, useState} from 'react';
import {
    BarChart3,
    Bell,
    BellRing,
    CheckCheck,
    ChevronDown,
    ChevronRight,
    CircleAlert,
    Layers,
    LayoutDashboard,
    LogOut,
    Menu,
    Moon,
    Package,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    Settings,
    ShoppingCart,
    SlidersHorizontal,
    Sun,
    Tag,
    Trash2,
    Undo2,
    UserRound,
    Users,
    Warehouse,
    X,
} from 'lucide-react';
import {currency, getStockStatus, relativeTime} from '../data.js';
import {useStore} from '../store-context.js';
import {Avatar, ToastViewport} from './UI.jsx';
import ProductImage from './ProductImage.jsx';

/** @typedef {(path: string) => void} Navigate */

const allRoles = ['Administrator', 'Inventory Staff', 'Cashier'];
const adminAndStaff = ['Administrator', 'Inventory Staff'];
const navigation = [
    {id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: allRoles},
    {id: 'products', label: 'Products', icon: Package, roles: allRoles},
    {id: 'categories', label: 'Categories', icon: Layers, roles: ['Administrator']},
    {id: 'inventory', label: 'Inventory', icon: Warehouse, roles: adminAndStaff},
    {id: 'sales', label: 'Sales', icon: Tag, roles: allRoles},
    {id: 'returns', label: 'Customer Returns', icon: Undo2, roles: allRoles},
    {id: 'reports', label: 'Report & Analytics', icon: BarChart3, roles: adminAndStaff},
    {id: 'users', label: 'Users', icon: Users, roles: ['Administrator']},
    {id: 'settings', label: 'Settings', icon: Settings, roles: ['Administrator']},
];

/** @param {{ onClick: () => void, compact?: boolean }} props */
function Brand({onClick, compact = false}) {
    return (
        <button type="button" className="brand" onClick={onClick} aria-label="RetailTrack home"
                title="RetailTrack home">
            <div><strong>{compact ? 'RT' : 'RetailTrack'}</strong><span>Inventory Management System</span></div>
        </button>
    );
}

/** @param {{ navigate: Navigate, onClose: () => void, compact?: boolean, onExpand: () => void }} props */
function SidebarSearch({navigate, onClose, compact = false, onExpand}) {
    const {products, sales, session} = useStore();
    const [query, setQuery] = useState('');
    const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
    const term = query.trim().toLowerCase();
    const menuResults = term ? navigation.filter((item) => item.roles.includes(session.role) && item.label.toLowerCase().includes(term)).slice(0, 3) : [];
    const productResults = term ? products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(term)).slice(0, 4) : [];
    const saleResults = term ? sales.filter((sale) => `${sale.id} ${sale.customer}`.toLowerCase().includes(term)).slice(0, 3) : [];
    const resultCount = menuResults.length + productResults.length + saleResults.length;
    const select = (/** @type {string} */ path) => {
        navigate(path);
        setQuery('');
        onClose();
    };
    if (compact) return <div className="sidebar-search-area">
        <button className="sidebar-search-expand" onClick={() => {
            onExpand();
            window.setTimeout(() => inputRef.current?.focus(), 50);
        }} aria-label="Expand side menu and search" title="Search"><Search size={19}/></button>
    </div>;
    return (
        <div className="sidebar-search-area">
            <div className="sidebar-search-input">
                <Search size={18}/>
                <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)}
                       placeholder="Search…" aria-label="Search from side menu"/>
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
                            <button key={product.id} onClick={() => select(`products/view/${product.id}`)}><ProductImage
                                product={product}
                                size="tiny"/><span><strong>{product.name}</strong><small>{product.sku} · {product.stock} units</small></span><ChevronRight
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

/** @param {{ route: string, navigate: Navigate, open: boolean, onClose: () => void, collapsed: boolean, onToggle: () => void }} props */
function Sidebar({route, navigate, open, onClose, collapsed, onToggle}) {
    const {products, settings, session} = useStore();
    const lowCount = products.filter((product) => product.active && ['low', 'out'].includes(getStockStatus(product))).length;
    const compact = collapsed && !open;
    return (
        <>
            <aside className={`sidebar ${open ? 'sidebar-open' : ''} ${compact ? 'sidebar-compact' : ''}`}>
                <div className="sidebar-top">
                    <Brand compact={compact} onClick={() => {
                        navigate('/');
                        onClose();
                    }}/>
                    <button className="sidebar-close" onClick={onClose} aria-label="Close navigation"><X size={20}/>
                    </button>
                </div>
                <nav className="sidebar-nav">
                    <SidebarSearch navigate={navigate} onClose={onClose} compact={compact} onExpand={onToggle}/>
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
                                aria-label={compact ? item.label : undefined}
                                title={compact ? item.label : undefined}
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
                    <button className="sidebar-toggle" onClick={onToggle}
                            aria-label={collapsed ? 'Expand side menu' : 'Collapse side menu'}
                            aria-expanded={!collapsed} title={collapsed ? 'Expand side menu' : 'Collapse side menu'}>
                        {collapsed ? <PanelLeftOpen size={19}/> :
                            <PanelLeftClose size={19}/>}<span>{collapsed ? 'Expand' : 'Collapse menu'}</span>
                    </button>
                    {session.role !== 'Cashier' &&
                        <button className="sidebar-alert" title={compact ? `${lowCount} stock alerts` : undefined}
                                onClick={() => {
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

/** @param {{ navigate: Navigate, mobile?: boolean }} props */
function SearchBox({navigate, mobile = false}) {
    const {products, sales, session} = useStore();
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);
    const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
    const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));

    useEffect(() => {
        const focusSearch = () => inputRef.current?.focus();
        const keyHandler = (/** @type {KeyboardEvent} */ event) => {
            if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) {
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
        const close = (/** @type {MouseEvent} */ event) => {
            if (!containerRef.current?.contains(/** @type {Node | null} */ (event.target))) setFocused(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const results = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return {products: [], sales: []};
        return {
            products: products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(term)).slice(0, 5),
            sales: sales.filter((sale) => `${sale.id} ${sale.customer}`.toLowerCase().includes(term)).slice(0, 3),
        };
    }, [products, query, sales, session.role]);

    const hasResults = results.products.length > 0 || results.sales.length > 0;
    const select = (/** @type {string} */ path) => {
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
                                            <ProductImage product={product} size="small"/>
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

/** @typedef {{ read: string[], cleared: string[] }} NotificationState */

/** @param {{ navigate: Navigate }} props */
function Notifications({navigate}) {
    const {products, sales, session} = useStore();
    const [open, setOpen] = useState(false);
    const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
    const storageKey = `retailtrack-notifications-${session.userId}`;
    const [state, setState] = useState(/** @type {() => NotificationState} */ (() => {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
            return {
                read: Array.isArray(saved.read) ? saved.read : [],
                cleared: Array.isArray(saved.cleared) ? saved.cleared : [],
            };
        } catch {
            return {read: [], cleared: []};
        }
    }));

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
        } catch { /* Keep in-memory controls available. */
        }
    }, [state, storageKey]);

    useEffect(() => {
        const close = (/** @type {MouseEvent} */ event) => {
            if (!ref.current?.contains(/** @type {Node | null} */ (event.target))) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const alerts = session.role === 'Cashier' ? [] : products.filter((product) => product.active && ['out', 'low'].includes(getStockStatus(product))).slice(0, 3);
    const stockItems = alerts.map((product) => ({
        id: `stock-${product.id}-${product.stock}-${product.updatedAt || ''}`,
        product
    }));
    const latestSale = sales[0] && session.role !== 'Inventory Staff' ? sales[0] : null;
    const saleId = latestSale ? `sale-${latestSale.id}` : '';
    const allIds = [...stockItems.map((item) => item.id), ...(saleId ? [saleId] : [])];
    const visibleStock = stockItems.filter((item) => !state.cleared.includes(item.id));
    const showSale = Boolean(latestSale && !state.cleared.includes(saleId));
    const visibleCount = visibleStock.length + (showSale ? 1 : 0);
    const unreadCount = allIds.filter((id) => !state.cleared.includes(id) && !state.read.includes(id)).length;

    const markAllRead = () => setState((current) => ({...current, read: [...new Set([...current.read, ...allIds])]}));
    const clearAll = () => setState((current) => ({
        read: [...new Set([...current.read, ...allIds])],
        cleared: [...new Set([...current.cleared, ...allIds])]
    }));
    const openItem = (/** @type {string} */ id, /** @type {string} */ path) => {
        setState((current) => ({...current, read: [...new Set([...current.read, id])]}));
        navigate(path);
        setOpen(false);
    };

    return (
        <div className="dropdown-anchor" ref={ref}>
            <button className={`topbar-icon notification-trigger ${open ? 'selected' : ''}`}
                    onClick={() => setOpen(!open)}
                    aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open}
                    aria-haspopup="true" title={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}>
                {unreadCount > 0 ? <BellRing size={20} strokeWidth={1.9}/> :
                    <Bell size={20} strokeWidth={1.9}/>}{unreadCount > 0 &&
                <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {open && (
                <div className="popover notification-panel">
                    <div className="popover-title">
                        <div><strong>Notifications</strong><span>Latest activity across your store</span></div>
                        <div className="notification-header-actions">
                            <button onClick={markAllRead} disabled={!unreadCount}><CheckCheck size={14}/>Mark all read
                            </button>
                            <button onClick={clearAll} disabled={!visibleCount}><Trash2 size={14}/>Clear all</button>
                        </div>
                    </div>
                    <div className="notification-list">
                        {visibleStock.map(({id, product}) => (
                            <button key={id} onClick={() => openItem(id, 'inventory/alerts')}>
                                <ProductImage product={product} size="small"/>
                                <span><strong>{product.stock === 0 ? 'Out of stock' : 'Low stock'} · {product.name}</strong><small>{product.stock} units remaining · minimum {product.minStock}</small></span>
                                {!state.read.includes(id) && <i/>}
                            </button>
                        ))}
                        {showSale && latestSale &&
                            <button onClick={() => openItem(saleId, `sales/view/${latestSale.id}`)}>
                                <span className="notification-icon success"><ShoppingCart size={18}/></span>
                                <span><strong>New sale {latestSale.id}</strong><small>{currency(latestSale.total)} · {relativeTime(latestSale.createdAt)}</small></span>
                                {!state.read.includes(saleId) && <i/>}
                            </button>}
                        {!visibleCount &&
                            <div className="notification-empty"><Bell size={23}/><strong>All caught up</strong><span>New store activity will appear here.</span>
                            </div>}
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

/** @param {{ navigate: Navigate, onSignOut: () => void }} props */
function ProfileMenu({navigate, onSignOut}) {
    const {session} = useStore();
    const [open, setOpen] = useState(false);
    const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
    useEffect(() => {
        const close = (/** @type {MouseEvent} */ event) => {
            if (!ref.current?.contains(/** @type {Node | null} */ (event.target))) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);
    const go = (/** @type {string} */ path) => {
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

/** @param {{ navigate: Navigate, onSignOut: () => void, onMenu: () => void }} props */
function Topbar({navigate, onSignOut, onMenu}) {
    const {session} = useStore();
    const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        try {
            localStorage.setItem('retailtrack-theme', theme);
        } catch { /* Theme still applies for this session. */
        }
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1220' : '#1c2738');
    }, [theme]);
    const dark = theme === 'dark';
    return (
        <header className="topbar">
            <div className="topbar-left">
                <button className="mobile-menu-button" onClick={onMenu} aria-label="Open navigation"><Menu size={22}/>
                </button>
                <SearchBox navigate={navigate}/></div>
            <div className="topbar-actions">
                <Notifications navigate={navigate}/>
                <button className="topbar-icon theme-toggle" onClick={() => setTheme(dark ? 'light' : 'dark')}
                        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                        title={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={dark}>{dark ?
                    <Sun size={20}/> : <Moon size={20}/>}</button>
                {session.role === 'Administrator' &&
                    <button className="topbar-icon desktop-gear" onClick={() => navigate('settings')}
                            aria-label="Settings"><Settings size={20}/></button>}
                <span className="topbar-divider"/>
                <ProfileMenu navigate={navigate} onSignOut={onSignOut}/>
            </div>
        </header>
    );
}

/** @param {{ navigate: Navigate }} props */
function Footer({navigate}) {
    const {session, settings} = useStore();
    const links = [
        {label: 'Dashboard', path: '/', roles: allRoles},
        {label: 'Products', path: 'products', roles: allRoles},
        {label: 'Inventory', path: 'inventory', roles: adminAndStaff},
        {label: 'Sales', path: 'sales', roles: allRoles},
        {label: 'Returns', path: 'returns', roles: allRoles},
        {label: 'Reports', path: 'reports', roles: adminAndStaff},
        {label: 'My Profile', path: 'profile', roles: allRoles},
    ].filter((link) => link.roles.includes(session.role));
    return (
        <footer className="app-footer">
            <div className="footer-brand">
                <strong>RetailTrack</strong><span>Simple inventory and sales control for {settings.storeName}.</span>
            </div>
            <nav className="footer-links" aria-label="Footer navigation">{links.map((link) => <button key={link.path}
                                                                                                      onClick={() => navigate(link.path)}>{link.label}</button>)}</nav>
            <div className="footer-meta">
                <span>© {new Date().getFullYear()} RetailTrack</span><span>{settings.location}</span></div>
        </footer>
    );
}

/** @param {{ children: import('react').ReactNode, route: string, navigate: Navigate, onSignOut: () => void }} props */
export default function Layout({children, route, navigate, onSignOut}) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem('retailtrack-sidebar-collapsed') === 'true';
        } catch {
            return false;
        }
    });
    useEffect(() => setMobileOpen(false), [route]);
    useEffect(() => {
        try {
            localStorage.setItem('retailtrack-sidebar-collapsed', String(collapsed));
        } catch { /* The current session retains the selected layout. */
        }
    }, [collapsed]);
    return (
        <div className={`app-shell ${collapsed ? 'sidebar-is-collapsed' : ''}`}>
            <Sidebar route={route} navigate={navigate} open={mobileOpen} onClose={() => setMobileOpen(false)}
                     collapsed={collapsed} onToggle={() => setCollapsed((current) => !current)}/>
            <div className="app-main">
                <Topbar navigate={navigate} onSignOut={onSignOut} onMenu={() => setMobileOpen(true)}/>
                <main className="page-content">{children}</main>
                <Footer navigate={navigate}/>
            </div>
            <ToastViewport/>
        </div>
    );
}