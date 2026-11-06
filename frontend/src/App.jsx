import {useCallback, useEffect, useState} from 'react';
import {LockKeyhole} from 'lucide-react';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Products, {ProductForm} from './pages/Products.jsx';
import Categories from './pages/Categories.jsx';
import Inventory from './pages/Inventory.jsx';
import Sales, {NewSale} from './pages/Sales.jsx';
import Reports from './pages/Reports.jsx';
import Returns from './pages/Returns.jsx';
import Users from './pages/Users.jsx';
import Settings, {Profile} from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import {ForgotPassword, ResetPassword, VerifyOtp} from './pages/PasswordRecovery.jsx';
import {useStore} from './store-context.js';

/** @param {string} value */
const normalizeRoute = (value) => value.replace(/^\/+|\/+$/g, '') || 'dashboard';
const legacyHashRoute = () => window.location.hash.replace(/^#\/?/, '');
const currentRoute = () => normalizeRoute(legacyHashRoute() || window.location.pathname);
const readLocation = () => ({
    route: currentRoute(),
    url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
});

/** @type {Partial<Record<import('./types.js').Role, string[]>>} */
const roleRoutes = {
    'Inventory Staff': ['dashboard', 'products', 'inventory', 'sales', 'returns', 'reports', 'profile'],
    Cashier: ['dashboard', 'products', 'sales', 'returns', 'profile'],
};

/**
 * @param {string} route
 * @param {import('./types.js').Role} role
 */
function canAccess(route, role) {
    if (role === 'Administrator') return true;
    if (((route === 'products/new' || route.startsWith('products/edit/')) && role === 'Cashier') || (route === 'sales/new' && role === 'Inventory Staff')) return false;
    const root = route.split('/')[0] || 'dashboard';
    return (roleRoutes[role] || ['dashboard', 'profile']).includes(root);
}

/** @param {{ navigate: (path: string) => void }} props */
function AccessDenied({navigate}) {
    return (
        <section className="card access-denied">
            <span><LockKeyhole size={30}/></span>
            <h1>Access restricted</h1>
            <p>Your current role does not include permission to open this area. Contact an Administrator if you need
                additional access.</p>
            <button className="button button-primary" onClick={() => navigate('dashboard')}>Return to Dashboard</button>
        </section>
    );
}

export default function App() {
    const {session, login, logout} = useStore();
    const [location, setLocation] = useState(readLocation);
    const route = location.route;

    useEffect(() => {
        const legacyRoute = legacyHashRoute();
        if (legacyRoute) {
            const normalized = normalizeRoute(legacyRoute);
            window.history.replaceState({}, '', `/${normalized}`);
            setLocation(readLocation());
        }
        const onPopState = () => setLocation(readLocation());
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    useEffect(() => {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
    }, [route]);

    const navigate = useCallback((/** @type {string} */ path, /** @type {{ replace?: boolean }} */ options = {}) => {
        const destination = new URL(path, window.location.origin);
        const nextRoute = normalizeRoute(destination.pathname);
        const nextPath = destination.pathname === '/' ? '/' : `/${nextRoute}`;
        const nextUrl = `${nextPath}${destination.search}`;
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        const sameRoute = currentRoute() === nextRoute;

        if (currentUrl === nextUrl && !window.location.hash) {
            setLocation(readLocation());
            window.scrollTo({top: 0, behavior: 'smooth'});
            return;
        }

        if (options.replace) window.history.replaceState({}, '', nextUrl);
        else window.history.pushState({}, '', nextUrl);
        setLocation(readLocation());
        if (sameRoute) window.scrollTo({top: 0, behavior: 'smooth'});
    }, []);

    const signIn = (/** @type {import('./types.js').AuthAccount} */ account, /** @type {boolean} */ remember) => {
        login(account, remember);
        navigate('dashboard');
    };

    if (!session) {
        if (route === 'forgot-password') return <ForgotPassword navigate={navigate}/>;
        if (route === 'verify-otp') return <VerifyOtp navigate={navigate}/>;
        if (route === 'reset-password') return <ResetPassword navigate={navigate}/>;
        return <Login onLogin={signIn} navigate={navigate}/>;
    }

    let page;
    if (!canAccess(route, session.role)) page = <AccessDenied navigate={navigate}/>;
    else if (route === 'dashboard') page = <Dashboard navigate={navigate}/>;
    else if (route === 'products/new') page = <ProductForm navigate={navigate}/>;
    else if (route.startsWith('products/edit/')) page =
        <ProductForm navigate={navigate} productId={route.split('/')[2]}/>;
    else if (route.startsWith('products/view/')) page = <Products navigate={navigate} viewId={route.split('/')[2]}/>;
    else if (route.startsWith('products/category/')) page =
        <Products navigate={navigate} initialCategory={route.split('/')[2]}/>;
    else if (route === 'products') page = <Products navigate={navigate}/>;
    else if (route === 'categories') page = <Categories navigate={navigate}/>;
    else if (route === 'inventory/alerts') page = <Inventory navigate={navigate} section="alerts"/>;
    else if (route === 'inventory/history') page = <Inventory navigate={navigate} section="history"/>;
    else if (route === 'inventory') page = <Inventory navigate={navigate} section="current"/>;
    else if (route === 'sales/new') page = <NewSale navigate={navigate}/>;
    else if (route.startsWith('sales/view/')) page =
        <Sales navigate={navigate} viewId={decodeURIComponent(route.split('/')[2])}/>;
    else if (route === 'sales') page = <Sales navigate={navigate}/>;
    else if (route === 'returns') page = <Returns navigate={navigate}/>;
    else if (route === 'reports') page = <Reports/>;
    else if (route === 'users') page = <Users/>;
    else if (route === 'settings') page = <Settings/>;
    else if (route === 'profile') page = <Profile/>;
    else page = <Dashboard navigate={navigate}/>;

    return <Layout route={route} navigate={navigate} onSignOut={logout}>{page}</Layout>;
}